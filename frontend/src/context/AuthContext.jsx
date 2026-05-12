import { createContext, useContext, useState, useCallback } from 'react'
import * as authApi from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState(null)

  const login = useCallback(async (credentials) => {
    const { data } = await authApi.login(credentials)
    window.__accessToken = data.accessToken
    setAccessToken(data.accessToken)
    setUser(data.user)
    localStorage.setItem('refreshToken', data.refreshToken)
    return data
  }, [])

  const register = useCallback(async (payload) => {
    const { data } = await authApi.register(payload)
    return data
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch (_) {}
    window.__accessToken = null
    setAccessToken(null)
    setUser(null)
    localStorage.removeItem('refreshToken')
  }, [])

  const isAdmin = user?.role === 'ROLE_ADMIN'
  const isAuthenticated = !!accessToken

  return (
    <AuthContext.Provider value={{ user, accessToken, login, register, logout, isAdmin, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
