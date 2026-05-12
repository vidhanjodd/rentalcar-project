import api from './axios'

export const createBooking = (data) => api.post('/api/bookings', data)
export const getMyBookings = (page = 0, size = 10) =>
  api.get('/api/bookings/my', { params: { page, size } })
export const getBookingById = (id) => api.get(`/api/bookings/${id}`)
export const confirmBooking = (id) => api.patch(`/api/bookings/${id}/confirm`)
export const cancelBooking = (id, reason) =>
  api.patch(`/api/bookings/${id}/cancel`, null, { params: reason ? { reason } : {} })

export const adminGetBookings = (params) => api.get('/api/admin/bookings', { params })
export const adminCompleteBooking = (id) => api.patch(`/api/admin/bookings/${id}/complete`)
export const adminForceCancel = (id, reason) =>
  api.post(`/api/admin/bookings/${id}/force-cancel`, { reason })
export const adminGetAudit = (entityType, entityId, page = 0) =>
  api.get(`/api/admin/audit/${entityType}/${entityId}`, { params: { page, size: 20 } })
