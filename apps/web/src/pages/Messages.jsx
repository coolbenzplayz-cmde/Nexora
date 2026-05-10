import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import api from '../lib/api'
import ConversationCard from '../components/ConversationCard'
import { useAuthStore } from '../store/auth'
import { Send, Search } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MessagesPage() {
  const { conversationId } = useParams()
  const { user } = useAuthStore()
  const [message, setMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/conversations').then((res) => res.data),
  })

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => api.get(`/messages/conversation/${conversationId}`).then((res) => res.data),
    enabled: !!conversationId,
  })

  const sendMessageMutation = useMutation({
    mutationFn: (content) => api.post('/messages/direct', {
      senderId: user?.id,
      receiverId: conversationId,
      content,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', conversationId])
      setMessage('')
    },
  })

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!message.trim()) return
    sendMessageMutation.mutate(message)
  }

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="p-4">
          {conversations?.map((conversation) => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
              currentUser={user}
            />
          ))}
        </div>
      </div>

      {conversationId ? (
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1 overflow-y-auto p-4">
            {messagesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-gray-200 rounded-lg h-16 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        msg.senderId === user?.id
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200'
                      }`}
                    >
                      <p>{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
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
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <p className="text-gray-500">Select a conversation to start messaging</p>
        </div>
      )}
    </div>
  )
}
