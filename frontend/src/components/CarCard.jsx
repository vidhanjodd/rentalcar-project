import { Link } from 'react-router-dom'

const categoryColors = {
  SUV: 'bg-blue-50 text-blue-700',
  SEDAN: 'bg-purple-50 text-purple-700',
  HATCHBACK: 'bg-green-50 text-green-700',
}

export default function CarCard({ car }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <div className="bg-gray-100 h-44 flex items-center justify-center">
        {car.imageUrl ? (
          <img src={car.imageUrl} alt={`${car.brand} ${car.model}`} className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-400 text-center">
            <svg className="w-16 h-16 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 17l-2-2H4a2 2 0 01-2-2V7a2 2 0 012-2h16a2 2 0 012 2v6a2 2 0 01-2 2h-2l-2 2m-4 0h4m-4 0v-4" />
            </svg>
            <span className="text-sm">{car.brand} {car.model}</span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="font-bold text-gray-900 text-lg leading-tight">{car.brand} {car.model}</h3>
            <p className="text-sm text-gray-500">{car.year} · {car.city}</p>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[car.category] || 'bg-gray-100 text-gray-600'}`}>
            {car.category}
          </span>
        </div>

        <div className="flex gap-3 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {car.seats} seats
          </span>
          {car.transmission && <span>{car.transmission}</span>}
          {car.fuelType && <span>{car.fuelType}</span>}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div>
            <span className="text-2xl font-bold text-gray-900">₹{Number(car.dailyRate).toLocaleString()}</span>
            <span className="text-sm text-gray-400">/day</span>
          </div>
          <Link
            to={`/cars/${car.id}`}
            className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            Book Now
          </Link>
        </div>
      </div>
    </div>
  )
}
