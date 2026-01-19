import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateGRCNumber } from '../utils/grcGenerator'
import { calculateRoomCharges } from '../utils/calculations'
import { getAvailableRoomsForDateRange } from '../utils/availability'
import { format } from 'date-fns'
import { Save, ArrowLeft, Plus, X } from 'lucide-react'

export default function NewGuest() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [allRooms, setAllRooms] = useState([])
  const [availableRooms, setAvailableRooms] = useState([])
  const [guests, setGuests] = useState([])
  const [formData, setFormData] = useState({
    name_with_initials: '',
    passport_nic: '',
    nationality: '',
    mobile_number: '',
    reservation_number: '',
    voucher_number: '',
    room_numbers: [],
    room_type: 'DBL',
    number_of_rooms: 1,
    number_of_adults: 2,
    number_of_children: 0,
    children_ages: [],
    meal_plan: 'BB',
    date_of_arrival: format(new Date(), 'yyyy-MM-dd'),
    date_of_departure: '',
    time_of_arrival: '14:00',
    time_of_departure: '12:00',
    advance_payment_amount: 0,
    advance_payment_date: format(new Date(), 'yyyy-MM-dd'),
    advance_payment_method: '',
    remarks: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    updateAvailableRooms()
  }, [formData.room_type, formData.date_of_arrival, formData.date_of_departure, allRooms, guests])

  async function loadData() {
    try {
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number')

      const { data: guestsData } = await supabase
        .from('guests')
        .select('*')

      setAllRooms(roomsData || [])
      setGuests(guestsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  function updateAvailableRooms() {
    if (!formData.date_of_arrival || !formData.date_of_departure) {
      setAvailableRooms([])
      return
    }

    const available = getAvailableRoomsForDateRange(
      allRooms.filter(r => r.room_type === formData.room_type),
      guests,
      formData.date_of_arrival,
      formData.date_of_departure,
      formData.room_type
    )

    setAvailableRooms(available.sort((a, b) => a.room_number.localeCompare(b.room_number)))
  }

  const handleChange = (e) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }))
  }

  const handleRoomSelection = (roomNumber) => {
    setFormData(prev => {
      const isSelected = prev.room_numbers.includes(roomNumber)
      const newRooms = isSelected
        ? prev.room_numbers.filter(r => r !== roomNumber)
        : [...prev.room_numbers, roomNumber]
      return {
        ...prev,
        room_numbers: newRooms,
        number_of_rooms: newRooms.length
      }
    })
  }

  const addChildAge = () => {
    setFormData(prev => ({
      ...prev,
      children_ages: [...prev.children_ages, 0]
    }))
  }

  const updateChildAge = (index, age) => {
    setFormData(prev => {
      const newAges = [...prev.children_ages]
      newAges[index] = parseInt(age) || 0
      return { ...prev, children_ages: newAges }
    })
  }

  const removeChildAge = (index) => {
    setFormData(prev => ({
      ...prev,
      children_ages: prev.children_ages.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (formData.room_numbers.length === 0) {
        alert('Please select at least one room')
        setLoading(false)
        return
      }

      const grcNumber = await generateGRCNumber(supabase)

      const selectedRoom = allRooms.find(r => r.room_number === formData.room_numbers[0])
      const roomCharge = calculateRoomCharges(
        formData.date_of_arrival,
        formData.date_of_departure,
        formData.number_of_rooms,
        selectedRoom?.base_price || 0
      )

      const { data: guest, error } = await supabase
        .from('guests')
        .insert([{
          grc_number: grcNumber,
          ...formData,
          total_room_charge: roomCharge,
          status: 'checked_in'
        }])
        .select()
        .single()

      if (error) throw error

      for (const roomNumber of formData.room_numbers) {
        await supabase
          .from('rooms')
          .update({ status: 'occupied' })
          .eq('room_number', roomNumber)
      }

      navigate(`/guests/${guest.id}`)
    } catch (error) {
      console.error('Error creating guest:', error)
      alert('Failed to create guest registration')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white">New Guest Registration</h1>
          <p className="text-gray-400 mt-1">Fill in guest details for check-in</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <span className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm">1</span>
            <span>Guest Details</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Name with Initials *</label>
              <input
                type="text"
                name="name_with_initials"
                value={formData.name_with_initials}
                onChange={handleChange}
                className="input-field"
                required
                placeholder="Mr. A.B. Silva"
              />
            </div>
            <div>
              <label className="label">Passport / NIC Number *</label>
              <input
                type="text"
                name="passport_nic"
                value={formData.passport_nic}
                onChange={handleChange}
                className="input-field"
                required
                placeholder="N1234567V or AB123456"
              />
            </div>
            <div>
              <label className="label">Nationality *</label>
              <input
                type="text"
                name="nationality"
                value={formData.nationality}
                onChange={handleChange}
                className="input-field"
                required
                placeholder="Sri Lankan"
              />
            </div>
            <div>
              <label className="label">Mobile Number *</label>
              <input
                type="tel"
                name="mobile_number"
                value={formData.mobile_number}
                onChange={handleChange}
                className="input-field"
                required
                placeholder="+94 77 123 4567"
              />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <span className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm">2</span>
            <span>Reservation Details</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Reservation Number</label>
              <input
                type="text"
                name="reservation_number"
                value={formData.reservation_number}
                onChange={handleChange}
                className="input-field"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label">Voucher Number</label>
              <input
                type="text"
                name="voucher_number"
                value={formData.voucher_number}
                onChange={handleChange}
                className="input-field"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label">Meal Plan</label>
              <select
                name="meal_plan"
                value={formData.meal_plan}
                onChange={handleChange}
                className="input-field"
              >
                <option value="RO">Room Only</option>
                <option value="BB">Bed & Breakfast (BB)</option>
                <option value="HB">Half Board (HB)</option>
                <option value="FB">Full Board (FB)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <span className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm">3</span>
            <span>Room Selection</span>
          </h2>
          <div className="mb-6">
            <label className="label">Room Type *</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
              {['SGL', 'DBL', 'TPL', 'QUAD', 'FAMILY'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, room_type: type, room_numbers: [] }))}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    formData.room_type === type
                      ? 'border-primary-600 bg-primary-600/10 text-white'
                      : 'border-dark-700 hover:border-dark-600 text-gray-400'
                  }`}
                >
                  <div className="font-bold text-lg">{type}</div>
                  <div className="text-xs mt-1">
                    {type === 'SGL' ? 'Single' : type === 'DBL' ? 'Double' : type === 'TPL' ? 'Triple' : type === 'QUAD' ? 'Quad' : 'Family'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="label">Select Room(s) *</label>
            <p className="text-xs text-gray-500 mb-3">
              Showing {availableRooms.length} available room(s)
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {availableRooms.length > 0 ? (
                availableRooms.map(room => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => handleRoomSelection(room.room_number)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.room_numbers.includes(room.room_number)
                        ? 'border-primary-600 bg-primary-600/10 text-white'
                        : 'border-dark-700 hover:border-dark-600 text-gray-400'
                    }`}
                  >
                    <div className="font-bold text-lg">{room.room_number}</div>
                    <div className="text-xs mt-1">Floor {room.floor || 1}</div>
                  </button>
                ))
              ) : (
                <div className="col-span-full text-center py-8 text-gray-500">
                  {formData.date_of_arrival && formData.date_of_departure
                    ? 'No available rooms for these dates'
                    : 'Select check-in and check-out dates'}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Number of Adults *</label>
              <input
                type="number"
                name="number_of_adults"
                value={formData.number_of_adults}
                onChange={handleChange}
                className="input-field"
                min="1"
                required
              />
            </div>
            <div>
              <label className="label">Number of Children</label>
              <input
                type="number"
                name="number_of_children"
                value={formData.number_of_children}
                onChange={handleChange}
                className="input-field"
                min="0"
              />
            </div>
          </div>

          {formData.number_of_children > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <label className="label">Children Ages</label>
                <button
                  type="button"
                  onClick={addChildAge}
                  className="btn-secondary text-sm py-1 px-3"
                  disabled={formData.children_ages.length >= formData.number_of_children}
                >
                  <Plus size={16} className="inline mr-1" />
                  Add Age
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {formData.children_ages.map((age, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => updateChildAge(index, e.target.value)}
                      className="input-field"
                      min="0"
                      max="17"
                      placeholder="Age"
                    />
                    <button
                      type="button"
                      onClick={() => removeChildAge(index)}
                      className="p-2 hover:bg-dark-800 rounded-lg text-red-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <span className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm">4</span>
            <span>Check-in & Check-out</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Date of Arrival *</label>
              <input
                type="date"
                name="date_of_arrival"
                value={formData.date_of_arrival}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Time of Arrival</label>
              <input
                type="time"
                name="time_of_arrival"
                value={formData.time_of_arrival}
                onChange={handleChange}
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">Standard check-in: 14:00 hrs</p>
            </div>
            <div>
              <label className="label">Date of Departure *</label>
              <input
                type="date"
                name="date_of_departure"
                value={formData.date_of_departure}
                onChange={handleChange}
                className="input-field"
                min={formData.date_of_arrival}
                required
              />
            </div>
            <div>
              <label className="label">Time of Departure</label>
              <input
                type="time"
                name="time_of_departure"
                value={formData.time_of_departure}
                onChange={handleChange}
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">Standard check-out: 12:00 hrs</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <span className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm">5</span>
            <span>Advance Payment (Optional)</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="label">Advance Amount (LKR)</label>
              <input
                type="number"
                name="advance_payment_amount"
                value={formData.advance_payment_amount}
                onChange={handleChange}
                className="input-field"
                min="0"
                step="100"
              />
            </div>
            <div>
              <label className="label">Payment Date</label>
              <input
                type="date"
                name="advance_payment_date"
                value={formData.advance_payment_date}
                onChange={handleChange}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select
                name="advance_payment_method"
                value={formData.advance_payment_method}
                onChange={handleChange}
                className="input-field"
              >
                <option value="">Select method</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online">Online Transfer</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <span className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm">6</span>
            <span>Special Requests & Remarks</span>
          </h2>
          <div>
            <label className="label">Guest Remarks</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="input-field"
              rows="4"
              placeholder="Late check-in, special meals, accessibility requests, etc."
            />
            <p className="text-xs text-gray-500 mt-2">For informational purposes only - does not affect billing</p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex items-center space-x-2"
            disabled={loading}
          >
            <Save size={20} />
            <span>{loading ? 'Saving...' : 'Register Guest'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
