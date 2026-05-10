import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FileText,
  Shield,
  BarChart3,
  Settings,
  AlertTriangle,
} from 'lucide-react'
import { useAuthStore } from '../store/auth'

export default function Sidebar() {
  const location = useLocation()
  const { role } = useAuthStore()

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Users', path: '/users' },
    { icon: FileText, label: 'Content', path: '/content' },
    { icon: Shield, label: 'Moderation', path: '/moderation' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: Shield, label: 'Admin Management', path: '/admins', masterOnly: true },
    { icon: Shield, label: 'Admin Management', path: '/admins', masterOnly: true },
  ]

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Main Menu
        </h3>
        {menuItems.map((item) => {
          const Icon = item.icon
          
          if (item.masterOnly && role !== 'MASTER_ADMIN') {
            return null
          }
          
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                isActive
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}

        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 mt-8">
          Quick Actions
        </h3>
        <Link
          to="/moderation"
          className="flex items-center gap-3 px-4 py-3 rounded-lg mb-2 text-danger-600 hover:bg-danger-50 transition-colors"
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Pending Reviews</span>
        </Link>
      </div>
    </aside>
  )
}
