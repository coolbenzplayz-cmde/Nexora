import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import FeedCard from '../components/FeedCard'
import { User, MapPin, Calendar, Link as LinkIcon } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { userId } = useParams()
  const queryClient = useQueryClient()

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.get(`/users/${userId}`).then((res) => res.data),
  })

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['user-posts', userId],
    queryFn: () => api.get(`/feed/user/${userId}`).then((res) => res.data),
  })

  const followMutation = useMutation({
    mutationFn: () => api.post(`/users/${userId}/follow`),
    onSuccess: () => {
      queryClient.invalidateQueries(['user', userId])
      toast.success('Followed successfully!')
    },
  })

  const unfollowMutation = useMutation({
    mutationFn: () => api.delete(`/users/${userId}/follow`),
    onSuccess: () => {
      queryClient.invalidateQueries(['user', userId])
      toast.success('Unfollowed successfully!')
    },
  })

  if (userLoading) {
    return <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-6">
          <img
            src={user?.avatar || '/default-avatar.png'}
            alt={user?.username}
            className="w-32 h-32 rounded-full"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold">{user?.username}</h1>
              {user?.isVerified && (
                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  Verified
                </span>
              )}
            </div>
            <p className="text-gray-600 mb-4">{user?.bio}</p>
            
            <div className="flex items-center gap-6 text-sm text-gray-500 mb-4">
              <span><strong>{user?.followers}</strong> followers</span>
              <span><strong>{user?.following}</strong> following</span>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
              {user?.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {user.location}
                </span>
              )}
              {user?.website && (
                <a href={user.website} className="flex items-center gap-1 hover:text-primary-600">
                  <LinkIcon className="w-4 h-4" />
                  Website
                </a>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Joined {format(new Date(user?.createdAt), 'MMMM yyyy')}
              </span>
            </div>

            <button
              onClick={() => followMutation.mutate()}
              disabled={followMutation.isLoading}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              Follow
            </button>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Posts</h2>
      {postsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        <div>
          {posts?.map((post) => (
            <FeedCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
