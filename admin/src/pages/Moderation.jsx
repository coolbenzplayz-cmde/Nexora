import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { Shield, AlertTriangle, User } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ModerationPage() {
  const queryClient = useQueryClient()

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => api.get('/admin/reports').then((res) => res.data),
  })

  const resolveMutation = useMutation({
    mutationFn: (reportId) => api.post(`/admin/reports/${reportId}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries(['reports'])
      toast.success('Report resolved')
    },
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Moderation Center</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-blue-500" />
            <span className="text-sm text-gray-600">Total Reports</span>
          </div>
          <p className="text-3xl font-bold">{reports?.length || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
            <span className="text-sm text-gray-600">Pending</span>
          </div>
          <p className="text-3xl font-bold">{reports?.filter(r => !r.resolved).length || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <User className="w-8 h-8 text-green-500" />
            <span className="text-sm text-gray-600">Resolved Today</span>
          </div>
          <p className="text-3xl font-bold">{reports?.filter(r => r.resolved && new Date(r.resolvedAt).toDateString() === new Date().toDateString()).length || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">Loading...</div>
        ) : reports?.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No reports</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {reports?.map((report) => (
              <div key={report.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {report.severity.toUpperCase()}
                      </span>
                      <span className="font-semibold">{report.type}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(report.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-4">{report.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        Reported by: <strong>{report.reportedBy?.username}</strong>
                      </span>
                      <span className="text-gray-600">
                        Reported user: <strong>{report.reportedUser?.username}</strong>
                      </span>
                    </div>
                  </div>
                  {!report.resolved && (
                    <button
                      onClick={() => resolveMutation.mutate(report.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
