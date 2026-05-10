import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Shield, Bell, User } from 'lucide-react'
import { useAuthStore } from '../store/auth'

export default function Header() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
      <div className="flex items-center justify-between h-full px-6">
        <Link to="/" className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-primary-600" />
          <span className="text-xl font-bold text-gray-900">Nexora Admin</span>
        </Link>

        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <Bell className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex items-center gap-2 ml-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-gray-600" />
              <span className="font-medium">{user?.username || 'Admin'}</span>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-gray-100 rounded-full">
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
