import api from './axios'

export const login = (data) => api.post('/api/auth/login', data)
export const register = (data) => api.post('/api/auth/register', data)
export const refresh = (refreshToken) => api.post('/api/auth/refresh', { refreshToken })
export const logout = () => api.post('/api/auth/logout')
export const me = () => api.get('/api/auth/me')
export const changePassword = (data) => api.put('/api/auth/change-password', data)
