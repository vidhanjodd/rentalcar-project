const styles = {
  PENDING:   'bg-yellow-100 text-yellow-800 border border-yellow-300',
  CONFIRMED: 'bg-green-100 text-green-800 border border-green-300',
  COMPLETED: 'bg-gray-100 text-gray-600 border border-gray-300',
  CANCELLED: 'bg-red-100 text-red-700 border border-red-300',
}

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.PENDING}`}>
      {status}
    </span>
  )
}
