import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { Plus, Trash2, Shield, ShieldAlert, Mail, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/auth'

export default function AdminManagementPage() {
  const { role } = useAuthStore()
  const queryClient = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePermissions, setInvitePermissions] = useState([])
  const [copiedToken, setCopiedToken] = useState(null)

  const { data: admins } = useQuery({
    queryKey: ['admins'],
    queryFn: () => api.get('/admin/admins').then((res) => res.data),
    enabled: role === 'MASTER_ADMIN',
  })

  const inviteMutation = useMutation({
    mutationFn: (data) => api.post('/admin/invite', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admins'])
      toast.success('Admin invited successfully')
      setInviteEmail('')
      setInvitePermissions([])
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (adminId) => api.delete(`/admin/admins/${adminId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['admins'])
      toast.success('Admin access revoked')
    },
  })

  const availablePermissions = [
    { id: 'view_dashboard', label: 'View Dashboard' },
    { id: 'manage_users', label: 'Manage Users' },
    { id: 'moderate_content', label: 'Moderate Content' },
    { id: 'view_analytics', label: 'View Analytics' },
    { id: 'manage_settings', label: 'Manage Settings' },
  ]

  const handleInvite = (e) => {
    e.preventDefault()
    inviteMutation.mutate({
      email: inviteEmail,
      permissions: invitePermissions,
    })
  }

  const handleCopyToken = (token) => {
    navigator.clipboard.writeText(token)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  if (role !== 'MASTER_ADMIN') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Access denied. Master Admin only.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Admin Management</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Invite New Admin
        </h2>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="admin@example.com"
                required
              />
              <Mail className="w-10 h-10 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availablePermissions.map((perm) => (
                <label key={perm.id} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invitePermissions.includes(perm.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setInvitePermissions([...invitePermissions, perm.id])
                      } else {
                        setInvitePermissions(invitePermissions.filter(p => p !== perm.id))
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span>{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={inviteMutation.isLoading}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {inviteMutation.isLoading ? 'Sending Invite...' : 'Send Invite'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <h2 className="text-xl font-bold p-6 border-b border-gray-200">
          Admin List
        </h2>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Admin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Permissions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {admins?.map((admin) => (
              <tr key={admin.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      {admin.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{admin.email}</p>
                      <p className="text-sm text-gray-500">Joined {new Date(admin.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {admin.role === 'MASTER_ADMIN' ? (
                    <span className="flex items-center gap-1 text-red-600">
                      <Shield className="w-4 h-4" />
                      Master Admin
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-blue-600">
                      <ShieldAlert className="w-4 h-4" />
                      Admin
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {admin.role === 'MASTER_ADMIN' ? (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">All Permissions</span>
                    ) : (
                      admin.permissions.map((perm) => (
                        <span key={perm} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {perm}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {admin.status === 'active' ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Active</span>
                  ) : (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">Pending</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {admin.inviteToken && admin.status === 'pending' && (
                      <button
                        onClick={() => handleCopyToken(admin.inviteToken)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="Copy invite token"
                      >
                        {copiedToken === admin.inviteToken ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {admin.role !== 'MASTER_ADMIN' && (
                      <button
                        onClick={() => revokeMutation.mutate(admin.id)}
                        className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                        title="Revoke access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
