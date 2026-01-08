import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { Search, UserPlus, Filter } from 'lucide-react'

export default function GuestList() {
  const [guests, setGuests] = useState([])
  const [filteredGuests, setFilteredGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    loadGuests()
  }, [])

  useEffect(() => {
    filterGuests()
  }, [searchTerm, statusFilter, guests])

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

    setFilteredGuests(filtered)
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
          <h1 className="text-3xl font-bold text-white">Guest Management</h1>
          <p className="text-gray-400 mt-1">View and manage all registered guests</p>
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
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-gray-400">
            Showing {filteredGuests.length} of {guests.length} guests
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-800">
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">GRC Number</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Guest Name</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Nationality</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Room(s)</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Check-in</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Check-out</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-gray-500">
                    {searchTerm || statusFilter !== 'all'
                      ? 'No guests found matching your filters'
                      : 'No guests registered yet'}
                  </td>
                </tr>
              ) : (
                filteredGuests.map((guest) => (
                  <tr
                    key={guest.id}
                    className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <Link
                        to={`/guests/${guest.id}`}
                        className="text-primary-400 hover:text-primary-300 font-medium"
                      >
                        {guest.grc_number}
                      </Link>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <div className="text-gray-200 font-medium">{guest.name_with_initials}</div>
                        <div className="text-xs text-gray-500">{guest.mobile_number}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-300">{guest.nationality}</td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1">
                        {guest.room_numbers.map(room => (
                          <span key={room} className="px-2 py-1 bg-dark-800 rounded text-xs text-gray-300">
                            {room}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-300">
                      {format(new Date(guest.date_of_arrival), 'MMM dd, yyyy')}
                    </td>
                    <td className="py-4 px-4 text-gray-300">
                      {format(new Date(guest.date_of_departure), 'MMM dd, yyyy')}
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
