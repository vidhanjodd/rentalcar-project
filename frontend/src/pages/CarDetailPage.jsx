import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getCarById } from '../api/cars'
import { createBooking } from '../api/bookings'
import { useAuth } from '../context/AuthContext'

export default function CarDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [car, setCar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [error, setError] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [form, setForm] = useState({
    startDate: tomorrow, endDate: '', pickupLocation: '', dropoffLocation: '', notes: ''
  })

  useEffect(() => {
    getCarById(id)
      .then((r) => setCar(r.data))
      .catch(() => setError('Car not found'))
      .finally(() => setLoading(false))
  }, [id])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const days = form.startDate && form.endDate
    ? Math.max(0, Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / 86400000))
    : 0

  const estimatedPrice = car ? (car.dailyRate * days).toFixed(2) : 0

  const handleBook = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (days <= 0) {
      setBookingError('Drop-off date must be after pick-up date')
      return
    }
    setBookingError('')
    setBookingLoading(true)
    try {
      await createBooking({ carId: id, ...form })
      navigate('/bookings')
    } catch (e) {
      setBookingError(e.response?.data?.message || 'Booking failed')
    } finally {
      setBookingLoading(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  if (error || !car) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500">{error || 'Car not found'}</p>
        <Link to="/" className="text-primary text-sm mt-2 inline-block hover:underline">← Back to search</Link>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link to="/" className="text-primary text-sm hover:underline inline-flex items-center gap-1 mb-6">
        ← Back to search
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Car info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gray-100 h-64 flex items-center justify-center">
              {car.imageUrl ? (
                <img src={car.imageUrl} alt={`${car.brand} ${car.model}`} className="w-full h-full object-cover" />
              ) : (
                <div className="text-gray-400 text-center">
                  <svg className="w-20 h-20 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8 17l-2-2H4a2 2 0 01-2-2V7a2 2 0 012-2h16a2 2 0 012 2v6a2 2 0 01-2 2h-2l-2 2m-4 0h4m-4 0v-4" />
                  </svg>
                  <p>{car.brand} {car.model}</p>
                </div>
              )}
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-black text-gray-900">{car.brand} {car.model}</h1>
                  <p className="text-gray-500">{car.year} · {car.city} · {car.category}</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-gray-900">₹{Number(car.dailyRate).toLocaleString()}</span>
                  <span className="text-gray-400 text-sm">/day</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                {[
                  { label: 'Seats', value: car.seats },
                  { label: 'Transmission', value: car.transmission },
                  { label: 'Fuel', value: car.fuelType },
                  { label: 'Color', value: car.color },
                ].filter(i => i.value).map((item) => (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                    <p className="font-semibold text-gray-900 text-sm">{item.value}</p>
                  </div>
                ))}
              </div>

              {car.description && (
                <p className="text-gray-600 text-sm mt-4 leading-relaxed">{car.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Booking form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sticky top-20">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Book this car</h2>
            <form onSubmit={handleBook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pick-up Date</label>
                <input type="date" required value={form.startDate} min={tomorrow} onChange={set('startDate')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Drop-off Date</label>
                <input type="date" required value={form.endDate} min={form.startDate || tomorrow} onChange={set('endDate')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pick-up Location <span className="text-gray-400">(optional)</span></label>
                <input type="text" value={form.pickupLocation} onChange={set('pickupLocation')} placeholder="e.g. Airport Terminal 1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Drop-off Location <span className="text-gray-400">(optional)</span></label>
                <input type="text" value={form.dropoffLocation} onChange={set('dropoffLocation')} placeholder="e.g. City Centre"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes <span className="text-gray-400">(optional)</span></label>
                <textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Special requests..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none" />
              </div>

              {days > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>₹{Number(car.dailyRate).toLocaleString()} × {days} day{days !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900">
                    <span>Estimated Total</span>
                    <span>₹{Number(estimatedPrice).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Final price confirmed at checkout</p>
                </div>
              )}

              {bookingError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {bookingError}
                </p>
              )}

              <button type="submit" disabled={bookingLoading || car.status !== 'AVAILABLE'}
                className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors">
                {bookingLoading ? 'Booking...' : car.status !== 'AVAILABLE' ? 'Not Available' : isAuthenticated ? 'Confirm Booking' : 'Login to Book'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
