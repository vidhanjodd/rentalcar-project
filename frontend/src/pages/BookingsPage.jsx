import { useState, useEffect, useCallback } from 'react'
import { getMyBookings, confirmBooking, cancelBooking } from '../api/bookings'
import BookingCard from '../components/BookingCard'
import Pagination from '../components/Pagination'

export default function BookingsPage() {
  const [data, setData] = useState(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (p = 0) => {
    setLoading(true)
    try {
      const { data: res } = await getMyBookings(p, 10)
      setData(res)
      setPage(p)
    } catch {
      setError('Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleConfirm = async (id) => {
    setActionLoading(true)
    try {
      await confirmBooking(id)
      load(page)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to confirm')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async (id) => {
    const reason = window.prompt('Reason for cancellation (optional):')
    if (reason === null) return
    setActionLoading(true)
    try {
      await cancelBooking(id, reason || undefined)
      load(page)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to cancel')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-black text-gray-900 mb-6">My Bookings</h1>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading bookings...</div>
      ) : data?.content?.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-lg font-medium">No bookings yet</p>
          <p className="text-sm mt-1">Search for a car to get started</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {data.content.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                loading={actionLoading}
              />
            ))}
          </div>
          <Pagination page={page} totalPages={data.totalPages} onChange={load} />
        </>
      )}
    </div>
  )
}
