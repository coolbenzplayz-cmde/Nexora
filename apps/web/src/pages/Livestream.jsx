import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../store/auth'
import { Heart, MessageCircle, Share2, Send, Users } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LivestreamPage() {
  const { streamId } = useParams()
  const { user } = useAuthStore()
  const [message, setMessage] = useState('')
  const [liked, setLiked] = useState(false)
  const queryClient = useQueryClient()

  const { data: stream, isLoading } = useQuery({
    queryKey: ['livestream', streamId],
    queryFn: () => api.get(`/livestream/${streamId}`).then((res) => res.data),
    enabled: !!streamId,
  })

  const { data: streams } = useQuery({
    queryKey: ['livestreams'],
    queryFn: () => api.get('/livestreams/active').then((res) => res.data),
    enabled: !streamId,
  })

  const { data: chat } = useQuery({
    queryKey: ['stream-chat', streamId],
    queryFn: () => api.get(`/livestream/${streamId}/chat`).then((res) => res.data),
    enabled: !!streamId,
    refetchInterval: 2000,
  })

  const sendMessageMutation = useMutation({
    mutationFn: (content) => api.post(`/livestream/${streamId}/chat`, {
      userId: user?.id,
      username: user?.username,
      content,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['stream-chat', streamId])
      setMessage('')
    },
  })

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/livestream/${streamId}/like`),
    onSuccess: () => {
      setLiked(true)
      queryClient.invalidateQueries(['livestream', streamId])
      toast.success('Liked!')
    },
  })

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!message.trim()) return
    sendMessageMutation.mutate(message)
  }

  if (!streamId) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Active Livestreams</h1>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-200 rounded-lg h-64 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {streams?.map((stream) => (
              <div key={stream.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="relative">
                  <img
                    src={stream.thumbnailUrl || '/default-stream.png'}
                    alt={stream.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold">
                    LIVE
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{stream.title}</h3>
                  <p className="text-sm text-gray-500">{stream.viewerCount} viewers</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return <div className="animate-pulse bg-gray-200 h-96 rounded-lg" />
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-black rounded-lg overflow-hidden mb-4">
            <video
              src={stream?.hlsUrl}
              controls
              autoPlay
              className="w-full aspect-video"
            />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
            <h1 className="text-2xl font-bold mb-2">{stream?.title}</h1>
            <p className="text-gray-600 mb-4">{stream?.description}</p>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-500" />
                <span className="font-semibold">{stream?.viewerCount}</span>
                <span className="text-gray-500">viewers</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-gray-500" />
                <span className="font-semibold">{stream?.likes}</span>
                <span className="text-gray-500">likes</span>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4">
              <button
                onClick={() => likeMutation.mutate()}
                disabled={liked}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  liked
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Heart className="w-5 h-5" />
                Like
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
                <Share2 className="w-5 h-5" />
                Share
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Chat</h2>
            <div className="h-96 overflow-y-auto mb-4 space-y-2">
              {chat?.map((msg) => (
                <div key={msg.id} className="flex items-start gap-2">
                  <span className="font-semibold text-primary-600">{msg.username}:</span>
                  <span>{msg.content}</span>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Send a message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={!message.trim()}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">About Streamer</h2>
          <div className="flex items-center gap-3 mb-4">
            <img
              src={stream?.broadcasterAvatar || '/default-avatar.png'}
              alt={stream?.broadcasterName}
              className="w-12 h-12 rounded-full"
            />
            <div>
              <h3 className="font-semibold">{stream?.broadcasterName}</h3>
              <p className="text-sm text-gray-500">{stream?.category}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
