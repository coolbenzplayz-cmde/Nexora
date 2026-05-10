import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { Search as SearchIcon, Users, Radio, Hash } from 'lucide-react'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  const { data: results, isLoading } = useQuery({
    queryKey: ['search', query, activeTab],
    queryFn: () => api.get(`/search?q=${query}&type=${activeTab}`).then((res) => res.data),
    enabled: query.length > 2,
  })

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users, posts, livestreams..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            activeTab === 'users'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Users
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            activeTab === 'posts'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Hash className="w-4 h-4" />
          Posts
        </button>
        <button
          onClick={() => setActiveTab('livestreams')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            activeTab === 'livestreams'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          Livestreams
        </button>
      </div>

      {query.length > 2 ? (
        isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-200 rounded-lg h-20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {results?.users?.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-3">Users</h2>
                {results.users.map((user) => (
                  <div key={user.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-3">
                    <img
                      src={user.avatar || '/default-avatar.png'}
                      alt={user.username}
                      className="w-12 h-12 rounded-full"
                    />
                    <div>
                      <h3 className="font-semibold">{user.username}</h3>
                      <p className="text-sm text-gray-500">{user.bio}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results?.posts?.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-3">Posts</h2>
                {results.posts.map((post) => (
                  <div key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <p>{post.content}</p>
                  </div>
                ))}
              </div>
            )}

            {results?.livestreams?.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-3">Livestreams</h2>
                {results.livestreams.map((stream) => (
                  <div key={stream.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <h3 className="font-semibold">{stream.title}</h3>
                    <p className="text-sm text-gray-500">{stream.viewerCount} viewers</p>
                  </div>
                ))}
              </div>
            )}

            {results?.users?.length === 0 && results?.posts?.length === 0 && results?.livestreams?.length === 0 && (
              <p className="text-center text-gray-500 py-8">No results found</p>
            )}
          </div>
        )
      ) : (
        <p className="text-center text-gray-500 py-8">Type at least 3 characters to search</p>
      )}
    </div>
  )
}
