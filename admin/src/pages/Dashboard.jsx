import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { Users, FileText, Radio, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react'

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/admin/stats').then((res) => res.data),
  })

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      change: '+12%',
      icon: Users,
      color: 'blue',
    },
    {
      title: 'Total Posts',
      value: stats?.totalPosts || 0,
      change: '+8%',
      icon: FileText,
      color: 'green',
    },
    {
      title: 'Active Streams',
      value: stats?.activeStreams || 0,
      change: '+5%',
      icon: Radio,
      color: 'purple',
    },
    {
      title: 'Revenue',
      value: `$${stats?.revenue || 0}`,
      change: '+15%',
      icon: DollarSign,
      color: 'yellow',
    },
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          const colorClasses = {
            blue: 'bg-blue-500',
            green: 'bg-green-500',
            purple: 'bg-purple-500',
            yellow: 'bg-yellow-500',
          }
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${colorClasses[stat.color]}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm text-green-600 font-medium">{stat.change}</span>
              </div>
              <h3 className="text-2xl font-bold">{stat.value}</h3>
              <p className="text-gray-600">{stat.title}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">User Growth</h2>
          <div className="h-64 flex items-center justify-center bg-gray-100 rounded-lg">
            <p className="text-gray-500">Chart placeholder</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">Revenue</h2>
          <div className="h-64 flex items-center justify-center bg-gray-100 rounded-lg">
            <p className="text-gray-500">Chart placeholder</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {[
            { user: 'john_doe', action: 'posted a new content', time: '2 minutes ago' },
            { user: 'jane_smith', action: 'started a livestream', time: '5 minutes ago' },
            { user: 'bob_wilson', action: 'reported a user', time: '10 minutes ago' },
            { user: 'alice_brown', action: 'created an account', time: '15 minutes ago' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                {activity.user[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-medium">{activity.user}</p>
                <p className="text-sm text-gray-600">{activity.action}</p>
              </div>
              <span className="text-sm text-gray-500">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Pending Reviews</h2>
            <TrendingUp className="w-5 h-5 text-gray-500" />
          </div>
          <p className="text-3xl font-bold text-danger-600">{stats?.pendingReviews || 0}</p>
          <p className="text-gray-600 mt-2">Content awaiting moderation</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Active Issues</h2>
            <AlertTriangle className="w-5 h-5 text-gray-500" />
          </div>
          <p className="text-3xl font-bold text-warning-600">{stats?.activeIssues || 0}</p>
          <p className="text-gray-600 mt-2">Requires immediate attention</p>
        </div>
      </div>
    </div>
  )
}
