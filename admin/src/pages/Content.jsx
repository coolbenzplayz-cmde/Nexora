import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { Check, X, Eye, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ContentPage() {
  const queryClient = useQueryClient()

  const { data: content, isLoading } = useQuery({
    queryKey: ['pending-content'],
    queryFn: () => api.get('/admin/content/pending').then((res) => res.data),
  })

  const approveMutation = useMutation({
    mutationFn: (contentId) => api.post(`/admin/content/${contentId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries(['pending-content'])
      toast.success('Content approved')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (contentId) => api.post(`/admin/content/${contentId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries(['pending-content'])
      toast.success('Content rejected')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (contentId) => api.delete(`/admin/content/${contentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['pending-content'])
      toast.success('Content deleted')
    },
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Content Moderation</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">Loading...</div>
        ) : content?.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No pending content</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {content?.map((item) => (
              <div key={item.id} className="p-6">
                <div className="flex items-start gap-4">
                  {item.mediaUrl && (
                    <img
                      src={item.mediaUrl}
                      alt="Content"
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{item.user?.username}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                        {item.type}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-4">{item.content}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => approveMutation.mutate(item.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(item.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
