import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  getOccupancyPercentage,
  getUpcomingReservations,
  generateCalendarOccupancy
} from '../utils/availability'
import { formatCurrency } from '../utils/calculations'
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { Calendar, TrendingUp, Users, DollarSign } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export default function ReservationForecast() {
  const [guests, setGuests] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(addDays(new Date(), 30), 'yyyy-MM-dd')
  })
  const [roomTypeFilter, setRoomTypeFilter] = useState('all')
  const [forecastData, setForecastData] = useState({
    occupancyPercentage: 0,
    expectedRevenue: 0,
    upcomingReservations: 0,
    occupancyTrend: [],
    roomTypeDistribution: [],
    dailyOccupancy: []
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    generateForecast()
  }, [guests, rooms, dateRange, roomTypeFilter])

  async function loadData() {
    try {
      const { data: guestsData } = await supabase
        .from('guests')
        .select('*')

      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')

      setGuests(guestsData || [])
      setRooms(roomsData || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  function generateForecast() {
    const startDate = new Date(dateRange.start)
    const endDate = new Date(dateRange.end)

    const filteredGuests = roomTypeFilter === 'all'
      ? guests.filter(g => g.status !== 'cancelled')
      : guests.filter(g => g.status !== 'cancelled' && g.room_type === roomTypeFilter)

    const upcomingRes = getUpcomingReservations(filteredGuests, 60)
    const occupancyData = generateCalendarOccupancy(filteredGuests, startDate, endDate)
    const occupancyPercentage = getOccupancyPercentage(occupancyData, rooms.length)

    const dailyOccupancyTrend = Object.entries(occupancyData)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, data]) => ({
        date: format(new Date(date), 'MMM dd'),
        occupancy: Math.round((data.occupiedCount / rooms.length) * 100),
        rooms: data.occupiedCount
      }))

    const expectedRevenue = filteredGuests.reduce((sum, guest) => {
      if (guest.status === 'cancelled') return sum
      return sum + parseFloat(guest.total_room_charge || 0)
    }, 0)

    const roomTypeDistribution = rooms
      .filter(room => roomTypeFilter === 'all' || room.room_type === roomTypeFilter)
      .reduce((acc, room) => {
        const existing = acc.find(r => r.name === room.room_type)
        if (existing) {
          existing.value++
        } else {
          acc.push({ name: room.room_type, value: 1 })
        }
        return acc
      }, [])

    const occupancyTrend = dailyOccupancyTrend.slice(-14)

    setForecastData({
      occupancyPercentage,
      expectedRevenue,
      upcomingReservations: upcomingRes.length,
      occupancyTrend,
      roomTypeDistribution,
      dailyOccupancy: dailyOccupancyTrend
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const colors = ['#c19440', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Reservation Forecast</h1>
        <p className="text-gray-400 mt-1">Analytics and planning for upcoming reservations</p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-bold text-white mb-4">Forecast Period</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Filter by Room Type</label>
            <select
              value={roomTypeFilter}
              onChange={(e) => setRoomTypeFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All Types</option>
              <option value="SGL">Single</option>
              <option value="DBL">Double</option>
              <option value="TPL">Triple</option>
              <option value="QUAD">Quadruple</option>
              <option value="FAMILY">Family</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400 text-sm font-medium">Occupancy Rate</h3>
            <TrendingUp className="text-primary-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-primary-400">{forecastData.occupancyPercentage}%</p>
          <p className="text-xs text-gray-500 mt-2">Average occupancy in forecast period</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400 text-sm font-medium">Expected Revenue</h3>
            <DollarSign className="text-green-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-green-400">{formatCurrency(forecastData.expectedRevenue)}</p>
          <p className="text-xs text-gray-500 mt-2">From room charges only</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400 text-sm font-medium">Upcoming Reservations</h3>
            <Users className="text-blue-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-blue-400">{forecastData.upcomingReservations}</p>
          <p className="text-xs text-gray-500 mt-2">In the next 60 days</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400 text-sm font-medium">Total Rooms</h3>
            <Calendar className="text-orange-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-orange-400">{rooms.length}</p>
          <p className="text-xs text-gray-500 mt-2">In property</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-4">Occupancy Trend (Last 14 Days)</h2>
          {forecastData.occupancyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={forecastData.occupancyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#F3F4F6'
                  }}
                  formatter={(value) => `${value}%`}
                />
                <Line
                  type="monotone"
                  dataKey="occupancy"
                  stroke="#c19440"
                  strokeWidth={2}
                  dot={{ fill: '#c19440', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">
              No occupancy data available
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-4">Room Type Distribution</h2>
          {forecastData.roomTypeDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={forecastData.roomTypeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {forecastData.roomTypeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#F3F4F6'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">
              No room data available
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold text-white mb-4">Daily Occupancy</h2>
        {forecastData.dailyOccupancy.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={forecastData.dailyOccupancy}>
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
                formatter={(value) => [`${value}%`, 'Occupancy']}
              />
              <Bar dataKey="occupancy" fill="#c19440" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-96 flex items-center justify-center text-gray-500">
            No occupancy data for this period
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold text-white mb-6">Upcoming Reservations</h2>
        <div className="space-y-3">
          {getUpcomingReservations(
            roomTypeFilter === 'all'
              ? guests
              : guests.filter(g => g.room_type === roomTypeFilter)
          ).length === 0 ? (
            <p className="text-center text-gray-500 py-8">No upcoming reservations</p>
          ) : (
            getUpcomingReservations(
              roomTypeFilter === 'all'
                ? guests
                : guests.filter(g => g.room_type === roomTypeFilter)
            ).slice(0, 10).map(guest => (
              <div key={guest.id} className="p-4 bg-dark-800 rounded-lg flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-white font-medium">{guest.name_with_initials}</h3>
                  <p className="text-sm text-gray-400">
                    {format(new Date(guest.date_of_arrival), 'MMM dd')} - {format(new Date(guest.date_of_departure), 'MMM dd')} • {guest.room_numbers.join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-primary-400 font-bold">
                    {formatCurrency(guest.total_room_charge)}
                  </p>
                  <p className="text-xs text-gray-500">{guest.room_type}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
