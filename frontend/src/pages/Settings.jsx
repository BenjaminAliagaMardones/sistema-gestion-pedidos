import { useState, useEffect } from 'react'
import { getConfig, updateConfig, uploadLogo } from '../services/api'
import toast from 'react-hot-toast'
import { Settings as SettingsIcon, Upload, Save } from 'lucide-react'

export default function Settings() {
    const [config, setConfig] = useState(null)
    const [form, setForm] = useState({ business_name: '' })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [logoFile, setLogoFile] = useState(null)

    useEffect(() => {
        getConfig()
            .then((res) => {
                setConfig(res.data)
                setForm({
                    business_name: res.data.business_name,
                })
            })
            .catch(() => toast.error('Error al cargar configuración'))
            .finally(() => setLoading(false))
    }, [])

    const handleSave = async (e) => {
        e.preventDefault()
        if (!form.business_name.trim()) {
            toast.error('El nombre del negocio es requerido')
            return
        }
        setSaving(true)
        try {
            const res = await updateConfig({
                business_name: form.business_name.trim(),
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

    if (loading) return <div className="empty-state"><p>Cargando...</p></div>

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
                            { label: 'Moneda', value: 'USD (Dólar)' },
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
                                background: 'var(--bg-elevated)',
                                borderRadius: '8px',
                                border: '1px solid transparent'
                            }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    {item.label}
                                </div>
                                <div style={{
                                    fontSize: '0.9rem', fontWeight: 600,
                                    color: 'var(--text-primary)'
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
