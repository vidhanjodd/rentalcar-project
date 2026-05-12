import { useState, useCallback } from 'react'

export function useApi(apiFn) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const execute = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiFn(...args)
      return result
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Something went wrong'
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }, [apiFn])

  return { execute, loading, error, setError }
}
