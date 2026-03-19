import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { Search, UserPlus, Filter, LogIn } from 'lucide-react'

export default function GuestList() {
  const navigate = useNavigate()
  const [guests, setGuests] = useState([])
  const [filteredGuests, setFilteredGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('checked_in')
  const [dateFilter, setDateFilter] = useState('')
  const [checkingIn, setCheckingIn] = useState({})

  useEffect(() => {
    loadGuests()
  }, [])

  useEffect(() => {
    filterGuests()
  }, [searchTerm, statusFilter, dateFilter, guests])

  async function loadGuests() {
    try {
      const { data } = await supabase
        .from('guests')
        .select('*')
        .order('created_at', { ascending: false })

      setGuests(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading guests:', error)
      setLoading(false)
    }
  }

  function filterGuests() {
    let filtered = [...guests]

    if (statusFilter !== 'all') {
      filtered = filtered.filter(g => g.status === statusFilter)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(g =>
        g.grc_number.toLowerCase().includes(term) ||
        g.name_with_initials.toLowerCase().includes(term) ||
        g.passport_nic.toLowerCase().includes(term) ||
        g.mobile_number.includes(term)
      )
    }

    if (dateFilter) {
      filtered = filtered.filter(g => 
        g.date_of_arrival === dateFilter || 
        g.date_of_departure === dateFilter
      )
    }

    setFilteredGuests(filtered)
  }

  async function handleCheckIn(guestId, roomNumbers) {
    if (!confirm('Are you sure you want to check in this guest?')) return

    setCheckingIn(prev => ({ ...prev, [guestId]: true }))

    try {
      // Update guest status to checked_in
      const { error: guestError } = await supabase
        .from('guests')
        .update({ 
          status: 'checked_in',
          updated_at: new Date().toISOString()
        })
        .eq('id', guestId)

      if (guestError) throw guestError

      // Update room statuses to occupied
      for (const roomNumber of roomNumbers) {
        const { error: roomError } = await supabase
          .from('rooms')
          .update({ 
            status: 'occupied',
            updated_at: new Date().toISOString()
          })
          .eq('room_number', roomNumber)

        if (roomError) {
          console.error(`Failed to update room ${roomNumber}:`, roomError)
        }
      }

      // Reload guests to reflect changes
      await loadGuests()
      
      alert('Guest checked in successfully!')
    } catch (error) {
      console.error('Error checking in guest:', error)
      alert('Failed to check in guest. Please try again.')
    } finally {
      setCheckingIn(prev => ({ ...prev, [guestId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Guest Management</h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1">View and manage all registered guests</p>
        </div>
        <Link to="/guests/new" className="inline-flex items-center space-x-2 btn-primary">
          <UserPlus size={20} />
          <span>New Guest</span>
        </Link>
      </div>

      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Search by GRC, name, passport, or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All Status</option>
              <option value="reserved">Reserved</option>
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="sm:w-48">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input-field"
              placeholder="Filter by date..."
            />
          </div>
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-sm text-primary-400 hover:text-primary-300 transition-colors px-2"
            >
              Clear Date
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-slate-500 dark:text-gray-400">
            Showing {filteredGuests.length} of {guests.length} guests
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left py-3 px-4 text-slate-500 dark:text-gray-400 font-medium text-sm">GRC Number</th>
                <th className="text-left py-3 px-4 text-slate-500 dark:text-gray-400 font-medium text-sm">Guest Name</th>
                <th className="text-left py-3 px-4 text-slate-500 dark:text-gray-400 font-medium text-sm">Nationality</th>
                <th className="text-left py-3 px-4 text-slate-500 dark:text-gray-400 font-medium text-sm">Room(s)</th>
                <th className="text-left py-3 px-4 text-slate-500 dark:text-gray-400 font-medium text-sm">Check-in</th>
                <th className="text-left py-3 px-4 text-slate-500 dark:text-gray-400 font-medium text-sm">Check-out</th>
                <th className="text-left py-3 px-4 text-slate-500 dark:text-gray-400 font-medium text-sm">Status</th>
                <th className="text-left py-3 px-4 text-slate-500 dark:text-gray-400 font-medium text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-gray-500">
                    {searchTerm || statusFilter !== 'all'
                      ? 'No guests found matching your filters'
                      : 'No guests registered yet'}
                  </td>
                </tr>
              ) : (
                filteredGuests.map((guest) => (
                  <tr
                    key={guest.id}
                    className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <Link
                        to={`/guests/${guest.id}`}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-500 font-medium"
                      >
                        {guest.grc_number}
                      </Link>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <div className="text-slate-900 dark:text-gray-200 font-medium">{guest.name_with_initials}</div>
                        <div className="text-xs text-slate-500 dark:text-gray-500">{guest.mobile_number}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-600 dark:text-gray-300">{guest.nationality}</td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1">
                        {guest.room_numbers.map(room => (
                          <span key={room} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-gray-300">
                            {room}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-600 dark:text-gray-300">
                      {format(new Date(guest.date_of_arrival), 'MMM dd, yyyy')}
                    </td>
                    <td className="py-4 px-4 text-slate-600 dark:text-gray-300">
                      {format(new Date(guest.date_of_departure), 'MMM dd, yyyy')}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        guest.status === 'reserved'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : guest.status === 'checked_in'
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : guest.status === 'checked_out'
                          ? 'bg-slate-500/10 text-slate-500 dark:text-gray-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {guest.status === 'reserved' ? 'Reserved' : guest.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {guest.status === 'reserved' && (
                        <button
                          onClick={() => handleCheckIn(guest.id, guest.room_numbers)}
                          disabled={checkingIn[guest.id]}
                          className="btn-primary text-xs py-2 px-3 flex items-center space-x-1 disabled:opacity-50"
                        >
                          {checkingIn[guest.id] ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <LogIn size={14} />
                              <span>Check In</span>
                            </>
                          )}
                        </button>
                      )}
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
