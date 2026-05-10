import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Users, Radio } from 'lucide-react'

export default function LivestreamCard({ stream }) {
  return (
    <Link to={`/livestream/${stream.id}`} className="block">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4 hover:shadow-md transition-shadow">
        <div className="relative">
          <img
            src={stream.thumbnailUrl || '/default-stream.png'}
            alt={stream.title}
            className="w-full h-48 object-cover"
          />
          {stream.status === 'live' && (
            <div className="absolute top-3 left-3 bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
              <Radio className="w-3 h-3" />
              LIVE
            </div>
          )}
          <div className="absolute bottom-3 right-3 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            {stream.viewerCount} viewers
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-semibold mb-2">{stream.title}</h3>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users className="w-4 h-4" />
            <span>{stream.broadcasterName}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(stream.createdAt))} ago</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
