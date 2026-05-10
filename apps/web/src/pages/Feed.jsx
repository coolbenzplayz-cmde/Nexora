import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import FeedCard from '../components/FeedCard'
import toast from 'react-hot-toast'

export default function FeedPage() {
  const [content, setContent] = useState('')
  const queryClient = useQueryClient()

  const { data: feedData, isLoading } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api.get('/feed').then((res) => res.data),
  })

  const createPostMutation = useMutation({
    mutationFn: (postData) => api.post('/feed/posts', postData),
    onSuccess: () => {
      queryClient.invalidateQueries(['feed'])
      setContent('')
      toast.success('Post created successfully!')
    },
    onError: () => {
      toast.error('Failed to create post')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!content.trim()) return

    createPostMutation.mutate({ content })
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <form onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
          />
          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={createPostMutation.isLoading}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {createPostMutation.isLoading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        <div>
          {feedData?.map((post) => (
            <FeedCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
