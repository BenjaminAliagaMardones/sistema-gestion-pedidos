import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Cache en memoria para las consultas API.
 * Cada entrada tiene: { data, timestamp, promise }
 */
const cache = new Map()

// Tiempo de frescura: 5 minutos (en ms)
const STALE_TIME = 5 * 60 * 1000

/**
 * Invalida todas las entradas del cache cuya key empiece con el prefijo dado.
 * Llamar esto despues de crear/editar/eliminar datos.
 * 
 * Ejemplo: invalidateCache('orders') invalida 'orders', 'orders-client_id=xxx', etc.
 * Ejemplo: invalidateCache('all') invalida todo el cache.
 */
export function invalidateCache(prefix = 'all') {
    if (prefix === 'all') {
        cache.clear()
        return
    }
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key)
        }
    }
}

/**
 * Hook para hacer consultas API con cache automatico.
 * 
 * @param {string} cacheKey - Clave unica para esta consulta
 * @param {Function} fetchFn - Funcion que retorna la Promise del fetch (debe retornar res.data)
 * @param {Object} options
 * @param {boolean} options.enabled - Si es false, no ejecuta la consulta (default: true)
 * @param {number} options.staleTime - Tiempo en ms antes de considerar datos obsoletos (default: STALE_TIME)
 * @param {Array} options.deps - Dependencias extra que fuerzan refetch si cambian
 * 
 * @returns {{ data, loading, error, refetch }}
 */
export function useCachedQuery(cacheKey, fetchFn, options = {}) {
    const { enabled = true, staleTime = STALE_TIME, deps = [] } = options
    const [data, setData] = useState(() => {
        // Inicializar con datos del cache si existen
        const cached = cache.get(cacheKey)
        return cached ? cached.data : null
    })
    const [loading, setLoading] = useState(() => {
        const cached = cache.get(cacheKey)
        if (!cached) return true
        return Date.now() - cached.timestamp > staleTime
    })
    const [error, setError] = useState(null)
    const mountedRef = useRef(true)

    const fetchData = useCallback(async (force = false) => {
        if (!enabled) return

        const cached = cache.get(cacheKey)
        const now = Date.now()

        // Si hay datos frescos en cache y no es forzado, usarlos
        if (!force && cached && (now - cached.timestamp) < staleTime) {
            if (mountedRef.current) {
                setData(cached.data)
                setLoading(false)
                setError(null)
            }
            return
        }

        // Si hay datos en cache pero obsoletos, mostrar los datos viejos mientras se carga
        if (cached) {
            if (mountedRef.current) {
                setData(cached.data)
                setLoading(false) // No mostrar loading si tenemos datos stale
            }
        } else {
            if (mountedRef.current) setLoading(true)
        }

        try {
            const result = await fetchFn()
            const newData = result.data !== undefined ? result.data : result

            cache.set(cacheKey, { data: newData, timestamp: Date.now() })

            if (mountedRef.current) {
                setData(newData)
                setError(null)
                setLoading(false)
            }
        } catch (err) {
            if (mountedRef.current) {
                setError(err)
                setLoading(false)
            }
        }
    }, [cacheKey, enabled, staleTime, fetchFn])

    useEffect(() => {
        mountedRef.current = true
        fetchData()
        return () => { mountedRef.current = false }
    }, [cacheKey, ...deps])

    const refetch = useCallback(() => fetchData(true), [fetchData])

    return { data, loading, error, refetch }
}

/**
 * Helper: ejecuta una mutacion y luego invalida caches relevantes.
 * 
 * @param {Function} mutationFn - La funcion de mutacion (create/update/delete)
 * @param {string[]} invalidateKeys - Prefijos de cache a invalidar despues
 * @returns {Promise} - El resultado de la mutacion
 */
export async function mutateAndInvalidate(mutationFn, invalidateKeys = ['all']) {
    const result = await mutationFn()
    invalidateKeys.forEach(key => invalidateCache(key))
    return result
}
