import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, ShoppingBag, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/clientes', icon: Users, label: 'Clientes' },
    { to: '/pedidos', icon: ShoppingBag, label: 'Pedidos' },
    { to: '/configuracion', icon: Settings, label: 'Configuración' },
]

export default function Layout({ children }) {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <h1>✦ Shoper</h1>
                    <p>Panel de Gestión</p>
                </div>

                <nav className="sidebar-nav">
                    <span className="sidebar-section-title">Menú Principal</span>
                    {navItems.map(({ to, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                        >
                            <Icon size={18} />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', padding: '0 0.5rem' }}>
                        {user?.username}
                    </p>
                    <button className="logout-btn" onClick={handleLogout}>
                        <LogOut size={16} />
                        Cerrar sesión
                    </button>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    )
}
