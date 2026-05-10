import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { Users, FileText, Radio, TrendingUp, DollarSign } from 'lucide-react'

export default function AnalyticsPage() {
  const { data: analytics } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.get('/admin/analytics').then((res) => res.data),
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-blue-500" />
            <span className="text-sm text-gray-600">Daily Active Users</span>
          </div>
          <p className="text-3xl font-bold">{analytics?.dailyActiveUsers || 0}</p>
          <p className="text-sm text-green-600 mt-2">+12% from yesterday</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-green-500" />
            <span className="text-sm text-gray-600">Posts Today</span>
          </div>
          <p className="text-3xl font-bold">{analytics?.postsToday || 0}</p>
          <p className="text-sm text-green-600 mt-2">+8% from yesterday</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Radio className="w-8 h-8 text-purple-500" />
            <span className="text-sm text-gray-600">Stream Hours</span>
          </div>
          <p className="text-3xl font-bold">{analytics?.streamHours || 0}</p>
          <p className="text-sm text-green-600 mt-2">+5% from yesterday</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8 text-yellow-500" />
            <span className="text-sm text-gray-600">Revenue Today</span>
          </div>
          <p className="text-3xl font-bold">${analytics?.revenueToday || 0}</p>
          <p className="text-sm text-green-600 mt-2">+15% from yesterday</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">User Growth (Last 7 Days)</h2>
          <div className="h-64 flex items-center justify-center bg-gray-100 rounded-lg">
            <p className="text-gray-500">Chart placeholder</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">Revenue (Last 7 Days)</h2>
          <div className="h-64 flex items-center justify-center bg-gray-100 rounded-lg">
            <p className="text-gray-500">Chart placeholder</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">Top Performing Content</h2>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Content
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Author
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Views
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Engagement
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {[
              { title: 'Amazing Tutorial', author: 'john_doe', views: 12500, engagement: '8.5%' },
              { title: 'Product Launch', author: 'jane_smith', views: 9800, engagement: '12.3%' },
              { title: 'Live Stream Recap', author: 'bob_wilson', views: 8500, engagement: '15.2%' },
            ].map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{item.title}</td>
                <td className="px-6 py-4">{item.author}</td>
                <td className="px-6 py-4">{item.views.toLocaleString()}</td>
                <td className="px-6 py-4">{item.engagement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
