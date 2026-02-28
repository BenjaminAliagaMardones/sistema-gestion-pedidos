import { useState, useEffect, useCallback } from 'react'
import { getClients, createClient, updateClient, deleteClient } from '../services/api'
import { Plus, Search, Edit2, Trash2, X, User, Phone, Mail, MapPin, Eye, ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

const emptyForm = { name: '', phone: '', email: '', address: '' }

export default function Clients() {
    const [clients, setClients] = useState([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const navigate = useNavigate()

    const fetchClients = useCallback(async () => {
        try {
            const res = await getClients(search)
            setClients(res.data)
        } catch {
            toast.error('Error al cargar clientes')
        } finally {
            setLoading(false)
        }
    }, [search])

    useEffect(() => {
        const t = setTimeout(fetchClients, 300)
        return () => clearTimeout(t)
    }, [fetchClients])

    const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true) }
    const openEdit = (c) => { setEditing(c); setForm({ name: c.name, phone: c.phone, email: c.email || '', address: c.address || '' }); setShowModal(true) }
    const closeModal = () => setShowModal(false)

    const handleSave = async (e) => {
        e.preventDefault()
        if (!form.name || !form.phone) { toast.error('Nombre y teléfono son requeridos'); return }
        setSaving(true)
        try {
            if (editing) {
                await updateClient(editing.id, form)
                toast.success('Cliente actualizado')
            } else {
                await createClient(form)
                toast.success('Cliente creado')
            }
            closeModal()
            fetchClients()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id, name) => {
        if (!confirm(`¿Eliminar a ${name}? Esta acción también eliminará sus pedidos.`)) return
        try {
            await deleteClient(id)
            toast.success('Cliente eliminado')
            fetchClients()
        } catch {
            toast.error('Error al eliminar')
        }
    }

    return (
        <div>
            <div className="page-header">
                <h2 className="page-title">Clientes</h2>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={16} /> Nuevo Cliente
                </button>
            </div>

            {/* Search */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div className="search-bar" style={{ maxWidth: '400px' }}>
                    <Search size={16} style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, teléfono o email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="empty-state"><p>Cargando...</p></div>
            ) : clients.length === 0 ? (
                <div className="empty-state">
                    <User size={48} />
                    <h3>No hay clientes</h3>
                    <p>Crea el primer cliente para comenzar</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Teléfono</th>
                                <th>Email</th>
                                <th>Pedidos</th>
                                <th>Total USD</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map((c) => (
                                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/pedidos?client_id=${c.id}&client_name=${encodeURIComponent(c.name)}`)}>
                                    <td>
                                        <span style={{ fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>{c.name}</span>
                                        {c.address && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.address}</div>}
                                    </td>
                                    <td>{c.phone}</td>
                                    <td style={{ color: 'var(--text-muted)' }}>{c.email || '—'}</td>
                                    <td>
                                        <button
                                            onClick={() => navigate(`/pedidos?client_id=${c.id}&client_name=${encodeURIComponent(c.name)}`)}
                                            style={{ background: 'rgba(108,99,255,0.1)', border: 'none', borderRadius: '6px', padding: '3px 10px', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                                        >
                                            {c.total_orders}
                                        </button>
                                    </td>
                                    <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                                        ${c.total_spent_usd.toFixed(2)}
                                    </td>
                                    <td>
                                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                            <button className="btn btn-primary btn-sm" title="Ver pedidos" onClick={() => navigate(`/pedidos?client_id=${c.id}&client_name=${encodeURIComponent(c.name)}`)}>
                                                <ShoppingBag size={14} />
                                            </button>
                                            <button className="btn btn-secondary btn-sm" title="Editar" onClick={() => openEdit(c)}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="btn btn-danger btn-sm" title="Eliminar" onClick={() => handleDelete(c.id, c.name)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                            <button className="modal-close" onClick={closeModal}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Nombre *</label>
                                <input className="form-input" placeholder="Nombre completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Teléfono *</label>
                                <input className="form-input" placeholder="+56 9 1234 5678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email (opcional)</label>
                                <input className="form-input" type="email" placeholder="correo@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Dirección (opcional)</label>
                                <input className="form-input" placeholder="Dirección de entrega" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                            </div>
                            <div className="flex gap-1" style={{ marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={closeModal} style={{ flex: 1 }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                                    {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Cliente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
