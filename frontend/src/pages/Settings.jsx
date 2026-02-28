import { useState, useEffect } from 'react'
import { getConfig, updateConfig, uploadLogo } from '../services/api'
import toast from 'react-hot-toast'
import { Settings as SettingsIcon, Upload, Save, RefreshCw, AlertTriangle } from 'lucide-react'

export default function Settings() {
    const [config, setConfig] = useState(null)
    const [form, setForm] = useState({ business_name: '', default_exchange_rate: '' })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [logoFile, setLogoFile] = useState(null)
    const [liveRate, setLiveRate] = useState(null)
    const [liveRateDate, setLiveRateDate] = useState(null)

    useEffect(() => {
        getConfig()
            .then((res) => {
                setConfig(res.data)
                setForm({
                    business_name: res.data.business_name,
                    default_exchange_rate: String(res.data.default_exchange_rate),
                })
            })
            .catch(() => toast.error('Error al cargar configuración'))
            .finally(() => setLoading(false))

        // Fetch live dollar rate
        fetch('https://mindicador.cl/api/dolar')
            .then((r) => r.json())
            .then((data) => {
                if (data?.serie?.length > 0) {
                    setLiveRate(data.serie[0].valor)
                    setLiveRateDate(new Date(data.serie[0].fecha).toLocaleDateString('es-CL'))
                }
            })
            .catch(() => { })
    }, [])

    const handleSave = async (e) => {
        e.preventDefault()
        if (!form.business_name.trim()) {
            toast.error('El nombre del negocio es requerido')
            return
        }
        if (!form.default_exchange_rate || parseFloat(form.default_exchange_rate) <= 0) {
            toast.error('La tasa de cambio debe ser mayor a 0')
            return
        }
        setSaving(true)
        try {
            const res = await updateConfig({
                business_name: form.business_name.trim(),
                default_exchange_rate: parseFloat(form.default_exchange_rate),
            })
            setConfig(res.data)
            toast.success('Configuración guardada')
        } catch {
            toast.error('Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    const handleLogoUpload = async () => {
        if (!logoFile) return
        setUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', logoFile)
            const res = await uploadLogo(fd)
            setConfig(res.data)
            toast.success('Logo subido correctamente')
            setLogoFile(null)
        } catch {
            toast.error('Error al subir logo')
        } finally {
            setUploading(false)
        }
    }

    const syncLiveRate = () => {
        if (liveRate) {
            setForm({ ...form, default_exchange_rate: String(liveRate) })
            toast.success(`Tasa actualizada a $${liveRate.toLocaleString('es-CL', { minimumFractionDigits: 2 })}`)
        }
    }

    if (loading) return <div className="empty-state"><p>Cargando...</p></div>

    const savedRate = parseFloat(form.default_exchange_rate) || 0
    const rateDiff = liveRate ? ((savedRate - liveRate) / liveRate * 100).toFixed(1) : null
    const rateIsOutdated = rateDiff && Math.abs(rateDiff) > 3

    return (
        <div>
            <div className="page-header">
                <h2 className="page-title">Configuración</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', maxWidth: '900px' }}>
                {/* Business Info */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <SettingsIcon size={18} style={{ color: 'var(--primary)' }} />
                        Información del Negocio
                    </h3>
                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">Nombre del Negocio *</label>
                            <input
                                className="form-input"
                                placeholder="Kebexpo"
                                value={form.business_name}
                                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                            />
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Este nombre aparecerá en las boletas PDF
                            </span>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tasa de Cambio por Defecto (USD → CLP) *</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="form-input"
                                        placeholder="860"
                                        value={form.default_exchange_rate}
                                        onChange={(e) => setForm({ ...form, default_exchange_rate: e.target.value })}
                                    />
                                </div>
                                {liveRate && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={syncLiveRate}
                                        title="Sincronizar con precio en vivo"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '2px' }}
                                    >
                                        <RefreshCw size={13} />
                                        Usar actual
                                    </button>
                                )}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Se usa como valor inicial al crear un pedido nuevo
                            </span>
                            {rateIsOutdated && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                                    fontSize: '0.75rem', color: 'var(--warning, #F59E0B)',
                                    marginTop: '0.25rem', padding: '0.35rem 0.5rem',
                                    background: 'rgba(245,158,11,0.1)', borderRadius: '6px'
                                }}>
                                    <AlertTriangle size={13} />
                                    Tu tasa guardada difiere un {Math.abs(rateDiff)}% del precio actual (${liveRate?.toLocaleString('es-CL', { minimumFractionDigits: 2 })})
                                </div>
                            )}
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            <Save size={16} />
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </form>
                </div>

                {/* Logo */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Upload size={18} style={{ color: 'var(--primary)' }} />
                        Logo del Negocio
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        El logo aparecerá en las boletas PDF generadas. Formatos: JPG, PNG, WebP.
                    </p>

                    {config?.logo_path && (
                        <div style={{
                            marginBottom: '1rem', padding: '0.75rem 1rem',
                            background: 'rgba(16,185,129,0.1)', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            border: '1px solid rgba(16,185,129,0.2)'
                        }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>✓ Logo configurado</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({config.logo_path.split('/').pop()})</span>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="logo-upload"
                            onChange={(e) => setLogoFile(e.target.files[0])}
                        />
                        <label htmlFor="logo-upload" className="btn btn-secondary" style={{ cursor: 'pointer', justifyContent: 'center' }}>
                            <Upload size={16} />
                            {logoFile ? logoFile.name : 'Seleccionar imagen'}
                        </label>
                        {logoFile && (
                            <button className="btn btn-primary" onClick={handleLogoUpload} disabled={uploading}>
                                {uploading ? 'Subiendo...' : 'Subir Logo'}
                            </button>
                        )}
                    </div>
                </div>

                {/* System Info */}
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>ℹ️ Información del Sistema</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
                        {[
                            { label: 'Negocio', value: config?.business_name || '—' },
                            { label: 'Moneda Base', value: 'USD (Dólar)' },
                            { label: 'Moneda Destino', value: 'CLP (Peso Chileno)' },
                            {
                                label: 'Tasa Guardada',
                                value: `$${parseFloat(config?.default_exchange_rate || 0).toLocaleString('es-CL')} CLP/USD`
                            },
                            {
                                label: 'Dólar Hoy (En Vivo)',
                                value: liveRate
                                    ? `$${liveRate.toLocaleString('es-CL', { minimumFractionDigits: 2 })} CLP/USD`
                                    : 'Cargando...',
                                highlight: true,
                            },
                            {
                                label: 'Última Actualización',
                                value: config?.updated_at
                                    ? new Date(config.updated_at).toLocaleDateString('es-CL', {
                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    })
                                    : '—'
                            },
                        ].map((item) => (
                            <div key={item.label} style={{
                                padding: '0.75rem',
                                background: item.highlight ? 'rgba(16,185,129,0.08)' : 'var(--bg-elevated)',
                                borderRadius: '8px',
                                border: item.highlight ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent'
                            }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    {item.label}
                                </div>
                                <div style={{
                                    fontSize: '0.9rem', fontWeight: 600,
                                    color: item.highlight ? 'var(--success)' : 'var(--text-primary)'
                                }}>
                                    {item.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
