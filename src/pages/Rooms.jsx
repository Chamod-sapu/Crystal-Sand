import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency, calculateBillTotal } from '../utils/calculations'
import { Plus, Edit2, Trash2, X, Save, AlertCircle, User, Calendar, Phone, CreditCard, Search, Printer, Receipt, CalendarPlus, LogIn, Tag } from 'lucide-react'
import { format, addDays, differenceInDays } from 'date-fns'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import logo from '../Images/Untitled design (2).png'

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
  const [guests, setGuests] = useState([])
  const [selectedGuestPopup, setSelectedGuestPopup] = useState(null)
  const [purchases, setPurchases] = useState([])
  const [loadingGuestPopup, setLoadingGuestPopup] = useState(false)
  const [showExtendStay, setShowExtendStay] = useState(false)
  const [extendDate, setExtendDate] = useState('')
  const [extendPreview, setExtendPreview] = useState(null)
  const [extendLoading, setExtendLoading] = useState(false)
  const [extendError, setExtendError] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)

  useEffect(() => {
    initializeRoomTypes()
    loadRooms()
    loadRoomTypes()
    loadGuests()
  }, [])

  useEffect(() => {
    if (showExtendStay && extendDate) {
      calculateExtendPreview()
    }
  }, [extendDate, showExtendStay])

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

  async function loadGuests() {
    try {
      const { data } = await supabase
        .from('guests')
        .select('*')
        .not('status', 'eq', 'cancelled')
      setGuests(data || [])
    } catch (error) {
      console.error('Error loading guests:', error)
    }
  }

  async function loadRoomTypes() {
    try {
      const { data } = await supabase
        .from('room_types')
        .select('*')
      setRoomTypes(data || [])
    } catch (error) {
      console.error('Error loading room types:', error)
    }
  }

  async function checkRoomAvailability(guest, newDepartureDate) {
    try {
      const { data: allGuests } = await supabase
        .from('guests')
        .select('*')
        .neq('id', guest.id)
        .neq('status', 'cancelled')

      const currentDeparture = new Date(guest.date_of_departure)
      const newDeparture = new Date(newDepartureDate)

      for (const roomNumber of guest.room_numbers) {
        const conflicts = allGuests?.filter(g => {
          if (!g.room_numbers?.includes(roomNumber)) return false
          
          const guestArrival = new Date(g.date_of_arrival)
          const guestDeparture = new Date(g.date_of_departure)
          
          return (
            (guestArrival > currentDeparture && guestArrival < newDeparture) ||
            (guestDeparture > currentDeparture && guestDeparture <= newDeparture) ||
            (guestArrival <= currentDeparture && guestDeparture >= newDeparture)
          )
        })

        if (conflicts && conflicts.length > 0) {
          return {
            available: false,
            conflictRoom: roomNumber,
            conflictGuest: conflicts[0]
          }
        }
      }

      return { available: true }
    } catch (error) {
      console.error('Error checking availability:', error)
      return { available: false, error: 'Failed to check availability' }
    }
  }

  async function calculateExtendPreview() {
    if (!extendDate || !selectedGuestPopup) return

    const newDepartureDate = new Date(extendDate)
    const currentDeparture = new Date(selectedGuestPopup.date_of_departure)

    if (newDepartureDate <= currentDeparture) {
      setExtendError('New checkout date must be after current checkout date')
      setExtendPreview(null)
      return
    }

    const availabilityCheck = await checkRoomAvailability(selectedGuestPopup, extendDate)
    
    if (!availabilityCheck.available) {
      if (availabilityCheck.conflictRoom) {
        setExtendError(
          `Room ${availabilityCheck.conflictRoom} is not available. It's booked by ${availabilityCheck.conflictGuest.name_with_initials} (${availabilityCheck.conflictGuest.grc_number}) from ${format(new Date(availabilityCheck.conflictGuest.date_of_arrival), 'MMM dd')} to ${format(new Date(availabilityCheck.conflictGuest.date_of_departure), 'MMM dd, yyyy')}`
        )
      } else {
        setExtendError(availabilityCheck.error || 'Rooms not available for selected dates')
      }
      setExtendPreview(null)
      return
    }

    setExtendError('')

    const arrival = new Date(selectedGuestPopup.date_of_arrival)
    let newNights = differenceInDays(newDepartureDate, arrival)
    
    if (newNights === 0 && selectedGuestPopup.date_of_arrival === extendDate) {
      newNights = 1
    }
    
    let additionalNights = differenceInDays(newDepartureDate, currentDeparture)
    if (selectedGuestPopup.date_of_arrival === selectedGuestPopup.date_of_departure) {
      if (newDepartureDate > currentDeparture) {
        additionalNights = Math.max(0, newNights - 1)
      }
    }
    
    const numberOfRooms = selectedGuestPopup.room_numbers.length
    const effectiveNights = selectedGuestPopup.number_of_nights || (selectedGuestPopup.date_of_arrival === selectedGuestPopup.date_of_departure ? 1 : 0)
    const pricePerNight = parseFloat(selectedGuestPopup.total_room_charge) / (effectiveNights * numberOfRooms) || 0
    const additionalCharge = pricePerNight * additionalNights * numberOfRooms
    const newTotalRoomCharge = parseFloat(selectedGuestPopup.total_room_charge) + additionalCharge

    setExtendPreview({
      currentDeparture: format(currentDeparture, 'MMM dd, yyyy'),
      newDeparture: format(newDepartureDate, 'MMM dd, yyyy'),
      currentNights: effectiveNights,
      newNights,
      additionalNights,
      pricePerNight,
      additionalCharge,
      currentRoomCharge: parseFloat(selectedGuestPopup.total_room_charge),
      newTotalRoomCharge
    })
  }

  async function handleExtendStay(e) {
    if (e) e.preventDefault()
    
    if (!extendDate || !extendPreview) {
      setExtendError('Please select a valid extension date')
      return
    }

    setExtendLoading(true)

    try {
      const availabilityCheck = await checkRoomAvailability(selectedGuestPopup, extendDate)
      
      if (!availabilityCheck.available) {
        setExtendError('Room availability changed. Please try again.')
        setExtendLoading(false)
        return
      }

      const { error } = await supabase
        .from('guests')
        .update({
          date_of_departure: extendDate,
          number_of_nights: extendPreview.newNights,
          total_room_charge: extendPreview.newTotalRoomCharge,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedGuestPopup.id)

      if (error) throw error

      // Reload data
      const { data: updatedGuest } = await supabase
        .from('guests')
        .select('*')
        .eq('id', selectedGuestPopup.id)
        .single()
      
      setSelectedGuestPopup(updatedGuest)
      loadGuests()
      loadRooms()
      
      setShowExtendStay(false)
      setExtendDate('')
      setExtendPreview(null)
      setExtendError('')
      
      alert(`Stay extended successfully! New checkout date: ${format(new Date(extendDate), 'MMM dd, yyyy')}`)
    } catch (error) {
      console.error('Error extending stay:', error)
      setExtendError('Failed to extend stay. Please try again.')
    } finally {
      setExtendLoading(false)
    }
  }

  async function handleCheckIn(guestId, roomNumbers) {
    if (!confirm('Are you sure you want to check in this guest?')) return

    setCheckingIn(true)

    try {
      const { error: guestError } = await supabase
        .from('guests')
        .update({ 
          status: 'checked_in',
          updated_at: new Date().toISOString()
        })
        .eq('id', guestId)

      if (guestError) throw guestError

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

      // Reload data
      const { data: updatedGuest } = await supabase
        .from('guests')
        .select('*')
        .eq('id', guestId)
        .single()
      
      setSelectedGuestPopup(updatedGuest)
      loadGuests()
      loadRooms()
      
      alert('Guest checked in successfully!')
    } catch (error) {
      console.error('Error checking in guest:', error)
      alert('Failed to check in guest. Please try again.')
    } finally {
      setCheckingIn(false)
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

  const getGuestForRoom = (roomNumber) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return guests.find(g => 
      g.room_numbers?.includes(roomNumber) && 
      (
        g.status === 'checked_in' || 
        (g.status === 'reserved' && g.date_of_arrival <= today && g.date_of_departure >= today)
      )
    ) || null
  }

  const getEffectiveStatus = (room) => {
    const guest = getGuestForRoom(room.room_number)
    if (guest) {
      return guest.status === 'checked_in' ? 'occupied' : 'reserved'
    }
    // If room is marked as occupied/maintenance in DB but no active guest found, respect the DB status
    return room.status || 'available'
  }

  const filteredRooms = rooms.filter(room => {
    const effectiveStatus = getEffectiveStatus(room)
    const matchesStatus = filterStatus === 'all' || effectiveStatus === filterStatus
    const search = searchGRC.toLowerCase().trim()
    if (!search) return matchesStatus
    
    // Match room number directly
    if (room.room_number.toLowerCase().includes(search)) return matchesStatus
    
    // Match guest fields (GRC, phone, NIC/passport)
    const guest = getGuestForRoom(room.room_number)
    if (guest) {
      const grcMatch = guest.grc_number?.toLowerCase().includes(search)
      const phoneMatch = guest.mobile_number?.toLowerCase().includes(search)
      const nicMatch = guest.passport_nic?.toLowerCase().includes(search)
      if (grcMatch || phoneMatch || nicMatch) return matchesStatus
    }
    return false
  })

  const roomTypeMap = Object.fromEntries(roomTypes.map(rt => [rt.code, rt.name]))

  const statsByType = roomTypes.reduce((acc, type) => {
    const roomsOfType = rooms.filter(r => r.room_type === type.code)
    const count = roomsOfType.length
    const occupied = roomsOfType.filter(r => getEffectiveStatus(r) === 'occupied').length
    const reserved = roomsOfType.filter(r => getEffectiveStatus(r) === 'reserved').length
    const available = roomsOfType.filter(r => getEffectiveStatus(r) === 'available').length
    
    return {
      ...acc,
      [type.code]: { count, occupied, reserved, available }
    }
  }, {})

  async function handleRoomCardClick(room) {
    const guest = getGuestForRoom(room.room_number)
    if (!guest) return
    setLoadingGuestPopup(true)
    setSelectedGuestPopup(guest)
    try {
      const { data } = await supabase
        .from('purchases')
        .select('*')
        .eq('guest_id', guest.id)
        .order('purchase_date', { ascending: false })
      setPurchases(data || [])
    } catch (e) {
      setPurchases([])
    } finally {
      setLoadingGuestPopup(false)
    }
  }

  const generateRoomBillPDF = (guestToPrint = selectedGuestPopup) => {
    if (!guestToPrint) return

    const doc = new jsPDF()
    const cyanColor = [8, 145, 178]

    // Background color for header
    doc.setFillColor(31, 41, 55)
    doc.rect(0, 0, 210, 40, 'F')

    // Logo
    try {
      doc.addImage(logo, 'PNG', 10, 5, 30, 30)
    } catch (e) {
      console.error('Logo not found')
    }

    // Title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('CRYSTAL SANDS', 150, 20, { align: 'right' })

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Room-Only Bill', 150, 28, { align: 'right' })

    // Bill Info
    doc.setTextColor(31, 41, 55)
    doc.setFontSize(10)
    doc.text(`GRC: ${guestToPrint.grc_number}`, 10, 50)
    doc.text(`Date: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, 150, 50)

    // Guest Info Table
    doc.autoTable({
      startY: 60,
      head: [['Guest Information', '']],
      body: [
        ['Guest Name', guestToPrint.name_with_initials],
        ['Passport / NIC', guestToPrint.passport_nic],
        ['Room Number', guestToPrint.room_numbers?.join(', ')],
        ['Room Type', guestToPrint.room_type],
        ['Check-in', `${format(new Date(guestToPrint.date_of_arrival), 'dd MMM yyyy')} ${guestToPrint.time_of_arrival}`],
        ['Check-out', `${format(new Date(guestToPrint.date_of_departure), 'dd MMM yyyy')} ${guestToPrint.time_of_departure}`],
        ['Number of Nights', guestToPrint.number_of_nights]
      ],
      theme: 'grid',
      headStyles: { fillColor: cyanColor, textColor: 255 },
      styles: { fontSize: 9 }
    })

    // Bill Details Table
    const roomCharge = guestToPrint.total_room_charge || 0
    const advancePaid = guestToPrint.advance_payment_amount || 0
    const totalDue = Math.max(0, roomCharge - advancePaid)

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Description', 'Amount (LKR)']],
      body: [
        ['Total Room Charge', formatCurrency(roomCharge)],
        ['Advance Payment', `-${formatCurrency(advancePaid)}`],
        [{ content: 'Total Balance Due', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, 
         { content: formatCurrency(totalDue), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]
      ],
      theme: 'grid',
      headStyles: { fillColor: cyanColor, textColor: 255 },
      styles: { fontSize: 10 }
    })

    // Footer
    const finalY = doc.lastAutoTable.finalY + 20
    doc.setFontSize(9)
    doc.text('Thank you for choosing Crystal Sands!', 105, finalY, { align: 'center' })
    doc.text('This is a room-only bill and does not include additional purchases.', 105, finalY + 5, { align: 'center' })

    doc.save(`RoomBill_${guestToPrint.grc_number}.pdf`)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Rooms Management</h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1">Manage hotel rooms and availability</p>
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
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingRoom ? 'Edit Room' : 'Add New Room'}
                </h2>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-500 dark:text-gray-400" />
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

              <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
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
          <div className="flex-1 w-full md:max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search by Room No., GRC, Phone or NIC/Passport"
              value={searchGRC}
              onChange={(e) => setSearchGRC(e.target.value)}
              className="input-field w-full pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shadow-inner">
              {['all', 'available', 'occupied', 'reserved'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    filterStatus === status
                      ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm scale-110 z-10'
                      : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-4 ml-2 border-l border-slate-200 dark:border-slate-800 pl-4 hidden sm:flex">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm shadow-green-500/50"></div>
                <span className="text-xs text-slate-500 dark:text-gray-400">Available</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full shadow-sm shadow-red-500/50"></div>
                <span className="text-xs text-slate-500 dark:text-gray-400">Occupied</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full shadow-sm shadow-yellow-500/50"></div>
                <span className="text-xs text-slate-500 dark:text-gray-400">Reserved</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {roomTypes.map(type => {
          const stats = statsByType[type.code] || { count: 0, occupied: 0, reserved: 0, available: 0 }
          return (
            <div key={type.code} className="card p-4">
              <div className="text-sm text-slate-500 dark:text-gray-400 mb-2">{type.name}</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-gray-500">Total</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{stats.count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-600 dark:text-green-400">Available</span>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">{stats.available}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-red-600 dark:text-red-400">Occupied</span>
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">{stats.occupied}</span>
                </div>
                {stats.reserved > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-yellow-600 dark:text-yellow-400">Reserved</span>
                    <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{stats.reserved}</span>
                  </div>
                )}
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
          filteredRooms.map(room => {
            const roomGuest = getGuestForRoom(room.room_number)
            return (
              <div
                key={room.id}
                className={`card p-5 border-2 transition-all hover:shadow-lg relative ${
                  getEffectiveStatus(room) === 'available'
                    ? 'border-green-500/50 dark:border-green-400/40'
                    : getEffectiveStatus(room) === 'occupied'
                    ? 'border-red-500/50 dark:border-red-400/40'
                    : 'border-yellow-500/50 dark:border-yellow-400/40'
                }`}
              >
                {roomGuest && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      generateRoomBillPDF(roomGuest)
                    }}
                    className="absolute top-3 right-3 p-2 bg-primary-600/20 hover:bg-primary-600 text-primary-400 hover:text-white rounded-full transition-all"
                    title="Generate Room Bill"
                  >
                    <Receipt size={18} />
                  </button>
                )}
                <div className="space-y-3">
                  {/* Room Number - clickable if has guest */}
                  <div className="text-center border-b border-slate-200 dark:border-slate-700 pb-3">
                    <button
                      onClick={() => roomGuest && handleRoomCardClick(room)}
                      className={`text-2xl font-bold ${
                        roomGuest ? 'text-primary-600 dark:text-primary-400 hover:underline cursor-pointer' : 'text-slate-900 dark:text-white cursor-default'
                      }`}
                      title={roomGuest ? 'Click to view guest details' : ''}
                    >
                      Room {room.room_number}
                    </button>
                    {roomGuest && (
                      <div className="text-xs text-slate-500 dark:text-gray-400 mt-1 truncate">{roomGuest.name_with_initials}</div>
                    )}
                  </div>

                  {/* Room Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-gray-400">Type</span>
                      <span className="text-slate-900 dark:text-white font-medium">
                        {roomTypeMap[room.room_type] || room.room_type}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-gray-400">Floor</span>
                      <span className="text-slate-900 dark:text-white font-medium">Floor {room.floor || 1}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-gray-400">Base Price</span>
                      <span className="text-primary-600 dark:text-primary-400 font-bold">
                        {formatCurrency(room.base_price)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-gray-400">Status</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        getEffectiveStatus(room) === 'available'
                          ? 'bg-green-500/20 text-green-400'
                          : getEffectiveStatus(room) === 'occupied'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {getEffectiveStatus(room).charAt(0).toUpperCase() + getEffectiveStatus(room).slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-slate-500 dark:text-gray-400 text-xs mb-2">Actions</div>
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
            )
          })
        )}
      </div>

      {/* Guest Details Popup */}
      {selectedGuestPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <User className="text-primary-400" size={24} />
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedGuestPopup.name_with_initials}</h2>
                    <p className="text-primary-400 text-sm">{selectedGuestPopup.grc_number}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedGuestPopup(null); setPurchases([]) }}
                  className="p-2 hover:bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-4">
              {loadingGuestPopup ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : showExtendStay ? (
                /* Extend Stay Form */
                <form onSubmit={handleExtendStay} className="space-y-6">
                  <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg space-y-3">
                    <h3 className="text-slate-900 dark:text-white font-semibold mb-3">Current Booking</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 dark:text-gray-400">Check-in</p>
                        <p className="text-slate-900 dark:text-white font-medium">
                          {format(new Date(selectedGuestPopup.date_of_arrival), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-gray-400">Current Check-out</p>
                        <p className="text-slate-900 dark:text-white font-medium">
                          {format(new Date(selectedGuestPopup.date_of_departure), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-gray-400">Current Nights</p>
                        <p className="text-slate-900 dark:text-white font-medium">
                          {selectedGuestPopup.number_of_nights || (selectedGuestPopup.date_of_arrival === selectedGuestPopup.date_of_departure ? 1 : 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-gray-400">Room(s)</p>
                        <p className="text-slate-900 dark:text-white font-medium">{selectedGuestPopup.room_numbers.join(', ')}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="label">New Check-out Date *</label>
                    <input
                      type="date"
                      value={extendDate}
                      onChange={(e) => setExtendDate(e.target.value)}
                      min={format(addDays(new Date(selectedGuestPopup.date_of_departure), 1), 'yyyy-MM-dd')}
                      className="input-field"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Select a date after {format(new Date(selectedGuestPopup.date_of_departure), 'MMM dd, yyyy')}
                    </p>
                  </div>

                  {extendError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start space-x-3">
                      <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                      <p className="text-red-400 text-sm">{extendError}</p>
                    </div>
                  )}

                  {extendPreview && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-3">
                      <h3 className="text-green-400 font-semibold flex items-center space-x-2">
                        <CalendarPlus className="text-slate-900 dark:text-white" size={18} />
                        <span>Extension Preview</span>
                      </h3>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-gray-400">New Check-out Date</span>
                          <span className="text-slate-900 dark:text-white font-medium">{extendPreview.newDeparture}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-gray-400">Additional Nights</span>
                          <span className="text-slate-900 dark:text-white font-medium">+{extendPreview.additionalNights}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-gray-400">Total Nights</span>
                          <span className="text-slate-900 dark:text-white font-medium">
                            {extendPreview.currentNights} → {extendPreview.newNights}
                          </span>
                        </div>
                        
                        <div className="border-t border-green-500/20 pt-3 mt-3 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-gray-400">Price per Night (per room)</span>
                            <span className="text-slate-900 dark:text-white font-medium">
                              {formatCurrency(extendPreview.pricePerNight)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-gray-400">Additional Charges</span>
                            <span className="text-green-400 font-medium">
                              +{formatCurrency(extendPreview.additionalCharge)}
                            </span>
                          </div>
                          <div className="flex justify-between text-base">
                            <span className="text-slate-900 dark:text-white font-semibold">New Total Room Charge</span>
                            <span className="text-green-400 font-bold">
                              {formatCurrency(extendPreview.newTotalRoomCharge)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowExtendStay(false)
                        setExtendDate('')
                        setExtendPreview(null)
                        setExtendError('')
                      }}
                      className="btn-secondary"
                      disabled={extendLoading}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="btn-primary flex items-center space-x-2"
                      disabled={extendLoading || !extendPreview || !!extendError}
                    >
                      {extendLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <CalendarPlus className="text-slate-900 dark:text-white" size={18} />
                          <span>Confirm Extension</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start space-x-3">
                      <CreditCard className="text-primary-400 mt-1" size={18} />
                      <div>
                        <p className="text-slate-500 dark:text-gray-400 text-xs">NIC / Passport</p>
                        <p className="text-slate-900 dark:text-white font-medium">{selectedGuestPopup.passport_nic}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Phone className="text-primary-400 mt-1" size={18} />
                      <div>
                        <p className="text-slate-500 dark:text-gray-400 text-xs">Mobile</p>
                        <p className="text-slate-900 dark:text-white font-medium">{selectedGuestPopup.mobile_number}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Calendar className="text-slate-900 dark:text-white mt-1" size={18} />
                      <div>
                        <p className="text-slate-500 dark:text-gray-400 text-xs">Check-in</p>
                        <p className="text-slate-900 dark:text-white font-medium">{format(new Date(selectedGuestPopup.date_of_arrival), 'dd MMM yyyy')} {selectedGuestPopup.time_of_arrival}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Calendar className="text-slate-900 dark:text-white mt-1" size={18} />
                      <div>
                        <p className="text-slate-500 dark:text-gray-400 text-xs">Check-out</p>
                        <p className="text-slate-900 dark:text-white font-medium">{format(new Date(selectedGuestPopup.date_of_departure), 'dd MMM yyyy')} {selectedGuestPopup.time_of_departure}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-xs text-gray-500">Room(s)</p>
                        <p className="text-slate-900 dark:text-white font-bold">{selectedGuestPopup.room_numbers?.join(', ')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Room Type</p>
                        <p className="text-slate-900 dark:text-white font-bold">{selectedGuestPopup.room_type}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Meal Plan</p>
                        <p className="text-slate-900 dark:text-white font-bold">{selectedGuestPopup.meal_plan || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Adults</p>
                        <p className="text-slate-900 dark:text-white font-bold">{selectedGuestPopup.number_of_adults}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Children</p>
                        <p className="text-slate-900 dark:text-white font-bold">{selectedGuestPopup.number_of_children}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Nights</p>
                        <p className="text-slate-900 dark:text-white font-bold">{selectedGuestPopup.number_of_nights}</p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Actions */}
                  <div className="space-y-4">
                    <div className="bg-primary-600/10 border border-primary-600/20 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-slate-900 dark:text-white font-semibold">Bill Summary</h3>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-medium ${
                          selectedGuestPopup.status === 'reserved'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-green-500/10 text-green-400'
                        }`}>
                          {selectedGuestPopup.status === 'reserved' ? 'Reserved' : 'Checked In'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-gray-400">Total Room Charge</span>
                          <span className="text-slate-900 dark:text-white font-medium">{formatCurrency(selectedGuestPopup.total_room_charge || 0)}</span>
                        </div>
                        {selectedGuestPopup.advance_payment_amount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-gray-400">Advance Paid</span>
                            <span className="text-green-400 font-medium">-{formatCurrency(selectedGuestPopup.advance_payment_amount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-primary-600/20">
                          <span className="text-slate-900 dark:text-white font-bold">Balance Due</span>
                          <span className="text-primary-400 font-bold text-lg">
                            {formatCurrency(Math.max(0, (selectedGuestPopup.total_room_charge || 0) - (selectedGuestPopup.advance_payment_amount || 0)))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={generateRoomBillPDF}
                        className="btn-secondary flex items-center justify-center space-x-2"
                      >
                        <Printer size={18} />
                        <span>Room Bill</span>
                      </button>

                      {selectedGuestPopup.status === 'checked_in' ? (
                        <button
                          onClick={() => setShowExtendStay(true)}
                          className="btn-primary flex items-center justify-center space-x-2"
                        >
                          <CalendarPlus className="text-slate-900 dark:text-white" size={18} />
                          <span>Extend Stay</span>
                        </button>
                      ) : selectedGuestPopup.status === 'reserved' ? (
                        <button
                          onClick={() => handleCheckIn(selectedGuestPopup.id, selectedGuestPopup.room_numbers)}
                          disabled={checkingIn}
                          className="btn-primary flex items-center justify-center space-x-2"
                        >
                          {checkingIn ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <LogIn size={18} />
                          )}
                          <span>Check In</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
