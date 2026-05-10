import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { Heart, MessageCircle, User, Radio } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

export default function NotificationsPage() {
  const queryClient = useQueryClient()

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((res) => res.data),
  })

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) => api.post(`/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications'])
    },
  })

  const getIcon = (type) => {
    switch (type) {
      case 'like':
        return <Heart className="w-5 h-5 text-red-500" />
      case 'comment':
        return <MessageCircle className="w-5 h-5 text-blue-500" />
      case 'follow':
        return <User className="w-5 h-5 text-green-500" />
      case 'livestream':
        return <Radio className="w-5 h-5 text-purple-500" />
      default:
        return <Bell className="w-5 h-5 text-gray-500" />
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Notifications</h1>

      <div className="space-y-2">
        {notifications?.map((notification) => (
          <div
            key={notification.id}
            onClick={() => !notification.isRead && markAsReadMutation.mutate(notification.id)}
            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
              !notification.isRead ? 'bg-blue-50' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1">
                <p className="font-medium">{notification.title}</p>
                <p className="text-gray-600 text-sm mt-1">{notification.content}</p>
                <p className="text-gray-400 text-xs mt-2">
                  {formatDistanceToNow(new Date(notification.createdAt))} ago
                </p>
              </div>
              {!notification.isRead && (
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
