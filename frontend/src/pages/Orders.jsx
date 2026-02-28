import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getOrders, getClients, createOrder, updateOrder, deleteOrder, getOrderPdfUrl } from '../services/api'
import { Plus, X, Trash2, FileDown, Edit2, ShoppingBag, ArrowLeft, Users, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = ['Pendiente', 'Comprado', 'Enviado', 'Entregado', 'Cancelado']
const BANKS = ['Banco Estado', 'Santander', 'BCI', 'Falabella', 'Ripley', 'Scotiabank', 'Otro']
const METHODS = ['Transferencia', 'Tarjeta débito', 'Tarjeta crédito', 'Efectivo', 'Otro']

const emptyItem = { name: '', base_price_usd: '', tax_percent: '', commission_percent: '', quantity: 1 }

function calcItem(item, rate) {
    const base = parseFloat(item.base_price_usd) || 0
    const taxPct = parseFloat(item.tax_percent) || 0
    const commPct = parseFloat(item.commission_percent) || 0
    const qty = parseInt(item.quantity) || 1
    const tax = base * (taxPct / 100)
    const comm = (base + tax) * (commPct / 100)
    const unit = base + tax + comm
    const finalUSD = unit * qty
    const finalCLP = finalUSD * (parseFloat(rate) || 900)
    return { tax, comm, finalUSD, finalCLP }
}

function calcTotals(items, rate) {
    let totalTax = 0, totalComm = 0, totalUSD = 0, totalCLP = 0
    items.forEach((item) => {
        const c = calcItem(item, rate)
        totalTax += c.tax * (parseInt(item.quantity) || 1)
        totalComm += c.comm * (parseInt(item.quantity) || 1)
        totalUSD += c.finalUSD
        totalCLP += c.finalCLP
    })
    return { totalTax, totalComm, totalUSD, totalCLP }
}

const emptyOrder = {
    client_id: '',
    status: 'Pendiente',
    payment_bank: '',
    payment_method: '',
    notes: '',
    exchange_rate: '900',
    order_date: '',
    items: [{ ...emptyItem }],
}

function getStatusBadgeClass(status) {
    const map = {
        'Pendiente': 'badge-pendiente',
        'Comprado': 'badge-comprado',
        'Enviado': 'badge-enviado',
        'Entregado': 'badge-entregado',
        'Cancelado': 'badge-cancelado',
    }
    return map[status] || 'badge-pendiente'
}

export default function Orders() {
    const [searchParams, setSearchParams] = useSearchParams()
    const navigate = useNavigate()
    const filterClientId = searchParams.get('client_id')
    const filterClientName = searchParams.get('client_name')

    const [orders, setOrders] = useState([])
    const [clients, setClients] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingOrder, setEditingOrder] = useState(null)
    const [form, setForm] = useState(emptyOrder)
    const [saving, setSaving] = useState(false)
    const [statusEdit, setStatusEdit] = useState({}) // { orderId: newStatus }
    const [filterStatus, setFilterStatus] = useState('Todos')

    const [currentRate, setCurrentRate] = useState('900')
    const [rateLoading, setRateLoading] = useState(false)
    const [rateError, setRateError] = useState(false)
    const [rateDate, setRateDate] = useState(null)

    useEffect(() => {
        const fetchRate = async () => {
            setRateLoading(true)
            setRateError(false)
            try {
                const res = await fetch('https://mindicador.cl/api/dolar')
                if (!res.ok) throw new Error('API error')
                const data = await res.json()
                if (data?.serie?.length > 0) {
                    setCurrentRate(String(data.serie[0].valor))
                    setRateDate(new Date(data.serie[0].fecha).toLocaleDateString('es-CL'))
                }
            } catch (err) {
                console.error('Error fetching exchange rate:', err)
                setRateError(true)
                toast.error('No se pudo obtener el precio del dólar. Usando tasa por defecto.')
            } finally {
                setRateLoading(false)
            }
        }
        fetchRate()
    }, [])

    const fetchOrders = useCallback(async () => {
        try {
            const params = filterClientId ? { client_id: filterClientId } : {}
            const res = await getOrders(params)
            setOrders(res.data)
        } catch {
            toast.error('Error al cargar pedidos')
        } finally {
            setLoading(false)
        }
    }, [filterClientId])

    useEffect(() => {
        fetchOrders()
        getClients().then((r) => setClients(r.data))
    }, [fetchOrders])

    const openCreate = () => {
        setEditingOrder(null)
        setForm({ ...emptyOrder, client_id: filterClientId || '', items: [{ ...emptyItem }], exchange_rate: currentRate })
        setShowModal(true)
    }

    const openEdit = (order) => {
        setEditingOrder(order)
        setForm({
            client_id: order.client_id,
            status: order.status,
            payment_bank: order.payment_bank || '',
            payment_method: order.payment_method || '',
            notes: order.notes || '',
            exchange_rate: String(order.exchange_rate),
            order_date: order.order_date ? order.order_date.split('T')[0] : '',
            items: order.items.map((i) => ({
                name: i.name,
                base_price_usd: String(i.base_price_usd),
                tax_percent: String(i.tax_percent),
                commission_percent: String(i.commission_percent),
                quantity: i.quantity,
            })),
        })
        setShowModal(true)
    }

    const closeModal = () => setShowModal(false)

    const updateItem = (idx, field, value) => {
        const items = [...form.items]
        items[idx] = { ...items[idx], [field]: value }
        setForm({ ...form, items })
    }

    const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] })
    const removeItem = (idx) => {
        if (form.items.length === 1) return
        setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })
    }

    const totals = calcTotals(form.items, form.exchange_rate)

    const handleSave = async (e) => {
        e.preventDefault()
        if (!form.client_id) { toast.error('Selecciona un cliente'); return }
        if (form.items.some((i) => !i.name || !i.base_price_usd)) { toast.error('Cada producto necesita nombre y precio'); return }
        setSaving(true)
        try {
            const payload = {
                ...form,
                exchange_rate: parseFloat(form.exchange_rate),
                order_date: form.order_date ? new Date(form.order_date).toISOString() : undefined,
                items: form.items.map((i) => ({
                    name: i.name,
                    base_price_usd: parseFloat(i.base_price_usd) || 0,
                    tax_percent: parseFloat(i.tax_percent) || 0,
                    commission_percent: parseFloat(i.commission_percent) || 0,
                    quantity: parseInt(i.quantity) || 1,
                })),
            }
            if (editingOrder) {
                await updateOrder(editingOrder.id, payload)
                toast.success('Pedido actualizado')
            } else {
                await createOrder(payload)
                toast.success('Pedido creado')
            }
            closeModal()
            fetchOrders()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar el pedido')
        } finally {
            setSaving(false)
        }
    }

    const handleStatusChange = async (orderId, newStatus) => {
        try {
            await updateOrder(orderId, { status: newStatus })
            toast.success('Estado actualizado')
            fetchOrders()
        } catch {
            toast.error('Error al actualizar estado')
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este pedido?')) return
        try {
            await deleteOrder(id)
            toast.success('Pedido eliminado')
            fetchOrders()
        } catch {
            toast.error('Error al eliminar')
        }
    }

    const downloadPdf = (orderId) => {
        const token = localStorage.getItem('token')
        // Fetch PDF with auth header and trigger download
        fetch(getOrderPdfUrl(orderId), { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => res.blob())
            .then((blob) => {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `boleta-${orderId.slice(0, 8)}.pdf`
                a.click()
                URL.revokeObjectURL(url)
            })
            .catch(() => toast.error('Error al generar PDF'))
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    {filterClientName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => navigate('/clientes')}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                                <ArrowLeft size={14} />
                                <Users size={14} />
                                Volver a Clientes
                            </button>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setSearchParams({})}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                                <ShoppingBag size={14} />
                                Ver todos los pedidos
                            </button>
                        </div>
                    )}
                    <h2 className="page-title">
                        {filterClientName
                            ? `Pedidos de ${decodeURIComponent(filterClientName)}`
                            : 'Pedidos'}
                    </h2>
                    {filterClientName && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Mostrando pedidos exclusivos de este cliente
                        </p>
                    )}
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={16} /> Nuevo Pedido
                </button>
            </div>

            {/* Live Dollar Rate Indicator */}
            <div className="rate-indicator">
                <div className="rate-indicator-left">
                    <span className="rate-indicator-label">💵 Dólar Observado (USD → CLP)</span>
                    {rateLoading ? (
                        <span className="rate-indicator-value rate-loading">Cargando...</span>
                    ) : rateError ? (
                        <span className="rate-indicator-value rate-error">Error — usando $900</span>
                    ) : (
                        <span className="rate-indicator-value rate-live">
                            ${parseFloat(currentRate).toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                        </span>
                    )}
                </div>
                <div className="rate-indicator-right">
                    {!rateLoading && !rateError && (
                        <span className="rate-indicator-badge">
                            <span className="rate-dot"></span>
                            En vivo
                        </span>
                    )}
                    {rateDate && !rateError && (
                        <span className="rate-indicator-date">Actualizado: {rateDate}</span>
                    )}
                </div>
            </div>

            {/* Status Filter Tabs */}
            {!loading && orders.length > 0 && (
                <div className="status-filter-bar">
                    <Filter size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    {['Todos', ...STATUS_OPTIONS].map((status) => {
                        const count = status === 'Todos'
                            ? orders.length
                            : orders.filter((o) => o.status === status).length
                        return (
                            <button
                                key={status}
                                className={`status-filter-tab ${filterStatus === status ? 'active' : ''} ${status !== 'Todos' ? `tab-${status.toLowerCase()}` : ''}`}
                                onClick={() => setFilterStatus(status)}
                            >
                                {status}
                                <span className="status-filter-count">{count}</span>
                            </button>
                        )
                    })}
                </div>
            )}

            {(() => {
                const filteredOrders = filterStatus === 'Todos'
                    ? orders
                    : orders.filter((o) => o.status === filterStatus)

                return loading ? (
                    <div className="empty-state"><p>Cargando...</p></div>
                ) : orders.length === 0 ? (
                    <div className="empty-state">
                        <ShoppingBag size={48} />
                        <h3>No hay pedidos</h3>
                        <p>Crea el primer pedido</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="empty-state">
                        <ShoppingBag size={48} />
                        <h3>No hay pedidos con estado "{filterStatus}"</h3>
                        <p>Cambia el filtro para ver otros pedidos</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Cliente</th>
                                    <th>Fecha</th>
                                    <th>Estado</th>
                                    <th>Banco / Pago</th>
                                    <th>Total USD</th>
                                    <th>Total CLP</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((o) => (
                                    <tr key={o.id}>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            #{o.id.slice(0, 8).toUpperCase()}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{o.client?.name || '—'}</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            {o.order_date ? new Date(o.order_date).toLocaleDateString('es-CL') : '—'}
                                        </td>
                                        <td>
                                            <select
                                                className={`badge ${getStatusBadgeClass(o.status)}`}
                                                style={{ border: 'none', cursor: 'pointer', fontWeight: 700 }}
                                                value={o.status}
                                                onChange={(e) => handleStatusChange(o.id, e.target.value)}
                                            >
                                                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {o.payment_bank || '—'}{o.payment_method ? ` / ${o.payment_method}` : ''}
                                        </td>
                                        <td style={{ color: 'var(--success)', fontWeight: 700 }}>${o.total_usd.toFixed(2)}</td>
                                        <td style={{ fontWeight: 600 }}>
                                            ${Math.floor(o.total_clp).toLocaleString('es-CL')}
                                        </td>
                                        <td>
                                            <div className="flex gap-1">
                                                <button className="btn btn-secondary btn-sm" title="Editar" onClick={() => openEdit(o)}>
                                                    <Edit2 size={14} />
                                                </button>
                                                <button className="btn btn-success btn-sm" title="Descargar PDF" onClick={() => downloadPdf(o.id)}>
                                                    <FileDown size={14} />
                                                </button>
                                                <button className="btn btn-danger btn-sm" title="Eliminar" onClick={() => handleDelete(o.id)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            })()}

            {/* ORDER FORM MODAL */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingOrder ? 'Editar Pedido' : 'Nuevo Pedido'}</h3>
                            <button className="modal-close" onClick={closeModal}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSave}>
                            {/* Client & Basic Info */}
                            <div className="form-grid mb-2">
                                <div className="form-group">
                                    <label className="form-label">Cliente *</label>
                                    <select className="form-select" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                                        <option value="">Selecciona un cliente</option>
                                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Estado</label>
                                    <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Banco</label>
                                    <select className="form-select" value={form.payment_bank} onChange={(e) => setForm({ ...form, payment_bank: e.target.value })}>
                                        <option value="">Seleccionar banco</option>
                                        {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Método de Pago</label>
                                    <select className="form-select" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                                        <option value="">Seleccionar método</option>
                                        {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        Tasa USD → CLP *
                                        {rateLoading && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>(Actualizando...)</span>}
                                        {!rateLoading && currentRate !== '900' && !editingOrder && <span style={{ fontSize: '0.75rem', color: 'var(--success)', marginLeft: '0.5rem' }}>(Precio real)</span>}
                                    </label>
                                    <input type="number" step="0.01" className="form-input" placeholder="950" value={form.exchange_rate} onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha del Pedido</label>
                                    <input type="date" className="form-input" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} />
                                </div>
                            </div>

                            {/* Products */}
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                    <label className="form-label" style={{ margin: 0 }}>Productos *</label>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                                        <Plus size={14} /> Agregar producto
                                    </button>
                                </div>

                                {form.items.map((item, idx) => {
                                    const c = calcItem(item, form.exchange_rate)
                                    return (
                                        <div key={idx} className="item-row">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Producto {idx + 1}</span>
                                                {form.items.length > 1 && (
                                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(idx)}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="form-grid-3">
                                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                    <label className="form-label">Nombre del producto</label>
                                                    <input className="form-input" placeholder="Ej: Zapatillas Nike" value={item.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Precio base USD</label>
                                                    <input type="number" step="0.01" className="form-input" placeholder="0.00" value={item.base_price_usd} onChange={(e) => updateItem(idx, 'base_price_usd', e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Tax (%)</label>
                                                    <input type="number" step="0.1" className="form-input" placeholder="0" value={item.tax_percent} onChange={(e) => updateItem(idx, 'tax_percent', e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Comisión (%)</label>
                                                    <input type="number" step="0.1" className="form-input" placeholder="0" value={item.commission_percent} onChange={(e) => updateItem(idx, 'commission_percent', e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Cantidad</label>
                                                    <input type="number" min="1" className="form-input" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                                                </div>
                                            </div>
                                            {/* Live Calculations */}
                                            {item.base_price_usd && (
                                                <div className="item-calcs">
                                                    <div className="calc-item">
                                                        <span className="calc-label">Tax USD</span>
                                                        <span className="calc-value">${c.tax.toFixed(3)}</span>
                                                    </div>
                                                    <div className="calc-item">
                                                        <span className="calc-label">Comisión USD</span>
                                                        <span className="calc-value">${c.comm.toFixed(3)}</span>
                                                    </div>
                                                    <div className="calc-item">
                                                        <span className="calc-label">Total USD</span>
                                                        <span className="calc-value" style={{ color: 'var(--primary)' }}>${c.finalUSD.toFixed(2)}</span>
                                                    </div>
                                                    <div className="calc-item">
                                                        <span className="calc-label">Total CLP</span>
                                                        <span className="calc-value" style={{ color: '#F59E0B' }}>${Math.floor(c.finalCLP).toLocaleString('es-CL')}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Order Totals */}
                            <div className="order-totals">
                                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumen del Pedido</h4>
                                <div className="total-row"><span>Total Tax USD</span><span>${totals.totalTax.toFixed(2)}</span></div>
                                <div className="total-row"><span>Total Comisión USD</span><span style={{ color: 'var(--success)' }}>${totals.totalComm.toFixed(2)}</span></div>
                                <div className="total-row">
                                    <span>TOTAL USD</span>
                                    <span className="total-grand">${totals.totalUSD.toFixed(2)}</span>
                                </div>
                                <div className="total-row">
                                    <span>TOTAL CLP</span>
                                    <span className="total-grand" style={{ fontSize: '1.25rem' }}>${Math.floor(totals.totalCLP).toLocaleString('es-CL')}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="form-group" style={{ margin: '1rem 0' }}>
                                <label className="form-label">Observaciones</label>
                                <textarea className="form-textarea" placeholder="Notas adicionales del pedido..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                            </div>

                            <div className="flex gap-1">
                                <button type="button" className="btn btn-secondary" onClick={closeModal} style={{ flex: 1 }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                                    {saving ? 'Guardando...' : editingOrder ? 'Actualizar Pedido' : 'Crear Pedido'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
