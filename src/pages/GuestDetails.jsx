import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCurrency, calculateBillTotal } from '../utils/calculations'
import { format } from 'date-fns'
import {
  ArrowLeft,
  User,
  Calendar,
  Phone,
  MapPin,
  CreditCard,
  ShoppingCart,
  Trash2,
  Plus,
  FileText,
  Printer,
  LogOut
} from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function GuestDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [guest, setGuest] = useState(null)
  const [purchases, setPurchases] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAddPurchase, setShowAddPurchase] = useState(false)
  const [showBilling, setShowBilling] = useState(false)
  const [newPurchase, setNewPurchase] = useState({
    item_name: '',
    category: 'restaurant',
    quantity: 1,
    unit_price: 0
  })

  useEffect(() => {
    loadGuestData()
    loadSettings()
  }, [id])

  async function loadGuestData() {
    try {
      const { data: guestData } = await supabase
        .from('guests')
        .select('*')
        .eq('id', id)
        .single()

      const { data: purchasesData } = await supabase
        .from('purchases')
        .select('*')
        .eq('guest_id', id)
        .order('purchase_date', { ascending: false })

      setGuest(guestData)
      setPurchases(purchasesData || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading guest:', error)
      setLoading(false)
    }
  }

  async function loadSettings() {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .single()
    setSettings(data)
  }

  async function handleAddPurchase(e) {
    e.preventDefault()
    try {
      const totalPrice = newPurchase.quantity * newPurchase.unit_price

      const { error } = await supabase
        .from('purchases')
        .insert([{
          guest_id: id,
          ...newPurchase,
          total_price: totalPrice
        }])

      if (error) throw error

      setNewPurchase({
        item_name: '',
        category: 'restaurant',
        quantity: 1,
        unit_price: 0
      })
      setShowAddPurchase(false)
      loadGuestData()
    } catch (error) {
      console.error('Error adding purchase:', error)
      alert('Failed to add purchase')
    }
  }

  async function handleDeletePurchase(purchaseId) {
    if (!confirm('Are you sure you want to delete this purchase?')) return

    try {
      const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchaseId)

      if (error) throw error
      loadGuestData()
    } catch (error) {
      console.error('Error deleting purchase:', error)
      alert('Failed to delete purchase')
    }
  }

  async function handleCheckout() {
    if (!confirm('Are you sure you want to check out this guest?')) return

    try {
      const { error } = await supabase
        .from('guests')
        .update({ status: 'checked_out' })
        .eq('id', id)

      if (error) throw error

      for (const roomNumber of guest.room_numbers) {
        await supabase
          .from('rooms')
          .update({ status: 'available' })
          .eq('room_number', roomNumber)
      }

      loadGuestData()
      alert('Guest checked out successfully')
    } catch (error) {
      console.error('Error checking out:', error)
      alert('Failed to check out guest')
    }
  }

  function generateInvoicePDF() {
    if (!guest || !settings) return

    const bill = calculateBillTotal(
      guest.total_room_charge,
      purchases,
      settings.tax_percentage,
      guest.advance_payment_amount
    )

    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(settings.hotel_name, 105, 20, { align: 'center' })

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(settings.hotel_address, 105, 28, { align: 'center' })
    doc.text(`Tel: ${settings.hotel_phone} | Email: ${settings.hotel_email}`, 105, 34, { align: 'center' })

    doc.setLineWidth(0.5)
    doc.line(20, 38, 190, 38)

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', 105, 48, { align: 'center' })

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`GRC Number: ${guest.grc_number}`, 20, 60)
    doc.text(`Date: ${format(new Date(), 'dd MMM yyyy')}`, 150, 60)

    doc.text('Guest Details:', 20, 70)
    doc.text(`Name: ${guest.name_with_initials}`, 20, 76)
    doc.text(`Passport/NIC: ${guest.passport_nic}`, 20, 82)
    doc.text(`Nationality: ${guest.nationality}`, 20, 88)
    doc.text(`Mobile: ${guest.mobile_number}`, 20, 94)

    doc.text('Stay Details:', 120, 70)
    doc.text(`Room(s): ${guest.room_numbers.join(', ')}`, 120, 76)
    doc.text(`Check-in: ${format(new Date(guest.date_of_arrival), 'dd MMM yyyy')}`, 120, 82)
    doc.text(`Check-out: ${format(new Date(guest.date_of_departure), 'dd MMM yyyy')}`, 120, 88)
    doc.text(`Room Type: ${guest.room_type}`, 120, 94)

    const tableData = []

    tableData.push(['Room Charges', '', '', formatCurrency(bill.roomCharges)])

    purchases.forEach(purchase => {
      tableData.push([
        purchase.item_name,
        purchase.quantity.toString(),
        formatCurrency(purchase.unit_price),
        formatCurrency(purchase.total_price)
      ])
    })

    doc.autoTable({
      startY: 105,
      head: [['Description', 'Qty', 'Unit Price', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [193, 148, 64] },
      styles: { fontSize: 10 },
    })

    const finalY = doc.lastAutoTable.finalY || 105

    doc.setFontSize(10)
    doc.text('Subtotal:', 130, finalY + 10)
    doc.text(formatCurrency(bill.subtotal), 180, finalY + 10, { align: 'right' })

    doc.text(`Tax (${settings.tax_percentage}%):`, 130, finalY + 16)
    doc.text(formatCurrency(bill.tax), 180, finalY + 16, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Grand Total:', 130, finalY + 24)
    doc.text(formatCurrency(bill.grandTotal), 180, finalY + 24, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    if (bill.advancePayment > 0) {
      doc.text('Advance Payment:', 130, finalY + 32)
      doc.text(formatCurrency(bill.advancePayment), 180, finalY + 32, { align: 'right' })
      doc.setFont('helvetica', 'bold')
      doc.text('Balance Due:', 130, finalY + 40)
      doc.text(formatCurrency(bill.balanceDue), 180, finalY + 40, { align: 'right' })
    }

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.text('Thank you for staying with us!', 105, finalY + 50, { align: 'center' })

    doc.text('_________________________', 40, 270)
    doc.text('Authorized Signature', 45, 276)

    doc.save(`Invoice-${guest.grc_number}.pdf`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!guest) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Guest not found</p>
      </div>
    )
  }

  const bill = settings ? calculateBillTotal(
    guest.total_room_charge,
    purchases,
    settings.tax_percentage
  ) : null

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">{guest.grc_number}</h1>
            <p className="text-gray-400 mt-1">{guest.name_with_initials}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {guest.status === 'checked_in' && (
            <button
              onClick={handleCheckout}
              className="btn-secondary flex items-center space-x-2"
            >
              <LogOut size={18} />
              <span>Check Out</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-xl font-bold text-white mb-6">Guest Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <User className="text-primary-400 mt-1" size={20} />
                  <div>
                    <p className="text-gray-400 text-sm">Full Name</p>
                    <p className="text-white font-medium">{guest.name_with_initials}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CreditCard className="text-primary-400 mt-1" size={20} />
                  <div>
                    <p className="text-gray-400 text-sm">Passport / NIC</p>
                    <p className="text-white font-medium">{guest.passport_nic}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin className="text-primary-400 mt-1" size={20} />
                  <div>
                    <p className="text-gray-400 text-sm">Nationality</p>
                    <p className="text-white font-medium">{guest.nationality}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Phone className="text-primary-400 mt-1" size={20} />
                  <div>
                    <p className="text-gray-400 text-sm">Mobile Number</p>
                    <p className="text-white font-medium">{guest.mobile_number}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm">Room Numbers</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {guest.room_numbers.map(room => (
                      <span key={room} className="px-3 py-1 bg-primary-600 rounded-lg text-white font-medium">
                        {room}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Room Type</p>
                  <p className="text-white font-medium">{guest.room_type}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Guests</p>
                  <p className="text-white font-medium">
                    {guest.number_of_adults} Adults, {guest.number_of_children} Children
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Meal Plan</p>
                  <p className="text-white font-medium">{guest.meal_plan || 'Not specified'}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-dark-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start space-x-3">
                  <Calendar className="text-primary-400 mt-1" size={20} />
                  <div>
                    <p className="text-gray-400 text-sm">Check-in</p>
                    <p className="text-white font-medium">
                      {format(new Date(guest.date_of_arrival), 'dd MMM yyyy')} at {guest.time_of_arrival}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Calendar className="text-primary-400 mt-1" size={20} />
                  <div>
                    <p className="text-gray-400 text-sm">Check-out</p>
                    <p className="text-white font-medium">
                      {format(new Date(guest.date_of_departure), 'dd MMM yyyy')} at {guest.time_of_departure}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {(guest.remarks || guest.advance_payment_amount > 0) && (
              <div className="mt-6 pt-6 border-t border-dark-800 space-y-4">
                {guest.remarks && (
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Special Requests & Remarks</p>
                    <p className="text-white bg-dark-800 p-3 rounded-lg">{guest.remarks}</p>
                  </div>
                )}
                {guest.advance_payment_amount > 0 && (
                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                    <p className="text-green-400 font-medium mb-3">Advance Payment Details</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Amount Paid</span>
                        <span className="text-white font-medium">{formatCurrency(guest.advance_payment_amount)}</span>
                      </div>
                      {guest.advance_payment_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Payment Date</span>
                          <span className="text-white font-medium">{format(new Date(guest.advance_payment_date), 'dd MMM yyyy')}</span>
                        </div>
                      )}
                      {guest.advance_payment_method && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Method</span>
                          <span className="text-white font-medium capitalize">{guest.advance_payment_method}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <ShoppingCart size={24} />
                <span>Additional Purchases</span>
              </h2>
              {guest.status === 'checked_in' && (
                <button
                  onClick={() => setShowAddPurchase(!showAddPurchase)}
                  className="btn-primary text-sm py-2 px-3 flex items-center space-x-2"
                >
                  <Plus size={16} />
                  <span>Add Purchase</span>
                </button>
              )}
            </div>

            {showAddPurchase && (
              <form onSubmit={handleAddPurchase} className="mb-6 p-4 bg-dark-800 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Item Name</label>
                    <input
                      type="text"
                      value={newPurchase.item_name}
                      onChange={(e) => setNewPurchase(prev => ({ ...prev, item_name: e.target.value }))}
                      className="input-field"
                      required
                      placeholder="e.g., Lunch, Laundry Service"
                    />
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <select
                      value={newPurchase.category}
                      onChange={(e) => setNewPurchase(prev => ({ ...prev, category: e.target.value }))}
                      className="input-field"
                    >
                      <option value="restaurant">Restaurant</option>
                      <option value="laundry">Laundry</option>
                      <option value="spa">Spa</option>
                      <option value="minibar">Minibar</option>
                      <option value="transport">Transport</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Quantity</label>
                    <input
                      type="number"
                      value={newPurchase.quantity}
                      onChange={(e) => setNewPurchase(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                      className="input-field"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Unit Price (LKR)</label>
                    <input
                      type="number"
                      value={newPurchase.unit_price}
                      onChange={(e) => setNewPurchase(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))}
                      className="input-field"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddPurchase(false)}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary text-sm">
                    Add Purchase
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {purchases.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No additional purchases</p>
              ) : (
                purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between p-4 bg-dark-800 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-white font-medium">{purchase.item_name}</h3>
                        <span className="px-2 py-1 bg-dark-700 rounded text-xs text-gray-400">
                          {purchase.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        {purchase.quantity} × {formatCurrency(purchase.unit_price)} = {formatCurrency(purchase.total_price)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(purchase.purchase_date), 'dd MMM yyyy, HH:mm')}
                      </p>
                    </div>
                    {guest.status === 'checked_in' && (
                      <button
                        onClick={() => handleDeletePurchase(purchase.id)}
                        className="p-2 hover:bg-dark-700 rounded-lg text-red-400 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Billing Summary</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                guest.status === 'checked_in'
                  ? 'bg-green-500/10 text-green-400'
                  : guest.status === 'checked_out'
                  ? 'bg-gray-500/10 text-gray-400'
                  : 'bg-red-500/10 text-red-400'
              }`}>
                {guest.status.replace('_', ' ')}
              </span>
            </div>

            {bill && (
              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b border-dark-800">
                  <span className="text-gray-400">Room Charges</span>
                  <span className="text-white font-medium">{formatCurrency(bill.roomCharges)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-dark-800">
                  <span className="text-gray-400">Additional Purchases</span>
                  <span className="text-white font-medium">{formatCurrency(bill.purchasesTotal)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-dark-800">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white font-medium">{formatCurrency(bill.subtotal)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-dark-800">
                  <span className="text-gray-400">Tax ({settings?.tax_percentage}%)</span>
                  <span className="text-white font-medium">{formatCurrency(bill.tax)}</span>
                </div>
                <div className="flex justify-between py-3 bg-primary-600/10 rounded-lg px-3">
                  <span className="text-white font-bold text-lg">Grand Total</span>
                  <span className="text-primary-400 font-bold text-lg">{formatCurrency(bill.grandTotal)}</span>
                </div>
                {bill.advancePayment > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-dark-800">
                      <span className="text-gray-400">Advance Payment</span>
                      <span className="text-green-400 font-medium">-{formatCurrency(bill.advancePayment)}</span>
                    </div>
                    <div className="flex justify-between py-3 bg-green-500/10 rounded-lg px-3">
                      <span className="text-white font-bold text-lg">Balance Due</span>
                      <span className="text-green-400 font-bold text-lg">{formatCurrency(bill.balanceDue)}</span>
                    </div>
                  </>
                )}

                <button
                  onClick={generateInvoicePDF}
                  className="w-full btn-primary flex items-center justify-center space-x-2 mt-6"
                >
                  <FileText size={20} />
                  <span>Generate Invoice PDF</span>
                </button>
              </div>
            )}
          </div>

          {guest.reservation_number && (
            <div className="card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Reservation Info</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-gray-400 text-sm">Reservation Number</p>
                  <p className="text-white font-medium">{guest.reservation_number}</p>
                </div>
                {guest.voucher_number && (
                  <div>
                    <p className="text-gray-400 text-sm">Voucher Number</p>
                    <p className="text-white font-medium">{guest.voucher_number}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
