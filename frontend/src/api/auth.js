import axios from 'axios'
import api from './axios'

// Raw axios for refresh — must not go through the api interceptor.
// If it did, a 401 from the refresh endpoint would re-trigger the interceptor
// causing a second wasted refresh attempt before redirecting to login.
// No body — refresh token is in the httpOnly cookie, sent automatically.
export const refresh = () =>
  axios.post('/api/auth/refresh', {}, { withCredentials: true })

export const login = (data) => api.post('/api/auth/login', data)
export const register = (data) => api.post('/api/auth/register', data)
export const logout = () => api.post('/api/auth/logout')
export const me = () => api.get('/api/auth/me')
export const changePassword = (data) => api.put('/api/auth/change-password', data)
