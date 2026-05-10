import { Link, useNavigate } from 'react-router-dom'
import { Bell, Search, MessageCircle, PlusCircle, LogOut, User, Menu } from 'lucide-react'
import { useAuthStore } from '../store/auth'

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onMenuClick}
            className="md:hidden p-2 hover:bg-gray-100 rounded-full"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <Link to="/" className="text-xl md:text-2xl font-bold text-primary-600">
            Nexora
          </Link>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <Search className="w-5 h-5 text-gray-600" />
          </button>
          <Link to="/messages" className="p-2 hover:bg-gray-100 rounded-full hidden sm:block">
            <MessageCircle className="w-5 h-5 text-gray-600" />
          </Link>
          <Link to="/notifications" className="p-2 hover:bg-gray-100 rounded-full hidden sm:block">
            <Bell className="w-5 h-5 text-gray-600" />
          </Link>
          <Link to="/livestream/create" className="p-2 hover:bg-gray-100 rounded-full hidden md:block">
            <PlusCircle className="w-5 h-5 text-gray-600" />
          </Link>
          
          <div className="flex items-center gap-2 ml-2 md:ml-4">
            <Link to={`/profile/${user?.id}`} className="flex items-center gap-2">
              <img
                src={user?.avatar || '/default-avatar.png'}
                alt={user?.username}
                className="w-8 h-8 rounded-full"
              />
              <span className="font-medium hidden md:block">{user?.username}</span>
            </Link>
            <button onClick={handleLogout} className="p-2 hover:bg-gray-100 rounded-full">
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
