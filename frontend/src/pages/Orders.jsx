import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getOrders, getClients, createOrder, updateOrder, deleteOrder, getOrderPdfUrl } from '../services/api'
import { useCachedQuery, invalidateCache } from '../hooks/useCache'
import { Plus, X, Trash2, FileDown, Edit2, ShoppingBag, ArrowLeft, Users, CreditCard, Package, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import ClientSearchSelect from '../components/ClientSearchSelect'
import toast from 'react-hot-toast'

const PAYMENT_STATUS_OPTIONS = ['Pendiente', 'Pagado']
const ORDER_STATUS_OPTIONS = ['En Bodega', 'Enviado']
const BANKS = ['Global 66', 'Currency Bird', 'Directo', 'Otros']
const METHODS = ['Transferencia', 'Tarjeta débito', 'Tarjeta crédito', 'Efectivo', 'Otro']

const emptyItem = { name: '', base_price_usd: '', tax_percent: '', commission_percent: '', quantity: 1 }

function calcItem(item) {
    const base = parseFloat(item.base_price_usd) || 0
    const taxPct = parseFloat(item.tax_percent) || 0
    const commPct = parseFloat(item.commission_percent) || 0
    const qty = parseInt(item.quantity) || 1
    const tax = base * (taxPct / 100)
    const comm = (base + tax) * (commPct / 100)
    const unit = base + tax + comm
    const finalUSD = unit * qty
    return { tax, comm, finalUSD }
}

function calcTotals(items) {
    let totalTax = 0, totalComm = 0, totalUSD = 0
    items.forEach((item) => {
        const c = calcItem(item)
        totalTax += c.tax * (parseInt(item.quantity) || 1)
        totalComm += c.comm * (parseInt(item.quantity) || 1)
        totalUSD += c.finalUSD
    })
    return { totalTax, totalComm, totalUSD }
}

const emptyOrder = {
    client_id: '',
    payment_status: 'Pendiente',
    order_status: 'En Bodega',
    payment_bank: '',
    payment_method: '',
    notes: '',
    order_date: '',
    items: [{ ...emptyItem }],
}

function getPaymentBadgeClass(status) {
    return status === 'Pagado' ? 'badge-pago-pagado' : 'badge-pago-pendiente'
}

function getOrderBadgeClass(status) {
    return status === 'Enviado' ? 'badge-enviado' : 'badge-en-bodega'
}

function formatInvoice(num) {
    return num ? `#${String(num).padStart(4, '0')}` : '—'
}

function getLocalDateString() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Orders() {
    const [searchParams, setSearchParams] = useSearchParams()
    const navigate = useNavigate()
    const filterClientId = searchParams.get('client_id')
    const filterClientName = searchParams.get('client_name')

    const [showModal, setShowModal] = useState(false)
    const [editingOrder, setEditingOrder] = useState(null)
    const [form, setForm] = useState(emptyOrder)
    const [saving, setSaving] = useState(false)
    const [filterOrderStatus, setFilterOrderStatus] = useState('Todos')
    const [filterPaymentStatus, setFilterPaymentStatus] = useState('Todos')
    const [searchText, setSearchText] = useState('')
    const [page, setPage] = useState(1)
    const PAGE_SIZE = 30

    const cacheKey = `orders-p${page}-${filterClientId || 'all'}-${searchText}`
    const { data: ordersData, loading, refetch: refetchOrders } = useCachedQuery(
        cacheKey,
        () => {
            const params = { page, page_size: PAGE_SIZE }
            if (filterClientId) params.client_id = filterClientId
            if (searchText) params.search = searchText
            return getOrders(params)
        },
        { deps: [page, filterClientId, searchText], staleTime: 3 * 60 * 1000 }
    )

    const { data: clients } = useCachedQuery('clients', getClients)

    const ordersList = ordersData?.items || ordersData || []
    const totalOrders = ordersData?.total || ordersList.length
    const totalPages = ordersData?.pages || 1

    useEffect(() => { setPage(1) }, [filterClientId, searchText])

    const openCreate = () => {
        setEditingOrder(null)
        setForm({ ...emptyOrder, order_date: getLocalDateString(), client_id: filterClientId || '', items: [{ ...emptyItem }] })
        setShowModal(true)
    }

    const openEdit = (order) => {
        setEditingOrder(order)
        setForm({
            client_id: order.client_id,
            payment_status: order.payment_status,
            order_status: order.order_status,
            payment_bank: order.payment_bank || '',
            payment_method: order.payment_method || '',
            notes: order.notes || '',
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

    const totals = calcTotals(form.items)

    const handleSave = async (e) => {
        e.preventDefault()
        if (!form.client_id) { toast.error('Selecciona un cliente'); return }
        if (form.items.some((i) => !i.name || !i.base_price_usd)) { toast.error('Cada producto necesita nombre y precio'); return }
        setSaving(true)
        try {
            const payload = {
                ...form,
                order_date: form.order_date ? form.order_date : undefined,
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
            invalidateCache('orders')
            invalidateCache('dashboard')
            invalidateCache('clients')
            refetchOrders()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar el pedido')
        } finally {
            setSaving(false)
        }
    }

    const handlePaymentStatusChange = async (orderId, newStatus) => {
        try {
            await updateOrder(orderId, { payment_status: newStatus })
            toast.success('Estado de pago actualizado')
            invalidateCache('orders')
            invalidateCache('dashboard')
            refetchOrders()
        } catch {
            toast.error('Error al actualizar estado de pago')
        }
    }

    const handleOrderStatusChange = async (orderId, newStatus) => {
        try {
            await updateOrder(orderId, { order_status: newStatus })
            toast.success('Estado de pedido actualizado')
            invalidateCache('orders')
            invalidateCache('dashboard')
            refetchOrders()
        } catch {
            toast.error('Error al actualizar estado de pedido')
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este pedido?')) return
        try {
            await deleteOrder(id)
            toast.success('Pedido eliminado')
            invalidateCache('orders')
            invalidateCache('dashboard')
            invalidateCache('clients')
            refetchOrders()
        } catch {
            toast.error('Error al eliminar')
        }
    }

    const downloadPdf = (orderId) => {
        const token = localStorage.getItem('token')
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

    const filteredOrders = ordersList.filter((o) => {
        const matchOrder = filterOrderStatus === 'Todos' || o.order_status === filterOrderStatus
        const matchPayment = filterPaymentStatus === 'Todos' || o.payment_status === filterPaymentStatus
        return matchOrder && matchPayment
    })

    return (
        <div>
            <div className="page-header">
                <div>
                    {filterClientName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/clientes')}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <ArrowLeft size={14} /><Users size={14} /> Volver a Clientes
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSearchParams({})}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <ShoppingBag size={14} /> Ver todos los pedidos
                            </button>
                        </div>
                    )}
                    <h2 className="page-title">
                        {filterClientName ? `Pedidos de ${decodeURIComponent(filterClientName)}` : 'Pedidos'}
                    </h2>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={16} /> Nuevo Pedido
                </button>
            </div>

            {/* Search bar */}
            {!filterClientId && (
                <div style={{ marginBottom: '1rem' }}>
                    <div className="search-bar" style={{ maxWidth: '400px' }}>
                        <Search size={16} style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre de cliente..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                        {searchText && (
                            <button onClick={() => setSearchText('')}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Dual Status Filter Bars */}
            {!loading && ordersList.length > 0 && (
                <div className="dual-filter-container">
                    <div className="status-filter-bar">
                        <CreditCard size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span className="filter-label">Pago:</span>
                        {['Todos', ...PAYMENT_STATUS_OPTIONS].map((s) => {
                            const count = s === 'Todos' ? ordersList.length : ordersList.filter((o) => o.payment_status === s).length
                            return (
                                <button key={`pay-${s}`}
                                    className={`status-filter-tab ${filterPaymentStatus === s ? 'active' : ''} ${s !== 'Todos' ? `tab-pago-${s.toLowerCase()}` : ''}`}
                                    onClick={() => setFilterPaymentStatus(s)}>
                                    {s} <span className="status-filter-count">{count}</span>
                                </button>
                            )
                        })}
                    </div>
                    <div className="status-filter-bar">
                        <Package size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span className="filter-label">Pedido:</span>
                        {['Todos', ...ORDER_STATUS_OPTIONS].map((s) => {
                            const count = s === 'Todos' ? ordersList.length : ordersList.filter((o) => o.order_status === s).length
                            return (
                                <button key={`ord-${s}`}
                                    className={`status-filter-tab ${filterOrderStatus === s ? 'active' : ''} ${s !== 'Todos' ? `tab-${s.toLowerCase().replace(' ', '-')}` : ''}`}
                                    onClick={() => setFilterOrderStatus(s)}>
                                    {s} <span className="status-filter-count">{count}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Content */}
            {(loading && !ordersData) ? (
                <div className="empty-state"><p>Cargando...</p></div>
            ) : ordersList.length === 0 ? (
                <div className="empty-state">
                    <ShoppingBag size={48} />
                    <h3>{searchText ? 'Sin resultados' : 'No hay pedidos'}</h3>
                    <p>{searchText ? 'Intenta con otro término de búsqueda' : 'Crea el primer pedido'}</p>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="empty-state">
                    <ShoppingBag size={48} />
                    <h3>No hay pedidos con los filtros seleccionados</h3>
                    <p>Cambia los filtros para ver otros pedidos</p>
                </div>
            ) : (
                <>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>N° Boleta</th>
                                    <th>Cliente</th>
                                    <th>Fecha</th>
                                    <th>Pago</th>
                                    <th>Estado</th>
                                    <th>Total USD</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((o) => (
                                    <tr key={o.id}>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                                            {formatInvoice(o.invoice_number)}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{o.client?.name || '—'}</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            {o.order_date ? o.order_date.split('T')[0].split('-').reverse().join('-') : '—'}
                                        </td>
                                        <td>
                                            <select className={`badge ${getPaymentBadgeClass(o.payment_status)}`}
                                                style={{ border: 'none', cursor: 'pointer', fontWeight: 700 }}
                                                value={o.payment_status}
                                                onChange={(e) => handlePaymentStatusChange(o.id, e.target.value)}>
                                                {PAYMENT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td>
                                            <select className={`badge ${getOrderBadgeClass(o.order_status)}`}
                                                style={{ border: 'none', cursor: 'pointer', fontWeight: 700 }}
                                                value={o.order_status}
                                                onChange={(e) => handleOrderStatusChange(o.id, e.target.value)}>
                                                {ORDER_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ color: 'var(--success)', fontWeight: 700 }}>${o.total_usd.toFixed(2)}</td>
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

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination">
                            <button className="btn btn-secondary btn-sm" disabled={page <= 1}
                                onClick={() => setPage(page - 1)}>
                                <ChevronLeft size={14} /> Anterior
                            </button>
                            <span className="pagination-info">
                                Página {page} de {totalPages} — {totalOrders} pedidos
                            </span>
                            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages}
                                onClick={() => setPage(page + 1)}>
                                Siguiente <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ORDER FORM MODAL */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingOrder ? `Editar Pedido ${formatInvoice(editingOrder.invoice_number)}` : 'Nuevo Pedido'}</h3>
                            <button className="modal-close" onClick={closeModal}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="form-grid mb-2">
                                <div className="form-group">
                                    <label className="form-label">Cliente *</label>
                                    <ClientSearchSelect
                                        clients={clients || []}
                                        value={form.client_id}
                                        onChange={(clientId) => setForm({ ...form, client_id: clientId })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Estado de Pago</label>
                                    <select className="form-select" value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
                                        {PAYMENT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Estado del Pedido</label>
                                    <select className="form-select" value={form.order_status} onChange={(e) => setForm({ ...form, order_status: e.target.value })}>
                                        {ORDER_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Plataforma de Pago</label>
                                    <select className="form-select" value={form.payment_bank} onChange={(e) => setForm({ ...form, payment_bank: e.target.value })}>
                                        <option value="">Seleccionar</option>
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
                                    const c = calcItem(item)
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
                                            {item.base_price_usd && (
                                                <div className="item-calcs">
                                                    <div className="calc-item"><span className="calc-label">Tax USD</span><span className="calc-value">${c.tax.toFixed(3)}</span></div>
                                                    <div className="calc-item"><span className="calc-label">Comisión USD</span><span className="calc-value">${c.comm.toFixed(3)}</span></div>
                                                    <div className="calc-item"><span className="calc-label">Total USD</span><span className="calc-value" style={{ color: 'var(--primary)' }}>${c.finalUSD.toFixed(2)}</span></div>
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
                            </div>

                            <div className="form-group" style={{ margin: '1rem 0' }}>
                                <label className="form-label">Observaciones</label>
                                <textarea className="form-textarea" placeholder="Notas adicionales del pedido..." value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
