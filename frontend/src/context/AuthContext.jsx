import { createContext, useContext, useState, useCallback } from 'react'
import { login as loginApi } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const token = localStorage.getItem('token')
        const username = localStorage.getItem('username')
        return token ? { token, username } : null
    })

    const loginFn = useCallback(async (username, password) => {
        const response = await loginApi(username, password)
        const { access_token, username: uname } = response.data
        localStorage.setItem('token', access_token)
        localStorage.setItem('username', uname)
        setUser({ token: access_token, username: uname })
        return response.data
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('username')
        setUser(null)
    }, [])

    return (
        <AuthContext.Provider value={{ user, login: loginFn, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
    return ctx
}
