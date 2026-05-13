import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="bg-gray-900 text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-primary text-2xl font-black tracking-tight">AVIS</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link to="/" className="hover:text-primary transition-colors">Search Cars</Link>
            {isAuthenticated && (
              <Link to="/bookings" className="hover:text-primary transition-colors">My Bookings</Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="hover:text-primary transition-colors">Admin</Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-300 hidden sm:block">Hi, {user?.username}</span>
                <button
                  onClick={handleLogout}
                  className="border border-gray-500 text-white px-4 py-1.5 rounded text-sm hover:border-white transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="border border-gray-500 text-white px-4 py-1.5 rounded text-sm hover:border-white transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-primary text-white px-4 py-1.5 rounded text-sm hover:bg-primary-dark transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden pb-3 flex gap-4 text-sm font-medium border-t border-gray-700 pt-3">
          <Link to="/" className="hover:text-primary transition-colors">Search</Link>
          {isAuthenticated && (
            <Link to="/bookings" className="hover:text-primary transition-colors">My Bookings</Link>
          )}
          {isAdmin && (
            <Link to="/admin" className="hover:text-primary transition-colors">Admin</Link>
          )}
        </div>
      </div>
    </nav>
  )
}
