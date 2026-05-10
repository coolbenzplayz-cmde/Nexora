import { useState } from 'react'
import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function FeedCard({ post }) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes || 0)

  const handleLike = () => {
    setLiked(!liked)
    setLikeCount(liked ? likeCount - 1 : likeCount + 1)
  }

  return (
    <article className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <img
          src={post.userAvatar || '/default-avatar.png'}
          alt={post.username}
          className="w-10 h-10 rounded-full"
        />
        <div>
          <h3 className="font-semibold">{post.username}</h3>
          <p className="text-sm text-gray-500">
            {formatDistanceToNow(new Date(post.createdAt))} ago
          </p>
        </div>
        <button className="ml-auto">
          <MoreHorizontal className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <p className="mb-4">{post.content}</p>

      {post.mediaUrl && (
        <img
          src={post.mediaUrl}
          alt="Post media"
          className="w-full rounded-lg mb-4"
        />
      )}

      <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 ${liked ? 'text-red-500' : 'text-gray-500'}`}
        >
          <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
          <span>{likeCount}</span>
        </button>
        <button className="flex items-center gap-2 text-gray-500">
          <MessageCircle className="w-5 h-5" />
          <span>{post.comments || 0}</span>
        </button>
        <button className="flex items-center gap-2 text-gray-500">
          <Share2 className="w-5 h-5" />
          <span>{post.shares || 0}</span>
        </button>
      </div>
    </article>
  )
}
