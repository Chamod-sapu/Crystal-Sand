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
  Search,
  ChefHat,
  Receipt,
  Utensils,
  Save
} from 'lucide-react'
import { format } from 'date-fns'

export default function FoodBeverage() {
  const [rooms, setRooms] = useState([])
  const [tables, setTables] = useState([])
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [selectedTable, setSelectedTable] = useState(null)
  const [showPanel, setShowPanel] = useState(false)
  const [showRestaurantPanel, setShowRestaurantPanel] = useState(false)
  const [consumptions, setConsumptions] = useState([])
  const [restaurantOrders, setRestaurantOrders] = useState([])
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [restaurantItems, setRestaurantItems] = useState([])
  const [settings, setSettings] = useState(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [showAddRestaurantItem, setShowAddRestaurantItem] = useState(false)
  const [showManageRestaurantItems, setShowManageRestaurantItems] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [notification, setNotification] = useState(null)
  const [editingRestaurantItem, setEditingRestaurantItem] = useState(null)

  const [newItem, setNewItem] = useState({
    category_id: '',
    item_id: '',
    quantity: 1,
    unit_price: 0,
    item_name: '',
    category_name: ''
  })

  const [newRestaurantOrder, setNewRestaurantOrder] = useState({
    item_id: '',
    quantity: 1,
    unit_price: 0,
    item_name: '',
    notes: ''
  })

  const [newRestaurantItem, setNewRestaurantItem] = useState({
    item_name: '',
    category: 'main_course',
    unit_price: 0,
    description: '',
    is_available: true
  })

  useEffect(() => {
    loadData()
    loadCategories()
    loadMenuItems()
    loadSettings()
    loadRestaurantItems()
    initializeTables()
  }, [])

  useEffect(() => {
    if (selectedRoom) {
      loadConsumptions(selectedRoom.id)
    }
  }, [selectedRoom])

  useEffect(() => {
    if (selectedTable) {
      loadRestaurantOrders(selectedTable.id)
    }
  }, [selectedTable])

  async function initializeTables() {
    try {
      const { data: existingTables } = await supabase
        .from('restaurant_tables')
        .select('*')

      if (!existingTables || existingTables.length === 0) {
        // Create default tables T1-T7
        const defaultTables = Array.from({ length: 7 }, (_, i) => ({
          table_number: `T${i + 1}`,
          capacity: 4,
          status: 'available'
        }))

        await supabase
          .from('restaurant_tables')
          .insert(defaultTables)
      }

      loadTables()
    } catch (error) {
      console.error('Error initializing tables:', error)
    }
  }

  async function loadTables() {
    try {
      const { data } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number')

      setTables(data || [])
    } catch (error) {
      console.error('Error loading tables:', error)
    }
  }

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

  async function loadRestaurantItems() {
    try {
      const { data } = await supabase
        .from('restaurant_items')
        .select('*')
        .order('item_name')

      setRestaurantItems(data || [])
    } catch (error) {
      console.error('Error loading restaurant items:', error)
    }
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

  async function loadRestaurantOrders(tableId) {
    const { data } = await supabase
      .from('restaurant_orders')
      .select('*')
      .eq('table_id', tableId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    setRestaurantOrders(data || [])
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

  function getTableStatusColor(status) {
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

  function getTableOrderCount(tableId) {
    return restaurantOrders.filter(o => o.table_id === tableId).length
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

  function handleTableClick(table) {
    setSelectedTable(table)
    setShowRestaurantPanel(true)
  }

  function closePanel() {
    setShowPanel(false)
    setSelectedRoom(null)
    setConsumptions([])
    setShowAddItem(false)
    resetNewItem()
  }

  function closeRestaurantPanel() {
    setShowRestaurantPanel(false)
    setSelectedTable(null)
    setRestaurantOrders([])
    setShowAddRestaurantItem(false)
    resetNewRestaurantOrder()
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

  function resetNewRestaurantOrder() {
    setNewRestaurantOrder({
      item_id: '',
      quantity: 1,
      unit_price: 0,
      item_name: '',
      notes: ''
    })
  }

  function resetNewRestaurantItem() {
    setNewRestaurantItem({
      item_name: '',
      category: 'main_course',
      unit_price: 0,
      description: '',
      is_available: true
    })
    setEditingRestaurantItem(null)
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

  function handleRestaurantItemChange(itemId) {
    const item = restaurantItems.find(i => i.id === itemId)
    if (item) {
      setNewRestaurantOrder({
        ...newRestaurantOrder,
        item_id: itemId,
        item_name: item.item_name,
        unit_price: item.unit_price
      })
    }
  }

  async function handleAddItem(e) {
    e.preventDefault()

    if (!newItem.item_name || newItem.quantity < 1) {
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
          category: newItem.category || 'food',
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

  async function handleAddRestaurantOrder(e) {
    e.preventDefault()

    if (!newRestaurantOrder.item_name || newRestaurantOrder.quantity < 1) {
      showNotification('Please fill all required fields', 'error')
      return
    }

    const totalPrice = newRestaurantOrder.quantity * newRestaurantOrder.unit_price

    try {
      const { error } = await supabase
        .from('restaurant_orders')
        .insert([{
          table_id: selectedTable.id,
          item_id: newRestaurantOrder.item_id || null,
          item_name: newRestaurantOrder.item_name,
          quantity: newRestaurantOrder.quantity,
          unit_price: newRestaurantOrder.unit_price,
          total_price: totalPrice,
          notes: newRestaurantOrder.notes,
          status: 'pending'
        }])

      if (error) throw error

      // Update table status to occupied
      await supabase
        .from('restaurant_tables')
        .update({ status: 'occupied' })
        .eq('id', selectedTable.id)

      showNotification('Order added successfully', 'success')
      loadRestaurantOrders(selectedTable.id)
      loadTables()
      setShowAddRestaurantItem(false)
      resetNewRestaurantOrder()
    } catch (error) {
      console.error('Error adding order:', error)
      showNotification('Failed to add order', 'error')
    }
  }

  async function handleSaveRestaurantItem(e) {
    e.preventDefault()

    if (!newRestaurantItem.item_name || newRestaurantItem.unit_price < 0) {
      showNotification('Please fill all required fields', 'error')
      return
    }

    try {
      if (editingRestaurantItem) {
        const { error } = await supabase
          .from('restaurant_items')
          .update(newRestaurantItem)
          .eq('id', editingRestaurantItem.id)

        if (error) throw error
        showNotification('Item updated successfully', 'success')
      } else {
        const { error } = await supabase
          .from('restaurant_items')
          .insert([newRestaurantItem])

        if (error) throw error
        showNotification('Item added successfully', 'success')
      }

      loadRestaurantItems()
      resetNewRestaurantItem()
    } catch (error) {
      console.error('Error saving restaurant item:', error)
      showNotification('Failed to save item', 'error')
    }
  }

  async function handleDeleteRestaurantItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const { error } = await supabase
        .from('restaurant_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error

      showNotification('Item deleted successfully', 'success')
      loadRestaurantItems()
    } catch (error) {
      console.error('Error deleting item:', error)
      showNotification('Failed to delete item', 'error')
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

  async function handleUpdateOrderQuantity(orderId, newQuantity) {
    if (newQuantity < 1) return

    const order = restaurantOrders.find(o => o.id === orderId)
    const newTotal = newQuantity * order.unit_price

    try {
      const { error } = await supabase
        .from('restaurant_orders')
        .update({
          quantity: newQuantity,
          total_price: newTotal
        })
        .eq('id', orderId)

      if (error) throw error

      showNotification('Quantity updated', 'success')
      loadRestaurantOrders(selectedTable.id)
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

  async function handleDeleteOrder(orderId) {
    try {
      const { error } = await supabase
        .from('restaurant_orders')
        .delete()
        .eq('id', orderId)

      if (error) throw error

      showNotification('Order removed', 'success')
      loadRestaurantOrders(selectedTable.id)

      // Check if table has any remaining orders
      const { data: remainingOrders } = await supabase
        .from('restaurant_orders')
        .select('id')
        .eq('table_id', selectedTable.id)
        .eq('status', 'pending')

      if (!remainingOrders || remainingOrders.length === 0) {
        await supabase
          .from('restaurant_tables')
          .update({ status: 'available' })
          .eq('id', selectedTable.id)
        
        loadTables()
      }
    } catch (error) {
      console.error('Error deleting order:', error)
      showNotification('Failed to remove order', 'error')
    }
  }

  function calculateSummary() {
    const subtotal = consumptions.reduce((sum, c) => sum + parseFloat(c.total_price), 0)
    const serviceCharge = subtotal * ((settings?.service_charge_percentage || 0) / 100)
    const vat = (subtotal + serviceCharge) * ((settings?.vat_percentage || 0) / 100)
    const grandTotal = subtotal + serviceCharge + vat

    return { subtotal, serviceCharge, vat, grandTotal }
  }

  function calculateRestaurantSummary() {
    const subtotal = restaurantOrders.reduce((sum, o) => sum + parseFloat(o.total_price), 0)
    const serviceCharge = subtotal * ((settings?.service_charge_percentage || 0) / 100)
    const vat = (subtotal + serviceCharge) * ((settings?.vat_percentage || 0) / 100)
    const grandTotal = subtotal + serviceCharge + vat

    return { subtotal, serviceCharge, vat, grandTotal }
  }

  async function handlePrintKitchenBill() {
    if (restaurantOrders.length === 0) {
      showNotification('No orders to print', 'error')
      return
    }

    const summary = calculateRestaurantSummary()
    
    const billContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Kitchen Order - Table ${selectedTable.table_number}</title>
  <style>
    body { font-family: monospace; width: 300px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
    .order-info { margin-bottom: 20px; }
    .items { margin-bottom: 20px; }
    .item { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .item-name { font-weight: bold; }
    .notes { font-size: 12px; font-style: italic; color: #666; margin-top: 5px; }
    .footer { border-top: 2px dashed #000; padding-top: 10px; text-align: center; }
    @media print {
      body { width: auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🍽️ KITCHEN ORDER</h1>
    <p>Table: ${selectedTable.table_number}</p>
    <p>Time: ${format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
  </div>
  
  <div class="items">
    ${restaurantOrders.map(order => `
      <div class="item">
        <div>
          <div class="item-name">${order.quantity}x ${order.item_name}</div>
          ${order.notes ? `<div class="notes">Note: ${order.notes}</div>` : ''}
        </div>
      </div>
    `).join('')}
  </div>
  
  <div class="footer">
    <p>Please prepare these items</p>
  </div>
  
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 100);
    }
  </script>
</body>
</html>
    `

    const printWindow = window.open('', '', 'width=400,height=600')
    printWindow.document.write(billContent)
    printWindow.document.close()
  }

  async function handlePrintReceptionBill() {
    if (restaurantOrders.length === 0) {
      showNotification('No orders to print', 'error')
      return
    }

    const summary = calculateRestaurantSummary()
    
    const billContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Bill - Table ${selectedTable.table_number}</title>
  <style>
    body { font-family: Arial, sans-serif; width: 400px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; font-size: 24px; margin-bottom: 10px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
    .bill-info { margin-bottom: 20px; }
    .items { margin-bottom: 20px; }
    .item { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 5px 0; }
    .item-details { flex: 1; }
    .item-price { text-align: right; font-weight: bold; }
    .summary { border-top: 2px solid #000; padding-top: 15px; margin-top: 20px; }
    .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .total { font-size: 18px; font-weight: bold; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; }
    @media print {
      body { width: auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Restaurant Bill</h1>
    <p>Table: ${selectedTable.table_number}</p>
    <p>Date: ${format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
  </div>
  
  <div class="items">
    ${restaurantOrders.map(order => `
      <div class="item">
        <div class="item-details">
          ${order.quantity} x ${order.item_name}<br/>
          <small style="color: #666;">${formatCurrency(order.unit_price)} each</small>
        </div>
        <div class="item-price">${formatCurrency(order.total_price)}</div>
      </div>
    `).join('')}
  </div>
  
  <div class="summary">
    <div class="summary-row">
      <span>Subtotal:</span>
      <span>${formatCurrency(summary.subtotal)}</span>
    </div>
    ${settings?.service_charge_percentage > 0 ? `
    <div class="summary-row">
      <span>Service Charge (${settings.service_charge_percentage}%):</span>
      <span>${formatCurrency(summary.serviceCharge)}</span>
    </div>
    ` : ''}
    ${settings?.vat_percentage > 0 ? `
    <div class="summary-row">
      <span>VAT (${settings.vat_percentage}%):</span>
      <span>${formatCurrency(summary.vat)}</span>
    </div>
    ` : ''}
    <div class="summary-row total">
      <span>Total:</span>
      <span>${formatCurrency(summary.grandTotal)}</span>
    </div>
  </div>
  
  <div class="footer">
    <p>Thank you for dining with us!</p>
  </div>
  
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 100);
    }
  </script>
</body>
</html>
    `

    const printWindow = window.open('', '', 'width=500,height=700')
    printWindow.document.write(billContent)
    printWindow.document.close()
  }

  async function handleCompleteTableBill() {
    if (restaurantOrders.length === 0) {
      showNotification('No orders to complete', 'error')
      return
    }

    try {
      // Mark all orders as completed
      await supabase
        .from('restaurant_orders')
        .update({ status: 'completed' })
        .eq('table_id', selectedTable.id)
        .eq('status', 'pending')

      // Update table status
      await supabase
        .from('restaurant_tables')
        .update({ status: 'available' })
        .eq('id', selectedTable.id)

      showNotification('Bill completed successfully', 'success')
      loadTables()
      closeRestaurantPanel()
    } catch (error) {
      console.error('Error completing bill:', error)
      showNotification('Failed to complete bill', 'error')
    }
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
  const restaurantSummary = selectedTable ? calculateRestaurantSummary() : null
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
            <span>F & B Management</span>
          </h1>
          <p className="text-gray-400 mt-1">Manage Food and Beverage</p>
        </div>
        <button
          onClick={() => setShowManageRestaurantItems(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Utensils size={20} />
          <span>Manage Restaurant Items</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="card p-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Enter GRC Number"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Rooms Section */}
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
                    NO {room.room_number}
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

      {/* Restaurant Section */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-white mb-6">Restaurant</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
          {tables.map(table => {
            const orderCount = getTableOrderCount(table.id)

            return (
              <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`relative p-6 rounded-lg border-2 transition-all duration-200 ${
                  getTableStatusColor(table.status)
                } bg-dark-800 hover:bg-dark-700 cursor-pointer hover:scale-105`}
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-white mb-2">
                    {table.table_number}
                  </div>
                  <div className={`text-xs font-medium ${
                    table.status === 'occupied' ? 'text-red-400' :
                    table.status === 'available' ? 'text-green-400' :
                    'text-yellow-400'
                  }`}>
                    {table.status.toUpperCase()}
                  </div>
                  {orderCount > 0 && (
                    <div className="absolute -top-2 -right-2 bg-primary-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-lg">
                      {orderCount}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Room Consumption Panel */}
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
                    <div className="col-span-2">
                      <label className="label">Restaurant Item *</label>
                      <select
                        value={newItem.item_id}
                        onChange={(e) => {
                          const item = restaurantItems.find(i => i.id === e.target.value)
                          setNewItem({
                            ...newItem,
                            item_id: e.target.value,
                            item_name: item?.item_name || '',
                            category: item?.category || '',
                            unit_price: item?.unit_price || 0
                          })
                        }}
                        className="input-field"
                        required
                      >
                        <option value="">Select Item</option>
                        {Array.from(new Map(restaurantItems.filter(i => i.is_available).map(item => [item.item_name, item])).values()).map(item => (
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
                      <label className="label">Unit Price (LKR)</label>
                      <input
                        type="number"
                        value={newItem.unit_price}
                        className="input-field bg-dark-900 cursor-not-allowed"
                        readOnly
                        tabIndex={-1}
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

      {/* Restaurant Order Panel */}
      {showRestaurantPanel && selectedTable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end animate-in fade-in duration-300">
          <div className="bg-dark-900 h-full w-full max-w-4xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
            {/* Panel Header */}
            <div className="bg-dark-800 border-b border-dark-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                  <Utensils size={24} className="text-primary-400" />
                  <span>Table {selectedTable.table_number} - Restaurant Orders</span>
                </h2>
                <button
                  onClick={closeRestaurantPanel}
                  className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              {/* Table Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-dark-700 rounded-lg">
                <div>
                  <div className="text-xs text-gray-500">Table Number</div>
                  <div className="text-white font-medium text-lg">{selectedTable.table_number}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className={`font-medium ${
                    selectedTable.status === 'occupied' ? 'text-red-400' :
                    selectedTable.status === 'available' ? 'text-green-400' :
                    'text-yellow-400'
                  }`}>
                    {selectedTable.status.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Orders</h3>
                <button
                  onClick={() => setShowAddRestaurantItem(true)}
                  className="btn-primary flex items-center space-x-2 text-sm"
                >
                  <Plus size={18} />
                  <span>Add Order</span>
                </button>
              </div>

              {/* Add Order Form */}
              {showAddRestaurantItem && (
                <form onSubmit={handleAddRestaurantOrder} className="mb-6 p-6 bg-dark-800 rounded-lg border border-primary-600/20">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-semibold">Add New Order</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddRestaurantItem(false)
                        resetNewRestaurantOrder()
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="label">Item *</label>
                      <select
                        value={newRestaurantOrder.item_id}
                        onChange={(e) => handleRestaurantItemChange(e.target.value)}
                        className="input-field"
                        required
                      >
                        <option value="">Select Item</option>
                        {Array.from(new Map(restaurantItems.filter(i => i.is_available).map(item => [item.item_name, item])).values()).map(item => (
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
                        value={newRestaurantOrder.quantity}
                        onChange={(e) => setNewRestaurantOrder({ ...newRestaurantOrder, quantity: parseInt(e.target.value) || 1 })}
                        className="input-field"
                        min="1"
                        required
                      />
                    </div>

                    <div>
                      <label className="label">Unit Price (LKR)</label>
                      <input
                        type="number"
                        value={newRestaurantOrder.unit_price}
                        className="input-field bg-dark-900 cursor-not-allowed"
                        readOnly
                        tabIndex={-1}
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="label">Special Notes</label>
                      <textarea
                        value={newRestaurantOrder.notes}
                        onChange={(e) => setNewRestaurantOrder({ ...newRestaurantOrder, notes: e.target.value })}
                        className="input-field"
                        rows="2"
                        placeholder="e.g., Extra spicy, No onions..."
                      />
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-dark-700 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Total</span>
                      <span className="text-primary-400 font-bold text-lg">
                        {formatCurrency(newRestaurantOrder.quantity * newRestaurantOrder.unit_price)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddRestaurantItem(false)
                        resetNewRestaurantOrder()
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Add Order
                    </button>
                  </div>
                </form>
              )}

              {/* Orders Table */}
              {restaurantOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Utensils size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No orders yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-dark-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Item Name</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Qty</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Unit Price</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Total</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Notes</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restaurantOrders.map(order => (
                        <tr key={order.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                          <td className="py-4 px-4 text-white font-medium">{order.item_name}</td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleUpdateOrderQuantity(order.id, order.quantity - 1)}
                                className="w-6 h-6 flex items-center justify-center bg-dark-700 hover:bg-dark-600 rounded text-white text-sm"
                              >
                                -
                              </button>
                              <span className="text-white font-medium w-8 text-center">{order.quantity}</span>
                              <button
                                onClick={() => handleUpdateOrderQuantity(order.id, order.quantity + 1)}
                                className="w-6 h-6 flex items-center justify-center bg-dark-700 hover:bg-dark-600 rounded text-white text-sm"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-gray-300">{formatCurrency(order.unit_price)}</td>
                          <td className="py-4 px-4 text-primary-400 font-bold">{formatCurrency(order.total_price)}</td>
                          <td className="py-4 px-4 text-gray-400 text-sm">
                            {order.notes || '-'}
                          </td>
                          <td className="py-4 px-4">
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
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
            {restaurantOrders.length > 0 && restaurantSummary && (
              <div className="bg-dark-800 border-t border-dark-700 p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatCurrency(restaurantSummary.subtotal)}</span>
                  </div>
                  {settings?.service_charge_percentage > 0 && (
                    <div className="flex items-center justify-between text-gray-400">
                      <span>Service Charge ({settings.service_charge_percentage}%)</span>
                      <span className="font-medium">{formatCurrency(restaurantSummary.serviceCharge)}</span>
                    </div>
                  )}
                  {settings?.vat_percentage > 0 && (
                    <div className="flex items-center justify-between text-gray-400">
                      <span>VAT ({settings.vat_percentage}%)</span>
                      <span className="font-medium">{formatCurrency(restaurantSummary.vat)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-dark-700">
                    <span className="text-white font-bold text-xl">Grand Total</span>
                    <span className="text-primary-400 font-bold text-2xl">
                      {formatCurrency(restaurantSummary.grandTotal)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <button
                      onClick={handlePrintKitchenBill}
                      className="btn-secondary flex items-center justify-center space-x-2 py-3"
                    >
                      <ChefHat size={18} />
                      <span>Kitchen</span>
                    </button>
                    <button
                      onClick={handlePrintReceptionBill}
                      className="btn-secondary flex items-center justify-center space-x-2 py-3"
                    >
                      <Receipt size={18} />
                      <span>Reception</span>
                    </button>
                    <button
                      onClick={handleCompleteTableBill}
                      className="btn-primary flex items-center justify-center space-x-2 py-3"
                    >
                      <CheckCircle size={18} />
                      <span>Complete</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manage Restaurant Items Modal */}
      {showManageRestaurantItems && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-dark-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Manage Restaurant Items</h2>
                <button
                  onClick={() => {
                    setShowManageRestaurantItems(false)
                    resetNewRestaurantItem()
                  }}
                  className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Add/Edit Item Form */}
              <form onSubmit={handleSaveRestaurantItem} className="mb-6 p-6 bg-dark-800 rounded-lg">
                <h3 className="text-white font-semibold mb-4">
                  {editingRestaurantItem ? 'Edit Item' : 'Add New Item'}
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Item Name *</label>
                    <input
                      type="text"
                      value={newRestaurantItem.item_name}
                      onChange={(e) => setNewRestaurantItem({ ...newRestaurantItem, item_name: e.target.value })}
                      className="input-field"
                      placeholder="e.g., Chicken Fried Rice"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Category *</label>
                    <select
                      value={newRestaurantItem.category}
                      onChange={(e) => setNewRestaurantItem({ ...newRestaurantItem, category: e.target.value })}
                      className="input-field"
                      required
                    >
                      <option value="main_course">Main Course</option>
                      <option value="appetizer">Appetizer</option>
                      <option value="dessert">Dessert</option>
                      <option value="beverage">Beverage</option>
                      <option value="special">Special</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Unit Price (LKR) *</label>
                    <input
                      type="number"
                      value={newRestaurantItem.unit_price}
                      onChange={(e) => setNewRestaurantItem({ ...newRestaurantItem, unit_price: parseFloat(e.target.value) || 0 })}
                      className="input-field"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Availability</label>
                    <select
                      value={newRestaurantItem.is_available ? 'true' : 'false'}
                      onChange={(e) => setNewRestaurantItem({ ...newRestaurantItem, is_available: e.target.value === 'true' })}
                      className="input-field"
                    >
                      <option value="true">Available</option>
                      <option value="false">Not Available</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="label">Description</label>
                    <textarea
                      value={newRestaurantItem.description}
                      onChange={(e) => setNewRestaurantItem({ ...newRestaurantItem, description: e.target.value })}
                      className="input-field"
                      rows="2"
                      placeholder="Brief description of the item..."
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-4">
                  {editingRestaurantItem && (
                    <button
                      type="button"
                      onClick={resetNewRestaurantItem}
                      className="btn-secondary"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button type="submit" className="btn-primary flex items-center space-x-2">
                    <Save size={18} />
                    <span>{editingRestaurantItem ? 'Update Item' : 'Add Item'}</span>
                  </button>
                </div>
              </form>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Item Name</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Category</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Price</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Status</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restaurantItems.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-8 text-gray-500">
                          No items found
                        </td>
                      </tr>
                    ) : (
                      restaurantItems.map(item => (
                        <tr key={item.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                          <td className="py-4 px-4">
                            <div className="text-white font-medium">{item.item_name}</div>
                            {item.description && (
                              <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2 py-1 bg-primary-600/20 text-primary-400 rounded text-xs">
                              {item.category.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-primary-400 font-bold">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              item.is_available
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {item.is_available ? 'Available' : 'Not Available'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setEditingRestaurantItem(item)
                                  setNewRestaurantItem({
                                    item_name: item.item_name,
                                    category: item.category,
                                    unit_price: item.unit_price,
                                    description: item.description || '',
                                    is_available: item.is_available
                                  })
                                }}
                                className="p-2 hover:bg-dark-700 rounded-lg text-primary-400 transition-colors"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                onClick={() => handleDeleteRestaurantItem(item.id)}
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
        </div>
      )}
    </div>
  )
}