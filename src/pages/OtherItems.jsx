import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatCurrency } from '../utils/calculations'
import { logActivity } from '../lib/activityLogger'
import {
  ShoppingBag,
  Plus,
  X,
  Edit2,
  Trash2,
  ShoppingCart,
  User,
  CheckCircle,
  AlertCircle,
  Search,
  Save,
  Tag
} from 'lucide-react'
import { format } from 'date-fns'

export default function OtherItems() {
  const { canManageOtherItems, userProfile } = useAuth()
  const [items, setItems] = useState([])
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGuest, setSelectedGuest] = useState(null)
  const [showManageItems, setShowManageItems] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [guestSearchTerm, setGuestSearchTerm] = useState('')
  const [notification, setNotification] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [recentSales, setRecentSales] = useState([])

  const [newItem, setNewItem] = useState({
    name: '',
    price: 0,
    description: '',
    is_available: true
  })

  const [newSale, setNewSale] = useState({
    item_id: '',
    quantity: 1,
    unit_price: 0,
    item_name: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedGuest) {
      loadRecentSales(selectedGuest.id)
    }
  }, [selectedGuest])

  async function loadData() {
    try {
      setLoading(true)
      
      const { data: itemsData, error: itemsError } = await supabase
        .from('other_items')
        .select('*')
        .order('name')
        
      if (itemsError) throw itemsError
      setItems(itemsData || [])

      const { data: guestsData, error: guestsError } = await supabase
        .from('guests')
        .select('*')
        .in('status', ['checked_in'])
        .order('name_with_initials')
        
      if (guestsError) throw guestsError
      setGuests(guestsData || [])

    } catch (error) {
      console.error('Error loading data:', error)
      showNotification('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadRecentSales(guestId) {
    try {
      const { data, error } = await supabase
        .from('other_item_sales')
        .select('*')
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setRecentSales(data || [])
    } catch (error) {
      console.error('Error loading sales:', error)
    }
  }

  function showNotification(message, type = 'success') {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  async function handleAddItem(e) {
    e.preventDefault()
    try {
      if (!newItem.name || newItem.price <= 0) {
        showNotification('Please enter a valid name and price', 'error')
        return
      }

      const { error } = await supabase
        .from('other_items')
        .insert([newItem])

      if (error) throw error

      await logActivity(
        userProfile,
        'create',
        'other_items',
        `Added new item: ${newItem.name}`
      )

      showNotification('Item added successfully')
      setShowAddItem(false)
      setNewItem({
        name: '',
        price: 0,
        description: '',
        is_available: true
      })
      loadData()
    } catch (error) {
      console.error('Error adding item:', error)
      showNotification('Failed to add item', 'error')
    }
  }

  async function handleUpdateItem(e) {
    e.preventDefault()
    try {
      if (!editingItem.name || editingItem.price <= 0) {
        showNotification('Please enter a valid name and price', 'error')
        return
      }

      const { error } = await supabase
        .from('other_items')
        .update({
          name: editingItem.name,
          price: editingItem.price,
          description: editingItem.description,
          is_available: editingItem.is_available
        })
        .eq('id', editingItem.id)

      if (error) throw error

      await logActivity(
        userProfile,
        'update',
        'other_items',
        `Updated item: ${editingItem.name}`
      )

      showNotification('Item updated successfully')
      setEditingItem(null)
      loadData()
    } catch (error) {
      console.error('Error updating item:', error)
      showNotification('Failed to update item', 'error')
    }
  }

  async function handleDeleteItem(id, name) {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return

    try {
      const { error } = await supabase
        .from('other_items')
        .delete()
        .eq('id', id)

      if (error) throw error

      await logActivity(
        userProfile,
        'delete',
        'other_items',
        `Deleted item: ${name}`
      )

      showNotification('Item deleted successfully')
      loadData()
    } catch (error) {
      console.error('Error deleting item:', error)
      showNotification('Failed to delete item. It might have existing sales records.', 'error')
    }
  }

  async function handleMakeSale(e) {
    e.preventDefault()
    try {
      if (!selectedGuest || !newSale.item_id || newSale.quantity < 1) {
        showNotification('Please select a guest and item with valid quantity', 'error')
        return
      }

      const totalPrice = newSale.quantity * newSale.unit_price

      const { error } = await supabase
        .from('other_item_sales')
        .insert([{
          guest_id: selectedGuest.id,
          item_id: newSale.item_id,
          item_name: newSale.item_name,
          unit_price: newSale.unit_price,
          quantity: newSale.quantity,
          total_price: totalPrice,
          sold_by: userProfile.full_name
        }])

      if (error) throw error

      await logActivity(
        userProfile,
        'create',
        'sale',
        `Sold ${newSale.quantity}x ${newSale.item_name} to ${selectedGuest.name_with_initials}`
      )

      showNotification('Sale recorded successfully')
      setNewSale({
        item_id: '',
        quantity: 1,
        unit_price: 0,
        item_name: ''
      })
      loadRecentSales(selectedGuest.id)
    } catch (error) {
      console.error('Error making sale:', error)
      showNotification('Failed to record sale', 'error')
    }
  }

  async function handleDeleteSale(saleId) {
    if (!window.confirm('Are you sure you want to delete this sale record?')) return

    try {
      const { error } = await supabase
        .from('other_item_sales')
        .delete()
        .eq('id', saleId)

      if (error) throw error

      showNotification('Sale record deleted successfully')
      loadRecentSales(selectedGuest.id)
    } catch (error) {
      console.error('Error deleting sale:', error)
      showNotification('Failed to delete sale record', 'error')
    }
  }

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const filteredGuests = guests.filter(guest => 
    guest.name_with_initials.toLowerCase().includes(guestSearchTerm.toLowerCase()) ||
    (guest.room_numbers && guest.room_numbers.join(', ').includes(guestSearchTerm))
  )

  const activeItems = items.filter(item => item.is_available)

  if (loading && !items.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center space-x-2 ${
          notification.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
        }`}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="text-primary-600" />
            Other Items & Services
          </h1>
          <p className="text-slate-500 dark:text-gray-400">Manage and sell additional items to guests</p>
        </div>
        {canManageOtherItems() && (
          <button
            onClick={() => setShowManageItems(!showManageItems)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              showManageItems
                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-gray-300'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {showManageItems ? 'Back to Sales' : 'Manage Items Catalog'}
          </button>
        )}
      </div>

      {showManageItems ? (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Items Catalog</h2>
            <button
              onClick={() => {
                setEditingItem(null)
                setShowAddItem(true)
              }}
              className="flex items-center space-x-2 px-3 py-1.5 bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 rounded-lg transition-colors"
            >
              <Plus size={16} />
              <span>Add Item</span>
            </button>
          </div>

          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-500 dark:text-gray-400">
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500 dark:text-gray-400 truncate max-w-[200px]">
                      {item.description || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-white">
                      LKR {item.price.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        item.is_available 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {item.is_available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingItem(item)
                          setShowAddItem(true)
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Item"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500 dark:text-gray-400">
                      No items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
                <User className="text-primary-600" size={20} />
                <span>Select Guest & Room</span>
              </h2>
              
              <div>
                <label className="label text-sm font-medium mb-2">Guest / Room Details</label>
                <select
                  value={selectedGuest?.id || ''}
                  onChange={(e) => {
                    const guest = guests.find(g => g.id === e.target.value) || null
                    setSelectedGuest(guest)
                    setNewSale({ item_id: '', quantity: 1, unit_price: 0, item_name: '' })
                  }}
                  className="input-field w-full"
                >
                  <option value="">-- Select Guest / Room --</option>
                  {guests.map(guest => (
                    <option key={guest.id} value={guest.id}>
                      {guest.name_with_initials} — Room(s): {guest.room_numbers?.join(', ') || 'N/A'} {guest.grc_number ? `(${guest.grc_number})` : ''}
                    </option>
                  ))}
                </select>
                {guests.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                    No active checked-in guests found.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedGuest ? (
              <div className="space-y-6">
                <div className="card p-6 border-t-4 border-primary-500">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {selectedGuest.name_with_initials}
                      </h2>
                      <p className="text-slate-500 dark:text-gray-400">
                        Room(s): {selectedGuest.room_numbers?.join(', ') || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleMakeSale} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-4">
                    <h3 className="font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                      <Tag size={18} className="text-primary-500" />
                      <span>Record New Sale</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="label text-xs">Select Item</label>
                        <select
                          value={newSale.item_id}
                          onChange={(e) => {
                            const item = activeItems.find(i => i.id === e.target.value)
                            setNewSale({
                              ...newSale,
                              item_id: item?.id || '',
                              item_name: item?.name || '',
                              unit_price: item?.price || 0
                            })
                          }}
                          className="input-field"
                          required
                        >
                          <option value="">-- Choose Item --</option>
                          {activeItems.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} - LKR {item.price.toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="label text-xs">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={newSale.quantity}
                          onChange={(e) => setNewSale({...newSale, quantity: parseInt(e.target.value) || 1})}
                          className="input-field"
                          required
                        />
                      </div>
                    </div>

                    {newSale.item_id && (
                      <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div>
                          <p className="text-sm text-slate-500 dark:text-gray-400">Total Price</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            LKR {(newSale.unit_price * newSale.quantity).toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="submit"
                          className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                        >
                          <ShoppingCart size={18} />
                          <span>Add to Bill</span>
                        </button>
                      </div>
                    )}
                  </form>
                </div>

                <div className="card p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent Sales for Guest</h3>
                  
                  {recentSales.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-gray-400">
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Item Name</th>
                            <th className="py-2 px-3 text-right">Qty</th>
                            <th className="py-2 px-3 text-right">Total</th>
                            <th className="py-2 px-3 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {recentSales.map(sale => (
                            <tr key={sale.id}>
                              <td className="py-2 px-3 text-slate-500 dark:text-gray-400">
                                {format(new Date(sale.created_at), 'MMM dd, HH:mm')}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                                {sale.item_name}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-500 dark:text-gray-400">
                                {sale.quantity}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-slate-900 dark:text-white">
                                {formatCurrency(sale.total_price)}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {canManageOtherItems() && (
                                  <button
                                    onClick={() => handleDeleteSale(sale.id)}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    title="Delete record"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                          <tr>
                            <td colSpan="3" className="py-3 px-3 text-right">Total:</td>
                            <td className="py-3 px-3 text-right">
                              {formatCurrency(recentSales.reduce((sum, sale) => sum + parseFloat(sale.total_price), 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-500 dark:text-gray-400">
                      No sales recorded for this guest yet.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card p-12 flex flex-col items-center justify-center text-center text-slate-500 dark:text-gray-400 h-full">
                <ShoppingBag size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
                <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-2">No Guest Selected</h3>
                <p>Select a guest from the list to record a sale or view their history.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button
                onClick={() => {
                  setShowAddItem(false)
                  setEditingItem(null)
                  setNewItem({ name: '', price: 0, description: '', is_available: true })
                }}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={editingItem ? handleUpdateItem : handleAddItem} className="p-6 space-y-4">
              <div>
                <label className="label">Item Name *</label>
                <input
                  type="text"
                  value={editingItem ? editingItem.name : newItem.name}
                  onChange={(e) => editingItem 
                    ? setEditingItem({...editingItem, name: e.target.value})
                    : setNewItem({...newItem, name: e.target.value})
                  }
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="label">Price (LKR) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingItem ? editingItem.price : newItem.price}
                  onChange={(e) => editingItem
                    ? setEditingItem({...editingItem, price: parseFloat(e.target.value) || 0})
                    : setNewItem({...newItem, price: parseFloat(e.target.value) || 0})
                  }
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="label">Description (Optional)</label>
                <textarea
                  value={editingItem ? (editingItem.description || '') : newItem.description}
                  onChange={(e) => editingItem
                    ? setEditingItem({...editingItem, description: e.target.value})
                    : setNewItem({...newItem, description: e.target.value})
                  }
                  className="input-field h-24 resize-none"
                  placeholder="Additional details..."
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="is_available"
                  checked={editingItem ? editingItem.is_available : newItem.is_available}
                  onChange={(e) => editingItem
                    ? setEditingItem({...editingItem, is_available: e.target.checked})
                    : setNewItem({...newItem, is_available: e.target.checked})
                  }
                  className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                />
                <label htmlFor="is_available" className="text-sm font-medium text-slate-700 dark:text-gray-300 cursor-pointer">
                  Item is currently available
                </label>
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddItem(false)
                    setEditingItem(null)
                    setNewItem({ name: '', price: 0, description: '', is_available: true })
                  }}
                  className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <Save size={18} />
                  <span>{editingItem ? 'Update Item' : 'Save Item'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
