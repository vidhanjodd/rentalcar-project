import { useState, useEffect, useCallback } from 'react'
import { adminGetBookings, adminCompleteBooking, adminForceCancel, adminGetAudit } from '../api/bookings'
import { adminListCars, adminCreateCar, adminUpdateCar, adminUpdateCarStatus, adminDeleteCar } from '../api/cars'
import StatusBadge from '../components/StatusBadge'
import Pagination from '../components/Pagination'

const TABS = ['Fleet', 'Bookings', 'Audit']

const CAR_STATUSES = ['AVAILABLE', 'MAINTENANCE', 'RETIRED']
const BOOKING_STATUSES = ['', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']

const emptyCarForm = {
  brand: '', model: '', year: new Date().getFullYear(), licensePlate: '',
  category: 'SEDAN', color: '', dailyRate: '', city: '', seats: 5,
  transmission: 'MANUAL', fuelType: 'PETROL', description: '', imageUrl: ''
}

export default function AdminPage() {
  const [tab, setTab] = useState('Fleet')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Admin Dashboard</h1>

      <div className="flex gap-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Fleet' && <FleetTab />}
      {tab === 'Bookings' && <BookingsTab />}
      {tab === 'Audit' && <AuditTab />}
    </div>
  )
}

function FleetTab() {
  const [cars, setCars] = useState(null)
  const [page, setPage] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editCar, setEditCar] = useState(null)
  const [form, setForm] = useState(emptyCarForm)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadCars = useCallback(async (p = 0) => {
    setListLoading(true)
    try {
      const { data } = await adminListCars(p, 20)
      setCars(data)
      setPage(p)
    } catch {
      setError('Failed to load fleet')
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => { loadCars() }, [loadCars])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const openCreate = () => { setEditCar(null); setForm(emptyCarForm); setShowForm(true); setError('') }
  const openEdit = (car) => { setEditCar(car); setForm({ ...car, dailyRate: car.dailyRate }); setShowForm(true); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (editCar) {
        await adminUpdateCar(editCar.id, form)
        setSuccess('Car updated')
      } else {
        await adminCreateCar(form)
        setSuccess('Car added to fleet')
      }
      setShowForm(false)
      loadCars(page)
    } catch (e) {
      setError(e.response?.data?.message || 'Operation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (car, status) => {
    try {
      await adminUpdateCarStatus(car.id, status)
      setSuccess(`${car.brand} ${car.model} → ${status}`)
      loadCars(page)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update status')
    }
  }

  const handleDelete = async (car) => {
    if (!window.confirm(`Delete ${car.brand} ${car.model} (${car.licensePlate})?`)) return
    try {
      await adminDeleteCar(car.id)
      setSuccess('Car removed from fleet')
      loadCars(page)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete car')
    }
  }

  const STATUS_COLORS = {
    AVAILABLE: 'bg-green-100 text-green-700',
    BOOKED: 'bg-blue-100 text-blue-700',
    MAINTENANCE: 'bg-yellow-100 text-yellow-700',
    RETIRED: 'bg-gray-100 text-gray-500',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Manage fleet — add, edit, or change car status.</p>
        <button onClick={openCreate}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors">
          + Add Car
        </button>
      </div>

      {success && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-4">{success}</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">{error}</p>}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">{editCar ? 'Edit Car' : 'Add New Car'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { k: 'brand', label: 'Brand', required: true },
              { k: 'model', label: 'Model', required: true },
              { k: 'year', label: 'Year', type: 'number', required: true },
              { k: 'licensePlate', label: 'License Plate', required: true },
              { k: 'color', label: 'Color' },
              { k: 'dailyRate', label: 'Daily Rate (₹)', type: 'number', required: true },
              { k: 'city', label: 'City', required: true },
              { k: 'seats', label: 'Seats', type: 'number' },
              { k: 'imageUrl', label: 'Image URL' },
            ].map(({ k, label, type = 'text', required }) => (
              <div key={k}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type} required={required} value={form[k]} onChange={set(k)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
            ))}
            {[
              { k: 'category', label: 'Category', opts: ['SUV', 'SEDAN', 'HATCHBACK'] },
              { k: 'transmission', label: 'Transmission', opts: ['MANUAL', 'AUTOMATIC'] },
              { k: 'fuelType', label: 'Fuel Type', opts: ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID'] },
            ].map(({ k, label, opts }) => (
              <div key={k}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <select value={form[k]} onChange={set(k)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                  {opts.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea rows={2} value={form.description} onChange={set('description')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3 pt-2">
              <button type="submit" disabled={loading}
                className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-60 transition-colors">
                {loading ? 'Saving...' : editCar ? 'Update Car' : 'Add Car'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="border border-gray-300 text-gray-600 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {listLoading ? (
        <div className="text-center py-10 text-gray-400">Loading fleet...</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {['Car', 'Plate', 'City', 'Category', 'Daily Rate', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cars?.content?.map((car) => (
                  <tr key={car.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{car.brand} {car.model}</p>
                      <p className="text-gray-400 text-xs">{car.year} · {car.color}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{car.licensePlate}</td>
                    <td className="px-4 py-3 text-gray-600">{car.city}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{car.category}</td>
                    <td className="px-4 py-3 font-semibold">₹{Number(car.dailyRate).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <select
                        value={car.status}
                        onChange={(e) => handleStatusChange(car, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded border-0 outline-none cursor-pointer ${STATUS_COLORS[car.status] || 'bg-gray-100 text-gray-600'}`}
                      >
                        {CAR_STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(car)}
                          className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded text-xs font-medium hover:bg-gray-200 transition-colors">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(car)}
                          className="bg-red-50 text-red-600 px-2.5 py-1 rounded text-xs font-medium hover:bg-red-100 transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!cars?.content?.length && (
              <div className="text-center py-10 text-gray-400">No cars in fleet</div>
            )}
          </div>
          {cars && <Pagination page={page} totalPages={cars.totalPages} onChange={loadCars} />}
        </>
      )}
    </div>
  )
}

function BookingsTab() {
  const [bookings, setBookings] = useState(null)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState({ status: '', userEmail: '', from: '', to: '' })
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (p = 0) => {
    setLoading(true)
    const params = { page: p, size: 15 }
    if (filters.status) params.status = filters.status
    if (filters.userEmail) params.userEmail = filters.userEmail
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    try {
      const { data } = await adminGetBookings(params)
      setBookings(data)
      setPage(p)
    } catch {
      setError('Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { load() }, [load])

  const handleComplete = async (id) => {
    setActionLoading(true)
    try { await adminCompleteBooking(id); load(page) }
    catch (e) { setError(e.response?.data?.message || 'Failed') }
    finally { setActionLoading(false) }
  }

  const handleForceCancel = async (id) => {
    const reason = window.prompt('Reason for force cancellation:')
    if (!reason) return
    setActionLoading(true)
    try { await adminForceCancel(id, reason); load(page) }
    catch (e) { setError(e.response?.data?.message || 'Failed') }
    finally { setActionLoading(false) }
  }

  const setF = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <select value={filters.status} onChange={setF('status')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
          {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
        <input placeholder="User email" value={filters.userEmail} onChange={setF('userEmail')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
        <input type="date" placeholder="From" value={filters.from} onChange={setF('from')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
        <input type="date" placeholder="To" value={filters.to} onChange={setF('to')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">{error}</p>}

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {['User', 'Car', 'Dates', 'Total', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings?.content?.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{b.username}</p>
                      <p className="text-gray-400 text-xs">{b.userEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.carBrand} {b.carModel}</p>
                      <p className="text-gray-400 text-xs">{b.licensePlate}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {b.startDate} → {b.endDate}
                      <p className="text-gray-400 text-xs">{b.numberOfDays}d</p>
                    </td>
                    <td className="px-4 py-3 font-semibold">₹{Number(b.totalPrice).toLocaleString()}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {b.status === 'CONFIRMED' && (
                          <button disabled={actionLoading} onClick={() => handleComplete(b.id)}
                            className="bg-green-600 text-white px-2.5 py-1 rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                            Complete
                          </button>
                        )}
                        {['PENDING', 'CONFIRMED'].includes(b.status) && (
                          <button disabled={actionLoading} onClick={() => handleForceCancel(b.id)}
                            className="bg-red-600 text-white px-2.5 py-1 rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                            Force Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!bookings?.content?.length && (
              <div className="text-center py-10 text-gray-400">No bookings found</div>
            )}
          </div>
          {bookings && <Pagination page={page} totalPages={bookings.totalPages} onChange={load} />}
        </>
      )}
    </div>
  )
}

function AuditTab() {
  const [entityType, setEntityType] = useState('Booking')
  const [entityId, setEntityId] = useState('')
  const [logs, setLogs] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!entityId.trim()) return
    setLoading(true)
    setError('')
    try {
      const { data } = await adminGetAudit(entityType, entityId.trim())
      setLogs(data)
    } catch {
      setError('No audit logs found or invalid ID')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
          <option>Booking</option>
          <option>Car</option>
        </select>
        <input value={entityId} onChange={(e) => setEntityId(e.target.value)}
          placeholder="Paste entity UUID"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
        <button type="submit" disabled={loading}
          className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-60 transition-colors">
          {loading ? 'Loading...' : 'Search'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">{error}</p>}

      {logs?.content?.length > 0 && (
        <div className="space-y-3">
          {logs.content.map((log) => (
            <div key={log.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900 text-sm">{log.action}</span>
                <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-500">by <span className="font-medium text-gray-700">{log.actor}</span></p>
              {log.details && <p className="text-xs text-gray-400 mt-1">{log.details}</p>}
              {log.newValue && (
                <p className="text-xs text-gray-400 mt-1">→ {log.newValue}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
