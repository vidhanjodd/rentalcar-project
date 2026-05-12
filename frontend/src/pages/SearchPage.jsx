import { useState, useEffect } from 'react'
import { searchCars, getCities } from '../api/cars'
import CarCard from '../components/CarCard'
import Pagination from '../components/Pagination'

export default function SearchPage() {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [cities, setCities] = useState([])
  const [form, setForm] = useState({ city: '', startDate: tomorrow, endDate: '' })
  const [results, setResults] = useState(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    getCities().then((r) => setCities(r.data)).catch(() => {})
  }, [])

  const handleSearch = async (e, p = 0) => {
    if (e) e.preventDefault()
    if (!form.city || !form.startDate || !form.endDate) {
      setError('Please fill city, pick-up and drop-off dates.')
      return
    }
    setError('')
    setLoading(true)
    setSearched(true)
    try {
      const { data } = await searchCars({ ...form, page: p, size: 9 })
      setResults(data)
      setPage(p)
    } catch (e) {
      setError(e.response?.data?.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <div>
      {/* Hero */}
      <div className="bg-gray-900 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-black mb-3">
            Find Your Perfect <span className="text-primary">Ride</span>
          </h1>
          <p className="text-gray-400 text-lg">Premium cars available in Bengaluru, Mumbai, Chennai & Delhi</p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch}
          className="max-w-4xl mx-auto bg-white rounded-xl p-4 flex flex-col sm:flex-row gap-3 shadow-2xl">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
            <select value={form.city} onChange={set('city')} required
              className="w-full border-0 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Select city</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Pick-up Date</label>
            <input type="date" value={form.startDate} min={tomorrow} onChange={set('startDate')} required
              className="w-full border-0 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Drop-off Date</label>
            <input type="date" value={form.endDate} min={form.startDate || tomorrow} onChange={set('endDate')} required
              className="w-full border-0 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={loading}
              className="w-full sm:w-auto bg-primary text-white px-8 py-2.5 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors whitespace-nowrap">
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {error && (
          <p className="text-center text-red-400 text-sm mt-3">{error}</p>
        )}
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!searched && (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-lg font-medium">Search for available cars</p>
            <p className="text-sm mt-1">Select a city and your travel dates above</p>
          </div>
        )}

        {searched && results && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {results.totalElements} car{results.totalElements !== 1 ? 's' : ''} available
                {form.city ? ` in ${form.city}` : ''}
              </h2>
            </div>

            {results.content.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-lg font-medium">No cars available</p>
                <p className="text-sm mt-1">Try different dates or another city</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {results.content.map((car) => <CarCard key={car.id} car={car} />)}
                </div>
                <Pagination
                  page={page}
                  totalPages={results.totalPages}
                  onChange={(p) => handleSearch(null, p)}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
