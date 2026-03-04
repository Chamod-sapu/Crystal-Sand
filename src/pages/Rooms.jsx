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
  const [searchGRC, setSearchGRC] = useState('')
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

  const filteredRooms = rooms.filter(room => {
    const matchesStatus = filterStatus === 'all' || room.status === filterStatus
    const matchesSearch = !searchGRC || room.room_number.toLowerCase().includes(searchGRC.toLowerCase())
    return matchesStatus && matchesSearch
  })

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
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>New Room </span>
        </button>
      </div>

      {/* Modal Popup for Add/Edit Room */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-dark-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {editingRoom ? 'Edit Room' : 'Add New Room'}
                </h2>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {formError && (
                <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-red-400 text-sm">{formError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <div className="md:col-span-2">
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
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-dark-800">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex items-center space-x-2">
                  <Save size={20} />
                  <span>{editingRoom ? 'Update Room' : 'Add Room'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search and Filter Section */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1 w-full md:max-w-md">
            <input
              type="text"
              placeholder="Enter GRC Number"
              value={searchGRC}
              onChange={(e) => setSearchGRC(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm text-gray-300">Available</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-sm text-gray-300">Occupied</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span className="text-sm text-gray-300">Reserved</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
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

      {/* Room Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredRooms.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No rooms found
          </div>
        ) : (
          filteredRooms.map(room => (
            <div
              key={room.id}
              className={`card p-5 border-2 transition-all hover:shadow-lg ${
                room.status === 'available'
                  ? 'border-green-500'
                  : room.status === 'occupied'
                  ? 'border-red-500'
                  : 'border-yellow-500'
              }`}
            >
              <div className="space-y-3">
                {/* Room Number */}
                <div className="text-center border-b border-dark-700 pb-3">
                  <h3 className="text-2xl font-bold text-white">Room {room.room_number}</h3>
                </div>

                {/* Room Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Type</span>
                    <span className="text-white font-medium">
                      {roomTypeMap[room.room_type] || room.room_type}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Floor</span>
                    <span className="text-white font-medium">Floor {room.floor || 1}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Base Price</span>
                    <span className="text-primary-400 font-bold">
                      {formatCurrency(room.base_price)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Status</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      room.status === 'available'
                        ? 'bg-green-500/20 text-green-400'
                        : room.status === 'occupied'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-dark-700">
                  <div className="text-gray-400 text-xs mb-2">Actions</div>
                  <div className="flex items-center justify-center space-x-2">
                    <button
                      onClick={() => handleEdit(room)}
                      className="flex-1 flex items-center justify-center space-x-1 p-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-white transition-colors text-sm"
                    >
                      <Edit2 size={16} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(room.id)}
                      className="flex-1 flex items-center justify-center space-x-1 p-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors text-sm"
                    >
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}