import { useAuthStore } from '../store/auth'
import { Navigate } from 'react-router-dom'

export function withPermission(permission) {
  return function ProtectedComponent({ children }) {
    const { hasPermission } = useAuthStore()
    
    if (!hasPermission(permission)) {
      return <Navigate to="/" replace />
    }
    
    return children
  }
}

export function withRole(role) {
  return function ProtectedComponent({ children }) {
    const { role: userRole } = useAuthStore()
    
    if (userRole !== role && userRole !== 'MASTER_ADMIN') {
      return <Navigate to="/" replace />
    }
    
    return children
  }
}
