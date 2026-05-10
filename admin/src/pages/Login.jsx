import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../lib/api'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser, setToken, setRole } = useAuthStore()
  const navigate = useNavigate()

  const MASTER_PASSWORD = 'Nolag@zyra'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await api.post('/admin/login', { password })
      const { user, token } = response.data
      
      setUser(user)
      setToken(token)
      setRole(user.role)
      localStorage.setItem('admin_token', token)
      localStorage.setItem('admin_role', user.role)
      
      toast.success('Welcome, Master Admin!')
      navigate('/')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Invalid password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-700">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">Nexora Admin</h1>
        <p className="text-gray-600 text-center mb-8">Master Admin Access Only</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Master Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter master password"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Access Admin Panel'}
          </button>
        </form>
        
        <p className="text-xs text-gray-500 text-center mt-6">
          Unauthorized access is monitored and logged
        </p>
      </div>
    </div>
  )
}
