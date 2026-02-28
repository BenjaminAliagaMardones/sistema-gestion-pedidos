import { useState, useEffect } from 'react'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { getDashboardMetrics, getMonthlyData, getTopClients } from '../services/api'
import {
    DollarSign, TrendingUp, ShoppingBag, Users, Award, Calendar, Activity
} from 'lucide-react'

const formatUSD = (v) => `$${Number(v).toFixed(2)}`
const formatCLP = (v) => `$ ${Math.floor(v).toLocaleString('es-CL')}`

export default function Dashboard() {
    const [metrics, setMetrics] = useState(null)
    const [monthly, setMonthly] = useState([])
    const [topClients, setTopClients] = useState([])
    const [loading, setLoading] = useState(true)
    const [dollarRate, setDollarRate] = useState(null)
    const year = new Date().getFullYear()

    useEffect(() => {
        Promise.all([
            getDashboardMetrics(),
            getMonthlyData(year),
            getTopClients(),
        ]).then(([m, mo, tc]) => {
            setMetrics(m.data)
            setMonthly(mo.data)
            setTopClients(tc.data)
        }).finally(() => setLoading(false))

        // Fetch live dollar rate
        fetch('https://mindicador.cl/api/dolar')
            .then(r => r.json())
            .then(data => {
                if (data?.serie?.length > 0) setDollarRate(data.serie[0].valor)
            })
            .catch(() => { })
    }, [])

    if (loading) return (
        <div className="empty-state">
            <p>Cargando dashboard...</p>
        </div>
    )

    const kpis = [
        { label: 'Dólar Hoy', value: dollarRate ? `$${dollarRate.toLocaleString('es-CL', { minimumFractionDigits: 2 })}` : '...', sub: 'CLP / En vivo', icon: Activity, color: '#10B981', live: true },
        { label: 'Facturación Total', value: formatUSD(metrics?.total_revenue_usd || 0), sub: 'Total histórico', icon: DollarSign, color: '#6C63FF' },
        { label: 'Ganancias Totales', value: formatUSD(metrics?.total_profit_usd || 0), sub: 'Total histórico', icon: TrendingUp, color: '#10B981' },
        { label: 'Total Pedidos', value: metrics?.total_orders || 0, sub: 'Pedidos activos', icon: ShoppingBag, color: '#F59E0B' },
        { label: 'Clientes', value: metrics?.total_clients || 0, sub: 'Registrados', icon: Users, color: '#3B82F6' },
        { label: 'Ticket Promedio', value: formatUSD(metrics?.avg_ticket_usd || 0), sub: 'Por pedido', icon: Award, color: '#EC4899' },
        { label: 'Ventas del Mes', value: formatUSD(metrics?.monthly_revenue_usd || 0), sub: `${metrics?.monthly_orders || 0} pedidos este mes`, icon: Calendar, color: '#14B8A6' },
    ]

    const customTooltipStyle = {
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        color: 'var(--text-primary)',
        fontSize: '0.8rem',
    }

    return (
        <div>
            <div className="page-header">
                <h2 className="page-title">Dashboard</h2>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Año {year}</span>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                {kpis.map((kpi) => {
                    const Icon = kpi.icon
                    return (
                        <div key={kpi.label} className="kpi-card" style={{ '--kpi-color': kpi.color }}>
                            <div className="kpi-icon"><Icon size={40} /></div>
                            <div className="kpi-label">
                                {kpi.label}
                                {kpi.live && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        marginLeft: '6px', padding: '1px 6px', borderRadius: '99px',
                                        background: 'rgba(16,185,129,0.15)', color: '#10B981',
                                        fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                                        verticalAlign: 'middle'
                                    }}>
                                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', animation: 'ratePulse 2s ease-in-out infinite' }}></span>
                                        Live
                                    </span>
                                )}
                            </div>
                            <div className="kpi-value">{kpi.value}</div>
                            <div className="kpi-sub">{kpi.sub}</div>
                        </div>
                    )
                })}
            </div>

            {/* Charts */}
            <div className="charts-grid">
                <div className="chart-card">
                    <div className="chart-header">
                        <span className="chart-title">📈 Ventas Mensuales (USD)</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={monthly}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="month" tick={{ fill: '#9898BB', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#9898BB', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                            <Tooltip contentStyle={customTooltipStyle} formatter={(v) => [`$${v}`, 'Ventas']} />
                            <Area type="monotone" dataKey="revenue" stroke="#6C63FF" strokeWidth={2} fill="url(#colorRevenue)" dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card">
                    <div className="chart-header">
                        <span className="chart-title">💰 Ganancias Mensuales (USD)</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={monthly}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="month" tick={{ fill: '#9898BB', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#9898BB', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                            <Tooltip contentStyle={customTooltipStyle} formatter={(v) => [`$${v}`, 'Ganancia']} />
                            <Bar dataKey="profit" fill="#10B981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Clients */}
            <div className="card">
                <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                    🏆 Top Clientes
                </h3>
                {topClients.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sin datos aún</p>
                ) : (
                    <div className="table-container" style={{ border: 'none' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Cliente</th>
                                    <th>Teléfono</th>
                                    <th>Pedidos</th>
                                    <th>Total USD</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topClients.map((c, i) => (
                                    <tr key={c.id}>
                                        <td>
                                            <span style={{
                                                background: i === 0 ? '#F59E0B' : i === 1 ? '#9898BB' : i === 2 ? '#CD7F32' : 'var(--bg-elevated)',
                                                borderRadius: '99px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700
                                            }}>
                                                #{i + 1}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                                        <td style={{ color: 'var(--text-muted)' }}>{c.phone}</td>
                                        <td>{c.total_orders}</td>
                                        <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                                            {formatUSD(c.total_spent_usd)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
