import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  UserPlus,
  FileText,
  Clock,
  Building2,
  CreditCard,
  Search,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../utils/calculations'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

export default function Dashboard() {
  const navigate = useNavigate()
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
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchDate, setSearchDate] = useState('')
  const [searchResults, setSearchResults] = useState({
    rooms: [],
    guests: [],
    reservations: []
  })
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [allGuests, setAllGuests] = useState([])
  const [allRooms, setAllRooms] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [showDateModal, setShowDateModal] = useState(false)
  const [dateBookings, setDateBookings] = useState([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() || searchDate) {
      performSearch()
    } else {
      setSearchResults({ rooms: [], guests: [], reservations: [] })
      setShowSearchResults(false)
    }
  }, [searchQuery, searchDate])

  async function performSearch() {
    setSearchLoading(true)
    try {
      const query = searchQuery.trim().toLowerCase()
      
      // Search rooms by number or type
      let roomsQuery = supabase.from('rooms').select('*')
      
      if (query) {
        roomsQuery = roomsQuery.or(`room_number.ilike.%${query}%,room_type.ilike.%${query}%`)
      }
      
      const { data: rooms } = await roomsQuery.limit(10)
      
      // Search guests
      let guestsQuery = supabase.from('guests').select('*')
      
      if (query) {
        guestsQuery = guestsQuery.or(`name_with_initials.ilike.%${query}%,grc_number.ilike.%${query}%,room_numbers.cs.{${query}}`)
      }
      
      const { data: guests } = await guestsQuery.limit(10)
      
      // Filter by date if provided
      let filteredRooms = rooms || []
      let filteredGuests = guests || []
      let reservations = []
      
      if (searchDate) {
        // Get guests with reservations on this date
        const dateGuests = guests?.filter(g => {
          const arrivalDate = new Date(g.date_of_arrival)
          const departureDate = new Date(g.date_of_departure)
          const searchDateObj = new Date(searchDate)
          
          return searchDateObj >= arrivalDate && searchDateObj <= departureDate
        }) || []
        
        filteredGuests = dateGuests
        
        // Get room numbers from these guests
        const occupiedRoomNumbers = new Set()
        dateGuests.forEach(g => {
          g.room_numbers?.forEach(rn => occupiedRoomNumbers.add(rn))
        })
        
        // Filter rooms to show availability
        filteredRooms = (rooms || []).map(room => ({
          ...room,
          isAvailableOnDate: !occupiedRoomNumbers.has(room.room_number)
        }))
        
        // Create reservation results
        reservations = dateGuests.map(g => ({
          id: g.id,
          grc_number: g.grc_number,
          guest_name: g.name_with_initials,
          room_numbers: g.room_numbers,
          date_of_arrival: g.date_of_arrival,
          date_of_departure: g.date_of_departure,
          status: g.status
        }))
      }
      
      setSearchResults({
        rooms: filteredRooms,
        guests: filteredGuests,
        reservations: reservations
      })
      setShowSearchResults(true)
    } catch (error) {
      console.error('Error performing search:', error)
    } finally {
      setSearchLoading(false)
    }
  }

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

      setAllGuests(guests || [])
      setAllRooms(rooms || [])

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

  const handleClearSearch = () => {
    setSearchQuery('')
    setSearchDate('')
    setSearchResults({ rooms: [], guests: [], reservations: [] })
    setShowSearchResults(false)
  }

  const handleRoomClick = (roomId) => {
    navigate(`/rooms`)
    setShowSearchResults(false)
  }

  const handleGuestClick = (guestId) => {
    navigate(`/guests/${guestId}`)
    setShowSearchResults(false)
  }

  const hasResults = searchResults.rooms.length > 0 || 
                     searchResults.guests.length > 0 || 
                     searchResults.reservations.length > 0

  // Calendar functions
  const getDayStatus = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const bookingsOnDay = allGuests.filter(g => {
      const arrival = new Date(g.date_of_arrival)
      const departure = new Date(g.date_of_departure)
      return day >= arrival && day <= departure && g.status !== 'cancelled'
    })

    if (bookingsOnDay.length === 0) return 'available'
    
    const totalRooms = allRooms.length
    const bookedRoomsCount = new Set(bookingsOnDay.flatMap(g => g.room_numbers || [])).size
    
    if (bookedRoomsCount >= totalRooms) return 'fully-booked'
    return 'partially-booked'
  }

  const handleDateClick = (day) => {
    const bookingsOnDay = allGuests.filter(g => {
      const arrival = new Date(g.date_of_arrival)
      const departure = new Date(g.date_of_departure)
      return day >= arrival && day <= departure && g.status !== 'cancelled'
    })

    setSelectedDate(day)
    setDateBookings(bookingsOnDay)
    setShowDateModal(true)
  }

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)
    
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    return (
      <div className="h-[300px] flex flex-col">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {days.map((day, idx) => {
            const status = getDayStatus(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isCurrentDay = isToday(day)
            
            return (
              <button
                key={idx}
                onClick={() => handleDateClick(day)}
                className={`
                  p-1 rounded text-xs font-medium transition-all hover:scale-105 flex items-center justify-center
                  ${!isCurrentMonth ? 'text-gray-600' : 'text-gray-200'}
                  ${isCurrentDay ? 'ring-1 ring-primary-400' : ''}
                  ${status === 'available' ? 'bg-green-500/20 hover:bg-green-500/30' : ''}
                  ${status === 'partially-booked' ? 'bg-orange-500/20 hover:bg-orange-500/30' : ''}
                  ${status === 'fully-booked' ? 'bg-red-500/20 hover:bg-red-500/30' : ''}
                `}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
      </div>
    )
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

      {/* Global Search Bar */}
      <div className="card p-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Search className="text-gray-400" size={20} />
            <h2 className="text-lg font-semibold text-white">Search</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by room number, room type, guest name, or GRC number..."
                className="input-field w-full pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            
            <div className="relative">
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="input-field w-full pr-10"
              />
              {searchDate && (
                <button
                  onClick={() => setSearchDate('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {(searchQuery || searchDate) && (
            <button
              onClick={handleClearSearch}
              className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Search Results */}
        {showSearchResults && (
          <div className="mt-6 space-y-6">
            {searchLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : hasResults ? (
              <>
                {/* Rooms Results */}
                {searchResults.rooms.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-white mb-3">
                      Rooms ({searchResults.rooms.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {searchResults.rooms.map(room => (
                        <div
                          key={room.id}
                          onClick={() => handleRoomClick(room.id)}
                          className="p-4 bg-dark-800 hover:bg-dark-700 rounded-lg cursor-pointer transition-colors border border-dark-700"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-lg font-bold text-white">
                              Room {room.room_number}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              searchDate && room.isAvailableOnDate !== undefined
                                ? room.isAvailableOnDate
                                  ? 'bg-green-500/10 text-green-400'
                                  : 'bg-red-500/10 text-red-400'
                                : room.status === 'available'
                                ? 'bg-green-500/10 text-green-400'
                                : room.status === 'occupied'
                                ? 'bg-orange-500/10 text-orange-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}>
                              {searchDate && room.isAvailableOnDate !== undefined
                                ? room.isAvailableOnDate ? 'Available' : 'Occupied'
                                : room.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400">
                            Type: <span className="text-gray-300">{room.room_type}</span>
                          </div>
                          <div className="text-sm text-gray-400">
                            Floor: <span className="text-gray-300">{room.floor || 1}</span>
                          </div>
                          <div className="text-sm text-primary-400 font-medium mt-2">
                            {formatCurrency(room.base_price)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reservations Results (when date is selected) */}
                {searchResults.reservations.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-white mb-3">
                      Reservations on {format(new Date(searchDate), 'MMM dd, yyyy')} ({searchResults.reservations.length})
                    </h3>
                    <div className="space-y-2">
                      {searchResults.reservations.map(reservation => (
                        <div
                          key={reservation.id}
                          onClick={() => handleGuestClick(reservation.id)}
                          className="p-4 bg-dark-800 hover:bg-dark-700 rounded-lg cursor-pointer transition-colors border border-dark-700"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-white font-medium">
                                {reservation.guest_name}
                              </div>
                              <div className="text-sm text-gray-400 mt-1">
                                GRC: <span className="text-primary-400">{reservation.grc_number}</span>
                              </div>
                              <div className="text-sm text-gray-400">
                                Rooms: <span className="text-gray-300">{reservation.room_numbers.join(', ')}</span>
                              </div>
                              <div className="text-sm text-gray-400">
                                {format(new Date(reservation.date_of_arrival), 'MMM dd')} - {format(new Date(reservation.date_of_departure), 'MMM dd, yyyy')}
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              reservation.status === 'checked_in'
                                ? 'bg-green-500/10 text-green-400'
                                : reservation.status === 'checked_out'
                                ? 'bg-gray-500/10 text-gray-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}>
                              {reservation.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Guests Results */}
                {searchResults.guests.length > 0 && !searchDate && (
                  <div>
                    <h3 className="text-md font-semibold text-white mb-3">
                      Guests ({searchResults.guests.length})
                    </h3>
                    <div className="space-y-2">
                      {searchResults.guests.map(guest => (
                        <div
                          key={guest.id}
                          onClick={() => handleGuestClick(guest.id)}
                          className="p-4 bg-dark-800 hover:bg-dark-700 rounded-lg cursor-pointer transition-colors border border-dark-700"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-white font-medium">
                                {guest.name_with_initials}
                              </div>
                              <div className="text-sm text-gray-400 mt-1">
                                GRC: <span className="text-primary-400">{guest.grc_number}</span>
                              </div>
                              <div className="text-sm text-gray-400">
                                Rooms: <span className="text-gray-300">{guest.room_numbers.join(', ')}</span>
                              </div>
                              <div className="text-sm text-gray-400">
                                {format(new Date(guest.date_of_arrival), 'MMM dd')} - {format(new Date(guest.date_of_departure), 'MMM dd, yyyy')}
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              guest.status === 'checked_in'
                                ? 'bg-green-500/10 text-green-400'
                                : guest.status === 'checked_out'
                                ? 'bg-gray-500/10 text-gray-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}>
                              {guest.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No results found
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-6 gap-6">
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
            <p className="text-xl font-bold text-white mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Booking Calendar */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Calendar className="text-gray-400" size={20} />
              <h2 className="text-lg font-semibold text-white">Booking Calendar</h2>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1 hover:bg-dark-700 rounded transition-colors"
              >
                <ChevronLeft size={18} className="text-gray-400" />
              </button>
              <span className="text-white font-medium text-sm min-w-[100px] text-center">
                {format(currentMonth, 'MMM yyyy')}
              </span>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1 hover:bg-dark-700 rounded transition-colors"
              >
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-center space-x-4 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500/20 rounded"></div>
              <span className="text-gray-400">Available</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-orange-500/20 rounded"></div>
              <span className="text-gray-400">Partial</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-500/20 rounded"></div>
              <span className="text-gray-400">Full</span>
            </div>
          </div>

          {renderCalendar()}
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-4 pb-8">Revenue Last 7 Days</h2>
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
          <h2 className="text-xl font-bold text-white mb-4 pb-8">Guest Arrivals</h2>
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

      {/* Date Modal */}
      {showDateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-dark-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Bookings for {selectedDate && format(selectedDate, 'MMMM dd, yyyy')}
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {dateBookings.length} {dateBookings.length === 1 ? 'booking' : 'bookings'} on this date
                </p>
              </div>
              <button
                onClick={() => setShowDateModal(false)}
                className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {dateBookings.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No bookings on this date
                </div>
              ) : (
                <div className="space-y-4">
                  {dateBookings.map(booking => (
                    <div
                      key={booking.id}
                      className="p-4 bg-dark-800 rounded-lg border border-dark-700 hover:bg-dark-700 transition-colors cursor-pointer"
                      onClick={() => {
                        handleGuestClick(booking.id)
                        setShowDateModal(false)
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-white font-semibold text-lg">
                            {booking.name_with_initials}
                          </h3>
                          <p className="text-sm text-gray-400">
                            GRC: <span className="text-primary-400">{booking.grc_number}</span>
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          booking.status === 'checked_in'
                            ? 'bg-green-500/10 text-green-400'
                            : booking.status === 'checked_out'
                            ? 'bg-gray-500/10 text-gray-400'
                            : booking.status === 'reserved'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {booking.status === 'reserved' ? 'Reserved' : booking.status.replace('_', ' ')}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Room Number(s)</p>
                          <p className="text-white font-medium">
                            {booking.room_numbers?.join(', ') || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Duration</p>
                          <p className="text-white font-medium">
                            {booking.number_of_nights} {booking.number_of_nights === 1 ? 'night' : 'nights'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-dark-700">
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <span className="text-gray-500">Check-in: </span>
                            <span className="text-gray-300">
                              {format(new Date(booking.date_of_arrival), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Check-out: </span>
                            <span className="text-gray-300">
                              {format(new Date(booking.date_of_departure), 'MMM dd, yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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