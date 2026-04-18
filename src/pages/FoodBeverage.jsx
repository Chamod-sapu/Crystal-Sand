import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatCurrency } from '../utils/calculations'
import { logActivity } from '../lib/activityLogger'
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
  const { canManageFBItems, userProfile } = useAuth()
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
  const [roomItemSearch, setRoomItemSearch] = useState('')
  const [restaurantItemSearch, setRestaurantItemSearch] = useState('')
  const [showRoomItemDropdown, setShowRoomItemDropdown] = useState(false)
  const [showRestaurantItemDropdown, setShowRestaurantItemDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState('room-service')

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
    setRoomItemSearch('')
    setShowRoomItemDropdown(false)
  }

  function resetNewRestaurantOrder() {
    setNewRestaurantOrder({
      item_id: '',
      quantity: 1,
      unit_price: 0,
      item_name: '',
      notes: ''
    })
    setRestaurantItemSearch('')
    setShowRestaurantItemDropdown(false)
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

      // Log activity
      const guest = getRoomGuest(selectedRoom.room_number)
      logActivity(
        userProfile,
        'create',
        'fb_item',
        `Added ${newItem.quantity}x ${newItem.item_name} to Room ${selectedRoom.room_number}`,
        selectedRoom.id,
        { guest_id: guest?.id, room_id: selectedRoom.id }
      )
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

      // Log activity
      logActivity(
        userProfile,
        'create',
        'fb_item',
        `Added ${newRestaurantOrder.quantity}x ${newRestaurantOrder.item_name} to Table ${selectedTable.table_number}`,
        selectedTable.id
      )
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

    const trimmedName = newRestaurantItem.item_name.trim()

    // Check for duplicates before adding new item
    if (!editingRestaurantItem) {
      const isDuplicate = restaurantItems.some(
        item => item.item_name.trim().toLowerCase() === trimmedName.toLowerCase()
      )
      if (isDuplicate) {
        showNotification('An item with this name already exists', 'error')
        return
      }
    }

    try {
      const itemToSave = { ...newRestaurantItem, item_name: trimmedName }
      if (editingRestaurantItem) {
        const { error } = await supabase
          .from('restaurant_items')
          .update(itemToSave)
          .eq('id', editingRestaurantItem.id)

        if (error) throw error
        showNotification('Item updated successfully', 'success')
        logActivity(
          userProfile,
          'update',
          'fb_item',
          `Updated menu item: ${newRestaurantItem.item_name}`,
          editingRestaurantItem.id
        )
      } else {
        const { error } = await supabase
          .from('restaurant_items')
          .insert([newRestaurantItem])

        if (error) throw error
        showNotification('Item added successfully', 'success')
        logActivity(
          userProfile,
          'create',
          'fb_item',
          `Added new menu item: ${newRestaurantItem.item_name}`
        )
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
      logActivity(
        userProfile,
        'delete',
        'fb_item',
        `Deleted menu item with ID: ${itemId}`,
        itemId
      )
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
      logActivity(
        userProfile,
        'delete',
        'fb_item',
        `Removed item from Room ${selectedRoom.room_number} bill`,
        selectedRoom.id,
        { room_id: selectedRoom.id }
      )
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
      logActivity(
        userProfile,
        'delete',
        'fb_item',
        `Removed order from Table ${selectedTable.table_number}`,
        selectedTable.id
      )
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
      
      // Log activity
      logActivity(
        userProfile,
        'update',
        'bill',
        `Completed bill for Table ${selectedTable.table_number}`,
        selectedTable.id
      )

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
      
      logActivity(
        userProfile,
        'update',
        'bill',
        `Transferred F&B bill to Room ${selectedRoom.room_number} folio`,
        selectedRoom.id,
        { guest_id: guest.id, room_id: selectedRoom.id }
      )

      loadConsumptions(selectedRoom.id)
      closePanel()
    } catch (error) {
      console.error('Error adding to room bill:', error)
      showNotification('Failed to add to room bill', 'error')
    }
  }

  const filteredRooms = searchTerm && activeTab === 'room-service'
    ? rooms.filter(room => {
        const roomMatch = room.room_number.toLowerCase().includes(searchTerm.toLowerCase())
        const guest = getRoomGuest(room.room_number)
        const guestMatch = guest?.name_with_initials.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          guest?.grc_number.toLowerCase().includes(searchTerm.toLowerCase())
        return roomMatch || guestMatch
      })
    : rooms

  const filteredTables = searchTerm && activeTab === 'restaurant'
    ? tables.filter(table => table.table_number.toLowerCase().includes(searchTerm.toLowerCase()))
    : tables



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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center space-x-3">
            <Coffee size={32} className="text-primary-400" />
            <span>Food & Beverage</span>
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1">Manage room service orders and restaurant operations</p>
        </div>
        {canManageFBItems() && (
          <button
            onClick={() => setShowManageRestaurantItems(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Utensils size={20} />
            <span>Menu Management</span>
          </button>
        )}
      </div>

      {/* Search and Tabs */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1 w-full md:max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder={activeTab === 'room-service' ? "Search rooms, guests, or GRC..." : "Search tables..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field w-full pl-10"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shadow-inner">
              <button
                onClick={() => setActiveTab('room-service')}
                className={`flex items-center space-x-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === 'room-service'
                    ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Coffee size={16} />
                <span>Room Service</span>
              </button>
              <button
                onClick={() => setActiveTab('restaurant')}
                className={`flex items-center space-x-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === 'restaurant'
                    ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Utensils size={16} />
                <span>Restaurant</span>
              </button>
            </div>
            <div className="flex items-center space-x-4 border-l border-slate-200 dark:border-slate-800 pl-4 hidden sm:flex">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full shadow-sm shadow-red-500/50"></div>
                <span className="text-xs text-slate-500 dark:text-gray-400">Occupied</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm shadow-green-500/50"></div>
                <span className="text-xs text-slate-500 dark:text-gray-400">Available</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      {activeTab === 'room-service' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredRooms.map(room => {
            const status = getRoomStatus(room)
            const guest = getRoomGuest(room.room_number)
            const itemCount = getConsumptionCount(room.id)
            const isOccupied = status === 'occupied'

            return (
              <button
                key={room.id}
                onClick={() => handleRoomClick(room)}
                disabled={!isOccupied}
                className={`card p-5 border-2 transition-all hover:shadow-lg relative text-left ${
                  isOccupied
                    ? 'border-red-500/50 dark:border-red-400/40 cursor-pointer'
                    : 'border-green-500/50 dark:border-green-400/40 cursor-not-allowed opacity-60'
                }`}
              >
                {itemCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold z-10">
                    {itemCount}
                  </div>
                )}
                
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className={`p-3 rounded-lg ${isOccupied ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                    <Coffee size={24} />
                  </div>
                  
                  <div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {room.room_number}
                    </div>
                    <div className={`text-xs font-medium uppercase mt-1 ${isOccupied ? 'text-red-500' : 'text-green-500'}`}>
                      {status}
                    </div>
                  </div>

                  {guest ? (
                    <div className="w-full pt-2 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {guest.name_with_initials}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {guest.grc_number}
                      </p>
                    </div>
                  ) : (
                    <div className="h-8"></div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredTables.map(table => {
            const orderCount = getTableOrderCount(table.id)
            const isOccupied = table.status === 'occupied'

            return (
              <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`card p-5 border-2 transition-all hover:shadow-lg relative text-left ${
                  isOccupied
                    ? 'border-red-500/50 dark:border-red-400/40'
                    : 'border-green-500/50 dark:border-green-400/40'
                }`}
              >
                {orderCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold z-10">
                    {orderCount}
                  </div>
                )}
                
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className={`p-3 rounded-lg ${isOccupied ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                    <Utensils size={24} />
                  </div>
                  
                  <div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {table.table_number}
                    </div>
                    <div className={`text-xs font-medium uppercase mt-1 ${isOccupied ? 'text-red-500' : 'text-green-500'}`}>
                      {table.status}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Modern Overlay Panels */}
      {(showPanel || showRestaurantPanel) && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if(e.target === e.currentTarget) activeTab === 'room-service' ? closePanel() : closeRestaurantPanel() }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Panel Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-primary-600/20 rounded-lg">
                    {activeTab === 'room-service' ? <Coffee size={22} className="text-primary-400" /> : <Utensils size={22} className="text-primary-400" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {activeTab === 'room-service' ? `Room ${selectedRoom?.room_number}` : `Table ${selectedTable?.table_number}`}
                    </h2>
                    <p className="text-slate-500 dark:text-gray-400 text-sm">Order Management</p>
                  </div>
                </div>
                <button
                  onClick={activeTab === 'room-service' ? closePanel : closeRestaurantPanel}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Guest Info */}
              {activeTab === 'room-service' && currentGuest && (
                <div className="flex flex-wrap gap-4 mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex-1 min-w-[120px]">
                    <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Guest</p>
                    <p className="font-medium text-slate-900 dark:text-white truncate">{currentGuest.name_with_initials}</p>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">GRC</p>
                    <p className="font-medium text-slate-900 dark:text-white font-mono">{currentGuest.grc_number}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Current Orders</h3>
                <button
                  onClick={() => activeTab === 'room-service' ? setShowAddItem(true) : setShowAddRestaurantItem(true)}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Plus size={18} />
                  <span>Add Item</span>
                </button>
              </div>

              {/* Add Item Form */}
              {(showAddItem || showAddRestaurantItem) && (
                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-slate-900 dark:text-white">Select Item</h4>
                    <button onClick={() => activeTab === 'room-service' ? setShowAddItem(false) : setShowAddRestaurantItem(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <label className="label">Item Name</label>
                      <input
                        type="text"
                        value={activeTab === 'room-service' ? roomItemSearch : restaurantItemSearch}
                        onChange={(e) => {
                          if(activeTab === 'room-service') { setRoomItemSearch(e.target.value); setShowRoomItemDropdown(true) }
                          else { setRestaurantItemSearch(e.target.value); setShowRestaurantItemDropdown(true) }
                        }}
                        onFocus={() => {
                          if(activeTab === 'room-service') setShowRoomItemDropdown(true)
                          else setShowRestaurantItemDropdown(true)
                        }}
                        className="input-field"
                        placeholder="Search menu..."
                      />
                      
                      {/* Dropdown Results */}
                      {((activeTab === 'room-service' && showRoomItemDropdown) || (activeTab === 'restaurant' && showRestaurantItemDropdown)) && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto">
                          {(activeTab === 'room-service' 
                            ? [...menuItems, ...restaurantItems] // Combine for room service
                            : restaurantItems
                          )
                             .filter(i => {
                              const search = activeTab === 'room-service' ? roomItemSearch : restaurantItemSearch
                              const itemName = (i.item_name || '').trim()
                              
                              const isAvail = activeTab === 'room-service' 
                                ? (i.is_active !== false && i.is_available !== false) 
                                : i.is_available !== false
                              
                              if (!search) return isAvail
                              return isAvail && itemName.toLowerCase().includes(search.toLowerCase().trim())
                            })
                            // Deduplicate by name if searching multiple sources
                            .filter((item, index, self) => 
                              index === self.findIndex((t) => (t.item_name || '').trim().toLowerCase() === (item.item_name || '').trim().toLowerCase())
                            )
                            .map(item => (
                              <button
                                key={item.id}
                                onClick={() => {
                                  if(activeTab === 'room-service') {
                                    setNewItem({...newItem, item_id: item.id, item_name: item.item_name, category: item.category?.name || item.category || 'Food', unit_price: item.unit_price})
                                    setRoomItemSearch(item.item_name); setShowRoomItemDropdown(false)
                                  } else {
                                    setNewRestaurantOrder({...newRestaurantOrder, item_id: item.id, item_name: item.item_name, unit_price: item.unit_price})
                                    setRestaurantItemSearch(item.item_name); setShowRestaurantItemDropdown(false)
                                  }
                                }}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                              >
                                <div>
                                  <p className="font-medium text-slate-900 dark:text-white">{item.item_name}</p>
                                  <p className="text-xs text-slate-400 capitalize">
                                    {(item.category?.name || item.category || 'General').replace('_', ' ')}
                                  </p>
                                </div>
                                <p className="font-bold text-primary-600">{formatCurrency(item.unit_price)}</p>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Quantity</label>
                        <input
                          type="number"
                          value={activeTab === 'room-service' ? newItem.quantity : newRestaurantOrder.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1
                            if(activeTab === 'room-service') setNewItem({...newItem, quantity: val})
                            else setNewRestaurantOrder({...newRestaurantOrder, quantity: val})
                          }}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="label">Total</label>
                        <div className="input-field bg-slate-50 dark:bg-slate-800 font-bold text-slate-600 dark:text-gray-300">
                          {formatCurrency((activeTab === 'room-service' ? newItem.quantity * newItem.unit_price : newRestaurantOrder.quantity * newRestaurantOrder.unit_price))}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={activeTab === 'room-service' ? handleAddItem : handleAddRestaurantOrder}
                      className="btn-primary w-full"
                    >
                      Add to Order
                    </button>
                  </div>
                </div>
              )}

              {/* Order Items List */}
              <div className="space-y-2">
                {(activeTab === 'room-service' ? consumptions : restaurantOrders).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium text-slate-900 dark:text-white truncate">{item.item_name}</h5>
                        <p className="font-bold text-primary-600 whitespace-nowrap ml-2">{formatCurrency(item.total_price)}</p>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                        {formatCurrency(item.unit_price)} × {item.quantity} · {item.category || 'Food'}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => activeTab === 'room-service' ? handleUpdateQuantity(item.id, item.quantity - 1) : handleUpdateOrderQuantity(item.id, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 font-bold"
                      >-</button>
                      <span className="w-6 text-center text-sm font-medium text-slate-900 dark:text-white">{item.quantity}</span>
                      <button 
                        onClick={() => activeTab === 'room-service' ? handleUpdateQuantity(item.id, item.quantity + 1) : handleUpdateOrderQuantity(item.id, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 font-bold"
                      >+</button>
                      <button 
                        onClick={() => activeTab === 'room-service' ? handleDeleteItem(item.id) : handleDeleteOrder(item.id)}
                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg ml-1"
                      ><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
                
                {(activeTab === 'room-service' ? consumptions : restaurantOrders).length === 0 && (
                  <div className="py-12 text-center">
                    <ShoppingCart size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-500 dark:text-gray-400 text-sm">No items in order</p>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Footer */}
            {(activeTab === 'room-service' ? consumptions : restaurantOrders).length > 0 && (
              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm text-slate-500 dark:text-gray-400">
                    <span>Subtotal</span>
                    <span>{formatCurrency((activeTab === 'room-service' ? summary.subtotal : restaurantSummary.subtotal))}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500 dark:text-gray-400">
                    <span>Tax & Charges</span>
                    <span>{formatCurrency(((activeTab === 'room-service' ? summary.vat + summary.serviceCharge : restaurantSummary.vat + restaurantSummary.serviceCharge)))}</span>
                  </div>
                  <div className="flex justify-between items-end pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-lg text-slate-900 dark:text-white">Grand Total</span>
                    <span className="font-bold text-2xl text-primary-600">
                      {formatCurrency((activeTab === 'room-service' ? summary.grandTotal : restaurantSummary.grandTotal))}
                    </span>
                  </div>
                </div>

                {activeTab === 'room-service' ? (
                  <button 
                    onClick={handleAddToRoomBill}
                    className="btn-primary w-full py-3"
                  >
                    Transfer to Guest Folio
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={handlePrintKitchenBill} className="btn-secondary flex flex-col items-center gap-1.5 py-3 text-xs">
                      <ChefHat size={18} className="text-primary-400" /> Kitchen
                    </button>
                    <button onClick={handlePrintReceptionBill} className="btn-secondary flex flex-col items-center gap-1.5 py-3 text-xs">
                      <Receipt size={18} className="text-primary-400" /> Bill
                    </button>
                    <button onClick={handleCompleteTableBill} className="btn-primary flex flex-col items-center gap-1.5 py-3 text-xs">
                      <CheckCircle size={18} /> Settle
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Menu Management Modal */}
      {showManageRestaurantItems && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Utensils size={22} className="text-primary-400" />
                  <span>Menu Management</span>
                </h2>
                <button 
                  onClick={() => { setShowManageRestaurantItems(false); resetNewRestaurantItem() }}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                ><X size={20} className="text-slate-500 dark:text-gray-400" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Add/Edit Form */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  {editingRestaurantItem ? 'Edit Menu Item' : 'Add New Item'}
                </h3>
                
                <form onSubmit={handleSaveRestaurantItem} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <label className="label">Category</label>
                    <select
                      value={newRestaurantItem.category}
                      onChange={(e) => setNewRestaurantItem({ ...newRestaurantItem, category: e.target.value })}
                      className="input-field"
                    >
                      <option value="main_course">Main Course</option>
                      <option value="appetizer">Appetizer</option>
                      <option value="dessert">Dessert</option>
                      <option value="beverage">Beverage</option>
                      <option value="special">Special</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Price (LKR) *</label>
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

                  <div className="md:col-span-2">
                    <label className="label">Description</label>
                    <input
                      type="text"
                      value={newRestaurantItem.description}
                      onChange={(e) => setNewRestaurantItem({ ...newRestaurantItem, description: e.target.value })}
                      className="input-field"
                      placeholder="Brief description..."
                    />
                  </div>

                  <div className="flex items-end space-x-3">
                    <button type="submit" className="btn-primary flex items-center space-x-2">
                      <Save size={18} />
                      <span>{editingRestaurantItem ? 'Save Changes' : 'Add Item'}</span>
                    </button>
                    {editingRestaurantItem && (
                      <button type="button" onClick={resetNewRestaurantItem} className="btn-secondary">
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Items List */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Current Menu Items</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Deduplicate displayed items by trimmed name to avoid visual duplicates from DB */}
                  {Array.from(new Map(restaurantItems.map(item => [(item.item_name || '').trim().toLowerCase(), item])).values())
                    .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || ''))
                    .map(item => (
                      <div key={item.id} className="card p-4">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0">
                            <h4 className="font-medium text-slate-900 dark:text-white truncate">{item.item_name}</h4>
                            <p className="text-xs text-slate-500 dark:text-gray-400 capitalize">{item.category.replace('_', ' ')}</p>
                            {item.description && <p className="text-xs text-slate-400 italic truncate mt-1">{item.description}</p>}
                          </div>
                          <p className="font-bold text-primary-600 text-lg ml-2">{formatCurrency(item.unit_price)}</p>
                        </div>
                        
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            item.is_available 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {item.is_available ? 'Available' : 'Out of Stock'}
                          </span>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setEditingRestaurantItem(item)
                                setNewRestaurantItem({ item_name: item.item_name, category: item.category, unit_price: item.unit_price, description: item.description || '', is_available: item.is_available })
                              }}
                              className="p-2 hover:bg-primary-600/20 rounded-lg text-primary-400 transition-colors"
                            ><Edit2 size={16} /></button>
                            <button 
                              onClick={() => handleDeleteRestaurantItem(item.id)}
                              className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                            ><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

