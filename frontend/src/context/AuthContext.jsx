import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as authApi from '../api/auth'
import { setAccessToken, clearAccessToken, setNavigate } from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [tokenPresent, setTokenPresent] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const navigate = useNavigate()

  // Wire navigate into the axios interceptor so expired-session 401s do a
  // soft React Router redirect instead of a hard full-page reload.
  useEffect(() => {
    setNavigate(navigate)
  }, [navigate])

  useEffect(() => {
    // Always attempt refresh on mount — browser sends the httpOnly cookie automatically.
    // If no cookie exists or it's expired, backend returns 401 and we stay logged out.
    authApi.refresh()
      .then(({ data }) => {
        setAccessToken(data.accessToken)
        setTokenPresent(true)
        setUser({ id: data.userId, username: data.username, email: data.email, role: data.role })
      })
      .catch(() => {})
      .finally(() => setInitializing(false))
  }, [])

  const login = useCallback(async (credentials) => {
    const { data } = await authApi.login(credentials)
    setAccessToken(data.accessToken)
    setTokenPresent(true)
    setUser({ id: data.userId, username: data.username, email: data.email, role: data.role })
    return data
  }, [])

  const register = useCallback(async (payload) => {
    const { data } = await authApi.register(payload)
    return data
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch (_) {}
    clearAccessToken()
    setTokenPresent(false)
    setUser(null)
    // No localStorage to clear — refresh token lives in httpOnly cookie.
    // Backend clears it via Set-Cookie: refresh_token=; maxAge=0 on /api/auth/logout.
  }, [])

  const isAdmin = user?.role === 'ROLE_ADMIN'
  const isAuthenticated = tokenPresent

  if (initializing) return null

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAdmin, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
