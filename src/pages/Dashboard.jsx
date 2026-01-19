import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  UserPlus,
  FileText,
  Clock,
  Building2,
  CreditCard
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../utils/calculations'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

export default function Dashboard() {
  const [stats, setStats] = useState({
    todayGuests: 0,
    monthGuests: 0,
    totalRevenue: 0,
    pendingCheckouts: 0,
    availableRooms: 0,
    totalRooms: 0,
    advancePaymentsCollected: 0,
    upcomingReservations: 0
  })
  const [recentGuests, setRecentGuests] = useState([])
  const [revenueData, setRevenueData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

      const { data: guests } = await supabase
        .from('guests')
        .select('*')
        .order('created_at', { ascending: false })

      const { data: rooms } = await supabase
        .from('rooms')
        .select('*')

      const todayGuests = guests?.filter(g =>
        format(new Date(g.created_at), 'yyyy-MM-dd') === today
      ).length || 0

      const monthGuests = guests?.filter(g => {
        const createdDate = format(new Date(g.created_at), 'yyyy-MM-dd')
        return createdDate >= monthStart && createdDate <= monthEnd
      }).length || 0

      const totalRevenue = guests?.reduce((sum, g) => {
        return sum + parseFloat(g.total_room_charge || 0)
      }, 0) || 0

      const { data: purchases } = await supabase
        .from('purchases')
        .select('total_price')

      const purchasesRevenue = purchases?.reduce((sum, p) =>
        sum + parseFloat(p.total_price || 0), 0
      ) || 0

      const pendingCheckouts = guests?.filter(g =>
        g.status === 'checked_in' &&
        new Date(g.date_of_departure) <= new Date()
      ).length || 0

      const availableRooms = rooms?.filter(r => r.status === 'available').length || 0
      const totalRooms = rooms?.length || 0

      const advancePaymentsCollected = guests?.reduce((sum, g) => {
        return sum + parseFloat(g.advance_payment_amount || 0)
      }, 0) || 0

      const upcomingReservations = guests?.filter(g => {
        const checkInDate = new Date(g.date_of_arrival)
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
        return g.status !== 'cancelled' && checkInDate >= new Date() && checkInDate <= thirtyDaysFromNow
      }).length || 0

      setStats({
        todayGuests,
        monthGuests,
        totalRevenue: totalRevenue + purchasesRevenue,
        pendingCheckouts,
        availableRooms,
        totalRooms,
        advancePaymentsCollected,
        upcomingReservations
      })

      setRecentGuests(guests?.slice(0, 5) || [])

      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (6 - i))
        return format(date, 'yyyy-MM-dd')
      })

      const revenueByDay = last7Days.map(date => {
        const dayGuests = guests?.filter(g =>
          format(new Date(g.created_at), 'yyyy-MM-dd') === date
        ) || []

        const revenue = dayGuests.reduce((sum, g) =>
          sum + parseFloat(g.total_room_charge || 0), 0
        )

        return {
          date: format(new Date(date), 'MMM dd'),
          revenue: revenue,
          guests: dayGuests.length
        }
      })

      setRevenueData(revenueByDay)
      setLoading(false)
    } catch (error) {
      console.error('Error loading dashboard:', error)
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Today\'s Guests',
      value: stats.todayGuests,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10',
      iconColor: 'text-blue-400'
    },
    {
      title: 'Available Rooms',
      value: `${stats.availableRooms}/${stats.totalRooms}`,
      icon: Building2,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/10',
      iconColor: 'text-green-400'
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: 'from-primary-500 to-primary-600',
      bgColor: 'bg-primary-500/10',
      iconColor: 'text-primary-400'
    },
    {
      title: 'Advance Payments',
      value: formatCurrency(stats.advancePaymentsCollected),
      icon: CreditCard,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/10',
      iconColor: 'text-purple-400'
    },
    {
      title: 'Upcoming (30 Days)',
      value: stats.upcomingReservations,
      icon: Calendar,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/10',
      iconColor: 'text-orange-400'
    },
    {
      title: 'Pending Checkouts',
      value: stats.pendingCheckouts,
      icon: Clock,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-500/10',
      iconColor: 'text-red-400'
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Welcome to Crystal Sand Hotel Management</p>
        </div>
        <Link
          to="/guests/new"
          className="inline-flex items-center space-x-2 btn-primary"
        >
          <UserPlus size={20} />
          <span>New Guest</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {statCards.map((stat, index) => (
          <div
            key={stat.title}
            className="card p-6 hover:scale-105 transition-transform duration-200"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={stat.iconColor} size={24} />
              </div>
            </div>
            <h3 className="text-gray-400 text-sm font-medium">{stat.title}</h3>
            <p className="text-2xl font-bold text-white mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-4">Revenue Last 7 Days</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  color: '#F3F4F6'
                }}
              />
              <Bar dataKey="revenue" fill="#c19440" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-4">Guest Arrivals</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  color: '#F3F4F6'
                }}
              />
              <Line
                type="monotone"
                dataKey="guests"
                stroke="#c19440"
                strokeWidth={2}
                dot={{ fill: '#c19440', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Recent Guests</h2>
          <Link to="/guests" className="text-primary-400 hover:text-primary-300 text-sm font-medium">
            View All →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-800">
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">GRC Number</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Guest Name</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Room</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Check-in</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentGuests.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-500">
                    No guests registered yet
                  </td>
                </tr>
              ) : (
                recentGuests.map((guest) => (
                  <tr
                    key={guest.id}
                    className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <Link to={`/guests/${guest.id}`} className="text-primary-400 hover:text-primary-300 font-medium">
                        {guest.grc_number}
                      </Link>
                    </td>
                    <td className="py-4 px-4 text-gray-200">{guest.name_with_initials}</td>
                    <td className="py-4 px-4 text-gray-300">{guest.room_numbers.join(', ')}</td>
                    <td className="py-4 px-4 text-gray-300">
                      {format(new Date(guest.date_of_arrival), 'MMM dd, yyyy')}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        guest.status === 'checked_in'
                          ? 'bg-green-500/10 text-green-400'
                          : guest.status === 'checked_out'
                          ? 'bg-gray-500/10 text-gray-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {guest.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
