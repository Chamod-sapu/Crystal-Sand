import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../utils/calculations'
import {
  Coffee,
  Plus,
  X,
  Edit2,
  Trash2,
  ShoppingCart,
  User,
  Calendar,
  CheckCircle,
  AlertCircle,
  Search
} from 'lucide-react'
import { format } from 'date-fns'

export default function FoodBeverage() {
  const [rooms, setRooms] = useState([])
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [showPanel, setShowPanel] = useState(false)
  const [consumptions, setConsumptions] = useState([])
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [settings, setSettings] = useState(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [notification, setNotification] = useState(null)

  const [newItem, setNewItem] = useState({
    category_id: '',
    item_id: '',
    quantity: 1,
    unit_price: 0,
    item_name: '',
    category_name: ''
  })

  useEffect(() => {
    loadData()
    loadCategories()
    loadMenuItems()
    loadSettings()
  }, [])

  useEffect(() => {
    if (selectedRoom) {
      loadConsumptions(selectedRoom.id)
    }
  }, [selectedRoom])

  async function loadData() {
    try {
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number')

      const { data: guestsData } = await supabase
        .from('guests')
        .select('*')
        .in('status', ['checked_in', 'reserved'])

      setRooms(roomsData || [])
      setGuests(guestsData || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  async function loadCategories() {
    const { data } = await supabase
      .from('fb_categories')
      .select('*')
      .order('name')

    setCategories(data || [])
  }

  async function loadMenuItems() {
    const { data } = await supabase
      .from('fb_menu_items')
      .select(`
        *,
        category:fb_categories(name)
      `)
      .eq('is_active', true)
      .order('item_name')

    setMenuItems(data || [])
  }

  async function loadSettings() {
    const { data } = await supabase
      .from('fb_settings')
      .select('*')
      .limit(1)
      .single()

    setSettings(data)
  }

  async function loadConsumptions(roomId) {
    const { data } = await supabase
      .from('fb_consumption')
      .select('*')
      .eq('room_id', roomId)
      .order('consumed_at', { ascending: false })

    setConsumptions(data || [])
  }

  function showNotification(message, type = 'success') {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  function getRoomGuest(roomNumber) {
    return guests.find(g => g.room_numbers?.includes(roomNumber))
  }

  function getRoomStatus(room) {
    const guest = getRoomGuest(room.room_number)
    if (guest) return 'occupied'
    return room.status
  }

  function getRoomStatusColor(status) {
    switch (status) {
      case 'occupied':
        return 'border-red-500'
      case 'available':
        return 'border-green-500'
      case 'reserved':
        return 'border-yellow-500'
      default:
        return 'border-gray-500'
    }
  }

  function getConsumptionCount(roomId) {
    const roomConsumptions = consumptions.filter(c => c.room_id === roomId)
    return roomConsumptions.reduce((sum, c) => sum + c.quantity, 0)
  }

  function handleRoomClick(room) {
    const status = getRoomStatus(room)
    if (status !== 'occupied') {
      showNotification('Cannot add items to vacant rooms', 'error')
      return
    }

    setSelectedRoom(room)
    setShowPanel(true)
  }

  function closePanel() {
    setShowPanel(false)
    setSelectedRoom(null)
    setConsumptions([])
    setShowAddItem(false)
    resetNewItem()
  }

  function resetNewItem() {
    setNewItem({
      category_id: '',
      item_id: '',
      quantity: 1,
      unit_price: 0,
      item_name: '',
      category_name: ''
    })
  }

  function handleCategoryChange(categoryId) {
    const category = categories.find(c => c.id === categoryId)
    setNewItem({
      ...newItem,
      category_id: categoryId,
      category_name: category?.name || '',
      item_id: '',
      item_name: '',
      unit_price: 0
    })
  }

  function handleItemChange(itemId) {
    const item = menuItems.find(m => m.id === itemId)
    if (item) {
      setNewItem({
        ...newItem,
        item_id: itemId,
        item_name: item.item_name,
        unit_price: item.unit_price
      })
    }
  }

  async function handleAddItem(e) {
    e.preventDefault()

    if (!newItem.item_name || !newItem.category_name || newItem.quantity < 1) {
      showNotification('Please fill all required fields', 'error')
      return
    }

    const guest = getRoomGuest(selectedRoom.room_number)
    const totalPrice = newItem.quantity * newItem.unit_price

    try {
      const { error } = await supabase
        .from('fb_consumption')
        .insert([{
          room_id: selectedRoom.id,
          guest_id: guest?.id || null,
          item_id: newItem.item_id || null,
          item_name: newItem.item_name,
          category: newItem.category_name,
          quantity: newItem.quantity,
          unit_price: newItem.unit_price,
          total_price: totalPrice
        }])

      if (error) throw error

      showNotification('Item added successfully', 'success')
      loadConsumptions(selectedRoom.id)
      setShowAddItem(false)
      resetNewItem()
    } catch (error) {
      console.error('Error adding item:', error)
      showNotification('Failed to add item', 'error')
    }
  }

  async function handleUpdateQuantity(consumptionId, newQuantity) {
    if (newQuantity < 1) return

    const consumption = consumptions.find(c => c.id === consumptionId)
    const newTotal = newQuantity * consumption.unit_price

    try {
      const { error } = await supabase
        .from('fb_consumption')
        .update({
          quantity: newQuantity,
          total_price: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', consumptionId)

      if (error) throw error

      showNotification('Quantity updated', 'success')
      loadConsumptions(selectedRoom.id)
    } catch (error) {
      console.error('Error updating quantity:', error)
      showNotification('Failed to update quantity', 'error')
    }
  }

  async function handleDeleteItem(consumptionId) {
    try {
      const { error } = await supabase
        .from('fb_consumption')
        .delete()
        .eq('id', consumptionId)

      if (error) throw error

      showNotification('Item removed', 'success')
      loadConsumptions(selectedRoom.id)
    } catch (error) {
      console.error('Error deleting item:', error)
      showNotification('Failed to remove item', 'error')
    }
  }

  function calculateSummary() {
    const subtotal = consumptions.reduce((sum, c) => sum + parseFloat(c.total_price), 0)
    const serviceCharge = subtotal * ((settings?.service_charge_percentage || 0) / 100)
    const vat = (subtotal + serviceCharge) * ((settings?.vat_percentage || 0) / 100)
    const grandTotal = subtotal + serviceCharge + vat

    return { subtotal, serviceCharge, vat, grandTotal }
  }

  async function handleAddToRoomBill() {
    if (consumptions.length === 0) {
      showNotification('No items to add to bill', 'error')
      return
    }

    const guest = getRoomGuest(selectedRoom.room_number)
    if (!guest) {
      showNotification('No guest found for this room', 'error')
      return
    }

    try {
      // Add each consumption as a purchase
      for (const consumption of consumptions) {
        await supabase
          .from('purchases')
          .insert([{
            guest_id: guest.id,
            item_name: consumption.item_name,
            category: consumption.category.toLowerCase(),
            quantity: consumption.quantity,
            unit_price: consumption.unit_price,
            total_price: consumption.total_price,
            purchase_date: consumption.consumed_at
          }])
      }

      // Delete consumptions after adding to bill
      await supabase
        .from('fb_consumption')
        .delete()
        .eq('room_id', selectedRoom.id)

      showNotification('Items added to room bill successfully', 'success')
      loadConsumptions(selectedRoom.id)
      closePanel()
    } catch (error) {
      console.error('Error adding to room bill:', error)
      showNotification('Failed to add to room bill', 'error')
    }
  }

  const filteredRooms = searchTerm
    ? rooms.filter(room => {
        const roomMatch = room.room_number.toLowerCase().includes(searchTerm.toLowerCase())
        const guest = getRoomGuest(room.room_number)
        const guestMatch = guest?.name_with_initials.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          guest?.grc_number.toLowerCase().includes(searchTerm.toLowerCase())
        return roomMatch || guestMatch
      })
    : rooms

  const filteredMenuItems = menuItems.filter(item =>
    !newItem.category_id || item.category_id === newItem.category_id
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const summary = selectedRoom ? calculateSummary() : null
  const currentGuest = selectedRoom ? getRoomGuest(selectedRoom.room_number) : null

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 animate-in slide-in-from-top-5 duration-300 ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3`}>
          {notification.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
            <Coffee size={32} className="text-primary-400" />
            <span>Food & Beverage Management</span>
          </h1>
          <p className="text-gray-400 mt-1">Manage room-based food and beverage consumption</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card p-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search by room number, guest name, or GRC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Rooms Grid */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-white mb-6">Rooms</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
          {filteredRooms.map(room => {
            const status = getRoomStatus(room)
            const guest = getRoomGuest(room.room_number)
            const itemCount = getConsumptionCount(room.id)

            return (
              <button
                key={room.id}
                onClick={() => handleRoomClick(room)}
                className={`relative p-6 rounded-lg border-2 transition-all duration-200 ${
                  getRoomStatusColor(status)
                } ${
                  status === 'occupied'
                    ? 'bg-dark-800 hover:bg-dark-700 cursor-pointer hover:scale-105'
                    : 'bg-dark-900 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-white mb-2">
                    {room.room_number}
                  </div>
                  <div className={`text-xs font-medium ${
                    status === 'occupied' ? 'text-red-400' :
                    status === 'available' ? 'text-green-400' :
                    'text-yellow-400'
                  }`}>
                    {status.toUpperCase()}
                  </div>
                  {guest && (
                    <div className="mt-2 text-xs text-gray-400 truncate">
                      {guest.name_with_initials}
                    </div>
                  )}
                  {itemCount > 0 && (
                    <div className="absolute -top-2 -right-2 bg-primary-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-lg">
                      {itemCount}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Consumption Panel */}
      {showPanel && selectedRoom && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end animate-in fade-in duration-300">
          <div className="bg-dark-900 h-full w-full max-w-4xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
            {/* Panel Header */}
            <div className="bg-dark-800 border-b border-dark-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                  <ShoppingCart size={24} className="text-primary-400" />
                  <span>Room {selectedRoom.room_number} - F&B Consumption</span>
                </h2>
                <button
                  onClick={closePanel}
                  className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              {/* Guest Info */}
              {currentGuest && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-dark-700 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <User className="text-primary-400" size={18} />
                    <div>
                      <div className="text-xs text-gray-500">Guest Name</div>
                      <div className="text-white font-medium">{currentGuest.name_with_initials}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="text-primary-400" size={18} />
                    <div>
                      <div className="text-xs text-gray-500">GRC Number</div>
                      <div className="text-primary-400 font-medium">{currentGuest.grc_number}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="text-primary-400" size={18} />
                    <div>
                      <div className="text-xs text-gray-500">Check-in</div>
                      <div className="text-white font-medium">
                        {format(new Date(currentGuest.date_of_arrival), 'MMM dd, yyyy')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="text-green-400" size={18} />
                    <div>
                      <div className="text-xs text-gray-500">Status</div>
                      <div className="text-green-400 font-medium">
                        {currentGuest.status.replace('_', ' ').toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Consumption Items</h3>
                <button
                  onClick={() => setShowAddItem(true)}
                  className="btn-primary flex items-center space-x-2 text-sm"
                >
                  <Plus size={18} />
                  <span>Add Item</span>
                </button>
              </div>

              {/* Add Item Form */}
              {showAddItem && (
                <form onSubmit={handleAddItem} className="mb-6 p-6 bg-dark-800 rounded-lg border border-primary-600/20">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-semibold">Add New Item</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddItem(false)
                        resetNewItem()
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Category *</label>
                      <select
                        value={newItem.category_id}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="input-field"
                        required
                      >
                        <option value="">Select Category</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Item *</label>
                      <select
                        value={newItem.item_id}
                        onChange={(e) => handleItemChange(e.target.value)}
                        className="input-field"
                        required
                        disabled={!newItem.category_id}
                      >
                        <option value="">Select Item</option>
                        {filteredMenuItems.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.item_name} - {formatCurrency(item.unit_price)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Quantity *</label>
                      <input
                        type="number"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                        className="input-field"
                        min="1"
                        required
                      />
                    </div>

                    <div>
                      <label className="label">Unit Price (LKR) *</label>
                      <input
                        type="number"
                        value={newItem.unit_price}
                        onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                        className="input-field"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-dark-700 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Total</span>
                      <span className="text-primary-400 font-bold text-lg">
                        {formatCurrency(newItem.quantity * newItem.unit_price)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddItem(false)
                        resetNewItem()
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Add Item
                    </button>
                  </div>
                </form>
              )}

              {/* Consumption Table */}
              {consumptions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Coffee size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No items consumed yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-dark-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Item Name</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Category</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Qty</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Unit Price</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Total</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Time</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumptions.map(consumption => (
                        <tr key={consumption.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                          <td className="py-4 px-4 text-white font-medium">{consumption.item_name}</td>
                          <td className="py-4 px-4">
                            <span className="px-2 py-1 bg-primary-600/20 text-primary-400 rounded text-xs">
                              {consumption.category}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleUpdateQuantity(consumption.id, consumption.quantity - 1)}
                                className="w-6 h-6 flex items-center justify-center bg-dark-700 hover:bg-dark-600 rounded text-white text-sm"
                              >
                                -
                              </button>
                              <span className="text-white font-medium w-8 text-center">{consumption.quantity}</span>
                              <button
                                onClick={() => handleUpdateQuantity(consumption.id, consumption.quantity + 1)}
                                className="w-6 h-6 flex items-center justify-center bg-dark-700 hover:bg-dark-600 rounded text-white text-sm"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-gray-300">{formatCurrency(consumption.unit_price)}</td>
                          <td className="py-4 px-4 text-primary-400 font-bold">{formatCurrency(consumption.total_price)}</td>
                          <td className="py-4 px-4 text-gray-400 text-sm">
                            {format(new Date(consumption.consumed_at), 'MMM dd, HH:mm')}
                          </td>
                          <td className="py-4 px-4">
                            <button
                              onClick={() => handleDeleteItem(consumption.id)}
                              className="p-2 hover:bg-dark-700 rounded-lg text-red-400 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Summary Footer */}
            {consumptions.length > 0 && summary && (
              <div className="bg-dark-800 border-t border-dark-700 p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatCurrency(summary.subtotal)}</span>
                  </div>
                  {settings?.service_charge_percentage > 0 && (
                    <div className="flex items-center justify-between text-gray-400">
                      <span>Service Charge ({settings.service_charge_percentage}%)</span>
                      <span className="font-medium">{formatCurrency(summary.serviceCharge)}</span>
                    </div>
                  )}
                  {settings?.vat_percentage > 0 && (
                    <div className="flex items-center justify-between text-gray-400">
                      <span>VAT ({settings.vat_percentage}%)</span>
                      <span className="font-medium">{formatCurrency(summary.vat)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-dark-700">
                    <span className="text-white font-bold text-xl">Grand Total</span>
                    <span className="text-primary-400 font-bold text-2xl">
                      {formatCurrency(summary.grandTotal)}
                    </span>
                  </div>
                  <button
                    onClick={handleAddToRoomBill}
                    className="w-full btn-primary py-4 text-lg mt-4"
                  >
                    Add to Room Bill
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
