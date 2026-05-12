import StatusBadge from './StatusBadge'

export default function BookingCard({ booking, onConfirm, onCancel, loading }) {
  const days = booking.numberOfDays
  const isActive = ['PENDING', 'CONFIRMED'].includes(booking.status)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-lg text-gray-900">{booking.carBrand} {booking.carModel}</h3>
          <p className="text-sm text-gray-500">{booking.licensePlate}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-gray-400 text-xs">Pick-up</p>
          <p className="font-medium">{booking.startDate}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Drop-off</p>
          <p className="font-medium">{booking.endDate}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Duration</p>
          <p className="font-medium">{days} day{days !== 1 ? 's' : ''}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Total</p>
          <p className="font-bold text-gray-900">₹{Number(booking.totalPrice).toLocaleString()}</p>
        </div>
      </div>

      {booking.pickupLocation && (
        <p className="text-sm text-gray-500 mt-2">📍 {booking.pickupLocation}</p>
      )}

      {booking.status === 'CANCELLED' && booking.cancellationReason && (
        <p className="text-sm text-red-600 mt-2 bg-red-50 rounded px-3 py-2">
          Reason: {booking.cancellationReason}
        </p>
      )}

      {isActive && (
        <div className="mt-4 flex gap-2 flex-wrap">
          {booking.status === 'PENDING' && (
            <button
              disabled={loading}
              onClick={() => onConfirm(booking.id)}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Confirm
            </button>
          )}
          <button
            disabled={loading}
            onClick={() => onCancel(booking.id)}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
