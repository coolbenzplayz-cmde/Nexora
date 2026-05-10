import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle } from 'lucide-react'

export default function ConversationCard({ conversation, currentUser }) {
  const otherUser = conversation.participants.find((p) => p.id !== currentUser?.id)
  const lastMessage = conversation.lastMessage

  return (
    <Link to={`/messages/${conversation.id}`} className="block">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-2 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={otherUser?.avatar || '/default-avatar.png'}
              alt={otherUser?.username}
              className="w-12 h-12 rounded-full"
            />
            {otherUser?.isOnline && (
              <CheckCircle className="w-4 h-4 text-green-500 absolute -bottom-1 -right-1 bg-white rounded-full" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold truncate">{otherUser?.username}</h3>
              {lastMessage && (
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(lastMessage.timestamp))} ago
                </span>
              )}
            </div>
            {lastMessage && (
              <p className="text-sm text-gray-500 truncate">
                {lastMessage.senderId === currentUser?.id ? 'You: ' : ''}{lastMessage.content}
              </p>
            )}
          </div>
          {conversation.unreadCount > 0 && (
            <div className="bg-primary-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
              {conversation.unreadCount}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
