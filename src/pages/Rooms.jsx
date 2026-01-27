import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../utils/calculations'
import { Plus, Edit2, Trash2, X, Save, AlertCircle } from 'lucide-react'

/*
Note: To solve the check constraint violation when saving a room with room_type '6PAX', 
you need to update the database schema.

Run the following SQL in the Supabase dashboard's SQL editor:

ALTER TABLE rooms DROP CONSTRAINT rooms_room_type_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_room_type_fkey FOREIGN KEY (room_type) REFERENCES room_types (code);

This replaces the check constraint with a foreign key constraint, allowing any type inserted into room_types to be valid in rooms.
Make sure all existing room_type values in rooms table exist in room_types.code before adding the FK.
*/

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

  useEffect(() => {
    initializeRoomTypes()
    loadRooms()
    loadRoomTypes()
  }, [])

  async function initializeRoomTypes() {
    try {
      // Check if 6 pax room type exists
      const { data: existingType } = await supabase
        .from('room_types')
        .select('code')
        .eq('code', '6PAX')

      // If it doesn't exist, create it
      if (existingType.length === 0) {
        await supabase
          .from('room_types')
          .insert([{
            code: '6PAX',
            name: '6 Pax'
          }])
      }
    } catch (error) {
      console.error('Error initializing room types:', error)
    }
  }

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

    if (isNaN(formData.floor) || formData.floor < 1 || !Number.isInteger(formData.floor)) {
      setFormError('Floor must be a positive integer')
      return
    }

    if (isNaN(formData.base_price) || formData.base_price < 0) {
      setFormError('Base price must be a non-negative number')
      return
    }

    try {
      const { data: existingRooms, error: checkError } = await supabase
        .from('rooms')
        .select('id, room_number')
        .eq('room_number', formData.room_number.trim())

      if (checkError) throw checkError

      if (existingRooms.length > 1) {
        setFormError(`Multiple rooms with number ${formData.room_number} exist. Please clean up the database.`)
        return
      }

      if (existingRooms.length === 1 && (!editingRoom || existingRooms[0].id !== editingRoom.id)) {
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
      setFormError('Failed to save room: ' + (error.message || 'Unknown error'))
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Rooms Management</h1>
          <p className="text-gray-400 mt-1">Manage hotel rooms and availability</p>
        </div>
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