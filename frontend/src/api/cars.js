import api from './axios'

export const searchCars = (params) => api.get('/api/cars/search', { params })
export const getCarById = (id) => api.get(`/api/cars/${id}`)
export const getCities = () => api.get('/api/cars/cities')

export const adminCreateCar = (data) => api.post('/api/admin/cars', data)
export const adminUpdateCar = (id, data) => api.put(`/api/admin/cars/${id}`, data)
export const adminUpdateCarStatus = (id, status) =>
  api.patch(`/api/admin/cars/${id}/status`, null, { params: { status } })
export const adminDeleteCar = (id) => api.delete(`/api/admin/cars/${id}`)
