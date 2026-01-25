import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../utils/calculations'
import { Plus, Edit2, Trash2, X, Save, AlertCircle, Calendar, Download, ChevronLeft, ChevronRight, FileDown } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns'

export default function Rooms() {
  const [rooms, setRooms] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [formData, setFormData] = useState({
    room_number: '',
    room_type: 'DBL',
    floor: 1,
    base_price: 0,
    status: 'available'
  })
  const [filterStatus, setFilterStatus] = useState('all')
  const [formError, setFormError] = useState('')
  
  // Reservation Chart states
  const [showReservationChart, setShowReservationChart] = useState(false)
  const [chartMonth, setChartMonth] = useState(new Date())
  const [reservations, setReservations] = useState([])
  const [chartLoading, setChartLoading] = useState(false)

  useEffect(() => {
    loadRooms()
    loadRoomTypes()
  }, [])

  useEffect(() => {
    if (showReservationChart) {
      loadReservations()
    }
  }, [chartMonth, showReservationChart])

  async function loadRooms() {
    try {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number')

      setRooms(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading rooms:', error)
      setLoading(false)
    }
  }

  async function loadRoomTypes() {
    try {
      const { data } = await supabase
        .from('room_types')
        .select('*')
        .order('code')

      setRoomTypes(data || [])
    } catch (error) {
      console.error('Error loading room types:', error)
    }
  }

  async function loadReservations() {
    setChartLoading(true)
    try {
      const monthStart = format(startOfMonth(chartMonth), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(chartMonth), 'yyyy-MM-dd')

      const { data } = await supabase
        .from('guests')
        .select('*')
        .or(`and(date_of_arrival.lte.${monthEnd},date_of_departure.gte.${monthStart})`)
        .neq('status', 'cancelled')

      setReservations(data || [])
    } catch (error) {
      console.error('Error loading reservations:', error)
      setReservations([])
    } finally {
      setChartLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'floor' || name === 'base_price' ? parseFloat(value) : value
    }))
    setFormError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!formData.room_number.trim()) {
      setFormError('Room number is required')
      return
    }

    try {
      const { data: existingRoom } = await supabase
        .from('rooms')
        .select('id, room_number')
        .eq('room_number', formData.room_number.trim())
        .single()

      if (existingRoom && (!editingRoom || existingRoom.id !== editingRoom.id)) {
        setFormError(`Room number ${formData.room_number} already exists`)
        return
      }

      if (editingRoom) {
        if (editingRoom.room_number !== formData.room_number) {
          await updateGuestRoomNumbers(editingRoom.room_number, formData.room_number)
        }

        const { error } = await supabase
          .from('rooms')
          .update(formData)
          .eq('id', editingRoom.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('rooms')
          .insert([formData])

        if (error) throw error
      }

      resetForm()
      loadRooms()
    } catch (error) {
      console.error('Error saving room:', error)
      setFormError('Failed to save room')
    }
  }

  async function updateGuestRoomNumbers(oldRoomNumber, newRoomNumber) {
    try {
      const { data: guests } = await supabase
        .from('guests')
        .select('*')
        .contains('room_numbers', [oldRoomNumber])

      if (guests && guests.length > 0) {
        for (const guest of guests) {
          const updatedRoomNumbers = guest.room_numbers.map(rn => 
            rn === oldRoomNumber ? newRoomNumber : rn
          )

          await supabase
            .from('guests')
            .update({ room_numbers: updatedRoomNumbers })
            .eq('id', guest.id)
        }
      }
    } catch (error) {
      console.error('Error updating guest room numbers:', error)
      throw error
    }
  }

  async function handleDelete(roomId) {
    if (!confirm('Are you sure you want to delete this room?')) return

    try {
      const room = rooms.find(r => r.id === roomId)
      if (room) {
        const { data: guestsUsingRoom } = await supabase
          .from('guests')
          .select('id, grc_number, name_with_initials')
          .contains('room_numbers', [room.room_number])
          .in('status', ['checked_in', 'reserved'])

        if (guestsUsingRoom && guestsUsingRoom.length > 0) {
          alert(`Cannot delete room ${room.room_number}. It is currently assigned to ${guestsUsingRoom.length} active booking(s).`)
          return
        }
      }

      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId)

      if (error) throw error
      loadRooms()
    } catch (error) {
      console.error('Error deleting room:', error)
      alert('Failed to delete room')
    }
  }

  function handleEdit(room) {
    setEditingRoom(room)
    setFormData({
      room_number: room.room_number,
      room_type: room.room_type,
      floor: room.floor || 1,
      base_price: room.base_price,
      status: room.status
    })
    setShowForm(true)
    setFormError('')
  }

  function resetForm() {
    setEditingRoom(null)
    setFormData({
      room_number: '',
      room_type: 'DBL',
      floor: 1,
      base_price: 0,
      status: 'available'
    })
    setShowForm(false)
    setFormError('')
  }

  const isRoomOccupied = (roomNumber, date) => {
    return reservations.some(reservation => {
      const arrival = new Date(reservation.date_of_arrival)
      const departure = new Date(reservation.date_of_departure)
      const checkDate = new Date(date)
      
      return reservation.room_numbers.includes(roomNumber) &&
             checkDate >= arrival &&
             checkDate <= departure
    })
  }

  const getGuestForRoom = (roomNumber, date) => {
    return reservations.find(reservation => {
      const arrival = new Date(reservation.date_of_arrival)
      const departure = new Date(reservation.date_of_departure)
      const checkDate = new Date(date)
      
      return reservation.room_numbers.includes(roomNumber) &&
             checkDate >= arrival &&
             checkDate <= departure
    })
  }

  const downloadAsExcel = () => {
    const monthStart = startOfMonth(chartMonth)
    const monthEnd = endOfMonth(chartMonth)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

    let csvContent = 'Room Number,Room Type,'
    csvContent += days.map(day => format(day, 'dd')).join(',') + '\n'

    const sortedRooms = [...rooms].sort((a, b) => {
      const numA = parseInt(a.room_number.replace(/\D/g, ''))
      const numB = parseInt(b.room_number.replace(/\D/g, ''))
      return numA - numB
    })

    sortedRooms.forEach(room => {
      csvContent += `${room.room_number},${room.room_type},`
      
      const dayCells = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const guest = getGuestForRoom(room.room_number, dateStr)
        return guest ? `${guest.grc_number}` : ''
      })
      
      csvContent += dayCells.join(',') + '\n'
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `Reservation_Chart_${format(chartMonth, 'MMMM_yyyy')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadAsPDF = () => {
    const monthStart = startOfMonth(chartMonth)
    const monthEnd = endOfMonth(chartMonth)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sortedRooms = [...rooms].sort((a, b) => {
      const numA = parseInt(a.room_number.replace(/\D/g, ''))
      const numB = parseInt(b.room_number.replace(/\D/g, ''))
      return numA - numB
    })

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reservation Chart - ${format(chartMonth, 'MMMM yyyy')}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { text-align: center; color: #333; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { border: 1px solid #ddd; padding: 4px; text-align: center; }
          th { background-color: #c19440; color: white; font-weight: bold; }
          .occupied { background-color: #ffd700; }
          .available { background-color: #90ee90; }
          .past { background-color: #d3d3d3; color: #888; }
          .room-header { background-color: #f0f0f0; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Crystal Sand Hotel - Reservation Chart</h1>
        <h2 style="text-align: center;">${format(chartMonth, 'MMMM yyyy')}</h2>
        <table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Type</th>
              ${days.map(day => {
                const isPast = day < today
                return `<th ${isPast ? 'style="background-color: #999;"' : ''}>${format(day, 'dd')}</th>`
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${sortedRooms.map(room => `
              <tr>
                <td class="room-header">${room.room_number}</td>
                <td class="room-header">${room.room_type}</td>
                ${days.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const guest = getGuestForRoom(room.room_number, dateStr)
                  const isPast = day < today
                  const cellClass = isPast && !guest ? 'past' : guest ? 'occupied' : 'available'
                  return `<td class="${cellClass}">${guest ? guest.grc_number.split('-').pop() : ''}</td>`
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top: 20px;">
          <p><strong>Legend:</strong></p>
          <p><span style="background-color: #ffd700; padding: 5px;">Yellow</span> = Occupied | 
             <span style="background-color: #90ee90; padding: 5px;">Green</span> = Available | 
             <span style="background-color: #332724; padding: 5px;">Gray</span> = Past Date</p>
          <p>Generated on: ${format(new Date(), 'PPpp')}</p>
        </div>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const filteredRooms = filterStatus === 'all'
    ? rooms
    : rooms.filter(room => room.status === filterStatus)

  const roomTypeMap = Object.fromEntries(roomTypes.map(rt => [rt.code, rt.name]))

  const statsByType = roomTypes.reduce((acc, type) => {
    const count = rooms.filter(r => r.room_type === type.code).length
    const occupied = rooms.filter(r => r.room_type === type.code && r.status === 'occupied').length
    return {
      ...acc,
      [type.code]: { count, occupied, available: count - occupied }
    }
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const renderReservationChart = () => {
    const monthStart = startOfMonth(chartMonth)
    const monthEnd = endOfMonth(chartMonth)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sortedRooms = [...rooms].sort((a, b) => {
      const numA = parseInt(a.room_number.replace(/\D/g, ''))
      const numB = parseInt(b.room_number.replace(/\D/g, ''))
      return numA - numB
    })

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-dark-800">
              <th className="border border-dark-700 p-2 text-left sticky left-0 bg-dark-800 z-10">Room</th>
              <th className="border border-dark-700 p-2 text-left sticky left-16 bg-dark-800 z-10">Type</th>
              {days.map((day, index) => {
                const isPast = day < today
                return (
                  <th key={index} className={`border border-dark-700 p-2 min-w-[40px] ${isPast ? 'bg-gray-700/30' : ''}`}>
                    <div className={isPast ? 'text-gray-600' : ''}>{format(day, 'dd')}</div>
                    <div className={`text-[10px] ${isPast ? 'text-gray-700' : 'text-gray-500'}`}>{format(day, 'EEE')}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRooms.map((room) => (
              <tr key={room.id} className="hover:bg-dark-800/50">
                <td className="border border-dark-700 p-2 font-bold sticky left-0 bg-dark-900 z-10">
                  {room.room_number}
                </td>
                <td className="border border-dark-700 p-2 sticky left-16 bg-dark-900 z-10">
                  {room.room_type}
                </td>
                {days.map((day, index) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const guest = getGuestForRoom(room.room_number, dateStr)
                  const isOccupied = isRoomOccupied(room.room_number, dateStr)
                  const isPast = day < today
                  
                  return (
                    <td
                      key={index}
                      className={`border border-dark-700 p-1 text-center ${
                        isPast && !isOccupied
                          ? 'bg-gray-700/20 cursor-not-allowed'
                          : isOccupied
                          ? 'bg-yellow-500/30 hover:bg-yellow-500/40 cursor-pointer'
                          : 'bg-green-500/20 hover:bg-green-500/30 cursor-pointer'
                      }`}
                      title={
                        isPast && !isOccupied 
                          ? 'Past date' 
                          : guest 
                          ? `${guest.name_with_initials} (${guest.grc_number})` 
                          : 'Available'
                      }
                    >
                      {guest && (
                        <div className={`text-[10px] font-medium ${isPast ? 'text-gray-500' : ''}`}>
                          {guest.grc_number.split('-').pop()}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Rooms Management</h1>
          <p className="text-gray-400 mt-1">Manage hotel rooms and availability</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowReservationChart(true)}
            className="btn-secondary flex items-center space-x-2"
          >
            <Calendar size={20} />
            <span>Reservation Chart</span>
          </button>
          {!showForm && (
            <button
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>Add Room</span>
            </button>
          )}
        </div>
      </div>

      {/* Reservation Chart Modal */}
      {showReservationChart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-lg w-full max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-dark-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Monthly Reservation Chart</h2>
                <button
                  onClick={() => setShowReservationChart(false)}
                  className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setChartMonth(subMonths(chartMonth, 1))}
                    className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <ChevronLeft size={20} className="text-gray-400" />
                  </button>
                  <span className="text-white font-medium text-lg min-w-[160px] text-center">
                    {format(chartMonth, 'MMMM yyyy')}
                  </span>
                  <button
                    onClick={() => setChartMonth(addMonths(chartMonth, 1))}
                    className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <ChevronRight size={20} className="text-gray-400" />
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={downloadAsExcel}
                    className="btn-secondary flex items-center space-x-2 text-sm"
                  >
                    <FileDown size={16} />
                    <span>Excel</span>
                  </button>
                  <button
                    onClick={downloadAsPDF}
                    className="btn-secondary flex items-center space-x-2 text-sm"
                  >
                    <Download size={16} />
                    <span>PDF</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-6 mt-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-yellow-500/30 border border-yellow-500/50 rounded"></div>
                  <span className="text-gray-400">Occupied</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500/20 border border-green-500/50 rounded"></div>
                  <span className="text-gray-400">Available</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-700/20 border border-gray-700/50 rounded"></div>
                  <span className="text-gray-400">Past Date</span>
                </div>
                <div className="text-gray-500">
                  Total Rooms: <span className="text-white font-medium">{rooms.length}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {chartLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                renderReservationChart()
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">
              {editingRoom ? 'Edit Room' : 'Add New Room'}
            </h2>
            <button
              onClick={resetForm}
              className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {formError && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-red-400 text-sm">{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="label">Room Number *</label>
              <input
                type="text"
                name="room_number"
                value={formData.room_number}
                onChange={handleInputChange}
                className="input-field"
                placeholder="e.g., 101, 202"
                required
              />
              {editingRoom && (
                <p className="text-xs text-yellow-400 mt-1">
                  ⚠️ Changing room number will update all guest bookings
                </p>
              )}
            </div>

            <div>
              <label className="label">Room Type *</label>
              <select
                name="room_type"
                value={formData.room_type}
                onChange={handleInputChange}
                className="input-field"
                required
              >
                {roomTypes.map(type => (
                  <option key={type.code} value={type.code}>
                    {type.name} ({type.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Floor</label>
              <input
                type="number"
                name="floor"
                value={formData.floor}
                onChange={handleInputChange}
                className="input-field"
                min="1"
                max="10"
              />
            </div>

            <div>
              <label className="label">Base Price (LKR) *</label>
              <input
                type="number"
                name="base_price"
                value={formData.base_price}
                onChange={handleInputChange}
                className="input-field"
                min="0"
                step="100"
                required
              />
            </div>

            <div>
              <label className="label">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="input-field"
              >
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full flex items-center justify-center space-x-2">
                <Save size={20} />
                <span>{editingRoom ? 'Update Room' : 'Add Room'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {roomTypes.map(type => {
          const stats = statsByType[type.code] || { count: 0, occupied: 0, available: 0 }
          return (
            <div key={type.code} className="card p-4">
              <div className="text-sm text-gray-400 mb-2">{type.name}</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Total</span>
                  <span className="text-lg font-bold text-white">{stats.count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-400">Available</span>
                  <span className="text-sm font-bold text-green-400">{stats.available}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-orange-400">Occupied</span>
                  <span className="text-sm font-bold text-orange-400">{stats.occupied}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">All Rooms</h2>
          <div className="flex items-center space-x-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-field text-sm"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-800">
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Room</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Type</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Floor</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Base Price</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Status</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    No rooms found
                  </td>
                </tr>
              ) : (
                filteredRooms.map(room => (
                  <tr
                    key={room.id}
                    className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <span className="text-white font-bold text-lg">{room.room_number}</span>
                    </td>
                    <td className="py-4 px-4 text-gray-300">
                      {roomTypeMap[room.room_type] || room.room_type}
                    </td>
                    <td className="py-4 px-4 text-gray-300">
                      Floor {room.floor || 1}
                    </td>
                    <td className="py-4 px-4 text-primary-400 font-medium">
                      {formatCurrency(room.base_price)}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        room.status === 'available'
                          ? 'bg-green-500/10 text-green-400'
                          : room.status === 'occupied'
                          ? 'bg-orange-500/10 text-orange-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {room.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(room)}
                          className="p-2 hover:bg-dark-700 rounded-lg text-primary-400 transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(room.id)}
                          className="p-2 hover:bg-dark-700 rounded-lg text-red-400 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
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