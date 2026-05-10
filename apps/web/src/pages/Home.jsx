import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import FeedCard from '../components/FeedCard'
import LivestreamCard from '../components/LivestreamCard'

export default function HomePage() {
  const { data: feedData, isLoading: feedLoading } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api.get('/feed').then((res) => res.data),
  })

  const { data: streamsData, isLoading: streamsLoading } = useQuery({
    queryKey: ['livestreams'],
    queryFn: () => api.get('/livestreams/active').then((res) => res.data),
  })

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Active Livestreams</h2>
        {streamsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-gray-200 rounded-lg h-64 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {streamsData?.map((stream) => (
              <LivestreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Your Feed</h2>
        {feedLoading ? (
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
    </div>
  )
}
