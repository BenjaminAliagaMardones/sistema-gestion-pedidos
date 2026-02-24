import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor: attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle 401 → redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ─── AUTH ───────────────────────────────────────────────
export const login = (username, password) =>
  api.post('/api/auth/login', { username, password })

// ─── CLIENTS ─────────────────────────────────────────────
export const getClients = (search = '') =>
  api.get('/api/clients/', { params: search ? { search } : {} })
export const getClient = (id) => api.get(`/api/clients/${id}`)
export const createClient = (data) => api.post('/api/clients/', data)
export const updateClient = (id, data) => api.put(`/api/clients/${id}`, data)
export const deleteClient = (id) => api.delete(`/api/clients/${id}`)

// ─── ORDERS ──────────────────────────────────────────────
export const getOrders = (params = {}) => api.get('/api/orders/', { params })
export const getOrder = (id) => api.get(`/api/orders/${id}`)
export const createOrder = (data) => api.post('/api/orders/', data)
export const updateOrder = (id, data) => api.put(`/api/orders/${id}`, data)
export const deleteOrder = (id) => api.delete(`/api/orders/${id}`)
export const getOrderPdfUrl = (id) => `${API_URL}/api/orders/${id}/pdf`

// ─── DASHBOARD ───────────────────────────────────────────
export const getDashboardMetrics = () => api.get('/api/dashboard/metrics')
export const getMonthlyData = (year) => api.get('/api/dashboard/monthly', { params: { year } })
export const getTopClients = () => api.get('/api/dashboard/top-clients')

// ─── CONFIG ──────────────────────────────────────────────
export const getConfig = () => api.get('/api/config/')
export const updateConfig = (data) => api.put('/api/config/', data)
export const uploadLogo = (formData) =>
  api.post('/api/config/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

export default api
