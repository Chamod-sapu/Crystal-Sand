import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCurrency, calculateBillTotal } from '../utils/calculations'
import { format, differenceInDays, addDays, parseISO } from 'date-fns'
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
  LogOut,
  CalendarPlus,
  AlertCircle,
  X,
  Percent,
  Tag
} from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import logo from '../Images/Untitled design (2).png'

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

  // Extend Stay states
  const [showExtendStay, setShowExtendStay] = useState(false)
  const [extendDate, setExtendDate] = useState('')
  const [extendLoading, setExtendLoading] = useState(false)
  const [extendError, setExtendError] = useState('')
  const [extendPreview, setExtendPreview] = useState(null)

  // Document preview states
  const [showDocumentPreview, setShowDocumentPreview] = useState(false)
  const [documentUrl, setDocumentUrl] = useState(null)
  const [documentError, setDocumentError] = useState(null)

  useEffect(() => {
    loadGuestData()
    loadSettings()
  }, [id])

  useEffect(() => {
    if (extendDate && guest) {
      calculateExtendPreview()
    } else {
      setExtendPreview(null)
    }
  }, [extendDate, guest])

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

      if (guestData.passport_nic_document_url) {
        const { data, error } = await supabase.storage
          .from('guest-documents')
          .createSignedUrl(guestData.passport_nic_document_url, 3600)

        if (error) {
          console.error('Error creating signed URL:', error)
          setDocumentError('Failed to load document preview')
          setDocumentUrl(null)
        } else {
          setDocumentUrl(data.signedUrl)
          setDocumentError(null)
        }
      } else {
        setDocumentUrl(null)
        setDocumentError(null)
      }

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

  async function checkRoomAvailability(newDepartureDate) {
    try {
      const { data: allGuests } = await supabase
        .from('guests')
        .select('*')
        .neq('id', id)
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
    if (!extendDate || !guest || !settings) return

    const newDepartureDate = new Date(extendDate)
    const currentDeparture = new Date(guest.date_of_departure)

    if (newDepartureDate <= currentDeparture) {
      setExtendError('New checkout date must be after current checkout date')
      setExtendPreview(null)
      return
    }

    const availabilityCheck = await checkRoomAvailability(extendDate)
    
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

    const arrival = new Date(guest.date_of_arrival)
    const newNights = differenceInDays(newDepartureDate, arrival)
    const additionalNights = differenceInDays(newDepartureDate, currentDeparture)
    
    const numberOfRooms = guest.room_numbers.length
    const pricePerNight = parseFloat(guest.total_room_charge) / (guest.number_of_nights * numberOfRooms) || 0
    const additionalCharge = pricePerNight * additionalNights * numberOfRooms
    const newTotalRoomCharge = parseFloat(guest.total_room_charge) + additionalCharge

    setExtendPreview({
      currentDeparture: format(currentDeparture, 'MMM dd, yyyy'),
      newDeparture: format(newDepartureDate, 'MMM dd, yyyy'),
      currentNights: guest.number_of_nights,
      newNights,
      additionalNights,
      pricePerNight,
      additionalCharge,
      currentRoomCharge: parseFloat(guest.total_room_charge),
      newTotalRoomCharge
    })
  }

  async function handleExtendStay(e) {
    e.preventDefault()
    
    if (!extendDate || !extendPreview) {
      setExtendError('Please select a valid extension date')
      return
    }

    setExtendLoading(true)

    try {
      const availabilityCheck = await checkRoomAvailability(extendDate)
      
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
          total_room_charge: extendPreview.newTotalRoomCharge
        })
        .eq('id', id)

      if (error) throw error

      await loadGuestData()
      
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

  // Calculate discount information
  function calculateDiscountInfo(guest) {
    if (!guest.discount_type || !guest.discount_amount) {
      return null
    }

    const discountedRoomCharge = parseFloat(guest.total_room_charge) || 0
    let originalRoomCharge = discountedRoomCharge
    let discountAmount = 0

    if (guest.discount_type === 'percentage') {
      // Reverse calculate: original = discounted / (1 - percentage/100)
      originalRoomCharge = discountedRoomCharge / (1 - guest.discount_amount / 100)
      discountAmount = originalRoomCharge - discountedRoomCharge
    } else if (guest.discount_type === 'fixed') {
      // Reverse calculate: original = discounted + fixed amount
      originalRoomCharge = discountedRoomCharge + guest.discount_amount
      discountAmount = guest.discount_amount
    }

    return {
      originalRoomCharge,
      discountAmount,
      discountedRoomCharge,
      discountType: guest.discount_type,
      discountValue: guest.discount_amount
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

    const discountInfo = calculateDiscountInfo(guest)

    const doc = new jsPDF()

    // Cyan color RGB: 8, 145, 178 (from Tailwind cyan-600)
    const cyanColor = [8, 145, 178]

    // Add logo instead of hotel name text
    const logoWidth = 60
    const logoHeight = 20
    const logoX = (210 - logoWidth) / 2 // Center horizontally (A4 width is 210mm)
    doc.addImage(logo, 'PNG', logoX, 10, logoWidth, logoHeight)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(settings.hotel_address, 105, 34, { align: 'center' })
    doc.text(`Tel: ${settings.hotel_phone} | Email: ${settings.hotel_email}`, 105, 40, { align: 'center' })

    // Apply cyan color to the line
    doc.setDrawColor(...cyanColor)
    doc.setLineWidth(0.5)
    doc.line(20, 44, 190, 44)

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', 105, 54, { align: 'center' })

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`GRC Number: ${guest.grc_number}`, 20, 66)
    doc.text(`Date: ${format(new Date(), 'dd MMM yyyy')}`, 150, 66)

    doc.text('Guest Details:', 20, 76)
    doc.text(`Name: ${guest.name_with_initials}`, 20, 82)
    doc.text(`Passport/NIC: ${guest.passport_nic}`, 20, 88)
    doc.text(`Nationality: ${guest.nationality}`, 20, 94)
    doc.text(`Mobile: ${guest.mobile_number}`, 20, 100)

    doc.text('Stay Details:', 120, 76)
    doc.text(`Room(s): ${guest.room_numbers.join(', ')}`, 120, 82)
    doc.text(`Check-in: ${format(new Date(guest.date_of_arrival), 'dd MMM yyyy')}`, 120, 88)
    doc.text(`Check-out: ${format(new Date(guest.date_of_departure), 'dd MMM yyyy')}`, 120, 94)
    doc.text(`Room Type: ${guest.room_type}`, 120, 100)

    const tableData = []

    // Add room charges with discount info if applicable
    if (discountInfo) {
      tableData.push(['Room Charges (Original)', '', '', formatCurrency(discountInfo.originalRoomCharge)])
      tableData.push([
        `Discount (${discountInfo.discountType === 'percentage' 
          ? `${discountInfo.discountValue}%` 
          : 'Fixed'})`,
        '',
        '',
        `-${formatCurrency(discountInfo.discountAmount)}`
      ])
      tableData.push(['Room Charges (Discounted)', '', '', formatCurrency(discountInfo.discountedRoomCharge)])
    } else {
      tableData.push(['Room Charges', '', '', formatCurrency(bill.roomCharges)])
    }

    purchases.forEach(purchase => {
      tableData.push([
        purchase.item_name,
        purchase.quantity.toString(),
        formatCurrency(purchase.unit_price),
        formatCurrency(purchase.total_price)
      ])
    })

    doc.autoTable({
      startY: 111,
      head: [['Description', 'Qty', 'Unit Price', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: cyanColor },
      styles: { fontSize: 10 },
    })

    const finalY = doc.lastAutoTable.finalY || 111

    doc.setFontSize(10)
    doc.text('Subtotal:', 130, finalY + 10)
    doc.text(formatCurrency(bill.subtotal), 180, finalY + 10, { align: 'right' })

    doc.text(`Tax (${settings.tax_percentage}%):`, 130, finalY + 16)
    doc.text(formatCurrency(bill.tax), 180, finalY + 16, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Total:', 130, finalY + 24)
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-x-cyan-600"></div>
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

  const discountInfo = calculateDiscountInfo(guest)

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
            <>
              <button
                onClick={() => setShowExtendStay(true)}
                className="btn-secondary flex items-center space-x-2"
              >
                <CalendarPlus size={18} />
                <span>Extend Stay</span>
              </button>
              <button
                onClick={handleCheckout}
                className="btn-secondary flex items-center space-x-2"
              >
                <LogOut size={18} />
                <span>Check Out</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Extend Stay Modal */}
      {showExtendStay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-dark-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CalendarPlus className="text-primary-400" size={24} />
                  <h2 className="text-xl font-bold text-white">Extend Stay</h2>
                </div>
                <button
                  onClick={() => {
                    setShowExtendStay(false)
                    setExtendDate('')
                    setExtendPreview(null)
                    setExtendError('')
                  }}
                  className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
            </div>

            <form onSubmit={handleExtendStay} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="bg-dark-800 p-4 rounded-lg space-y-3">
                <h3 className="text-white font-semibold mb-3">Current Booking</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Check-in</p>
                    <p className="text-white font-medium">
                      {format(new Date(guest.date_of_arrival), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Current Check-out</p>
                    <p className="text-white font-medium">
                      {format(new Date(guest.date_of_departure), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Current Nights</p>
                    <p className="text-white font-medium">{guest.number_of_nights}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Room(s)</p>
                    <p className="text-white font-medium">{guest.room_numbers.join(', ')}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">New Check-out Date *</label>
                <input
                  type="date"
                  value={extendDate}
                  onChange={(e) => setExtendDate(e.target.value)}
                  min={format(addDays(new Date(guest.date_of_departure), 1), 'yyyy-MM-dd')}
                  className="input-field"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Select a date after {format(new Date(guest.date_of_departure), 'MMM dd, yyyy')}
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
                    <CalendarPlus size={18} />
                    <span>Extension Preview</span>
                  </h3>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">New Check-out Date</span>
                      <span className="text-white font-medium">{extendPreview.newDeparture}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Additional Nights</span>
                      <span className="text-white font-medium">+{extendPreview.additionalNights}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Nights</span>
                      <span className="text-white font-medium">
                        {extendPreview.currentNights} → {extendPreview.newNights}
                      </span>
                    </div>
                    
                    <div className="border-t border-green-500/20 pt-3 mt-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Price per Night</span>
                        <span className="text-white font-medium">
                          {formatCurrency(extendPreview.pricePerNight)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Additional Charges</span>
                        <span className="text-green-400 font-medium">
                          +{formatCurrency(extendPreview.additionalCharge)}
                        </span>
                      </div>
                      <div className="flex justify-between text-base">
                        <span className="text-white font-semibold">New Total Room Charge</span>
                        <span className="text-green-400 font-bold">
                          {formatCurrency(extendPreview.newTotalRoomCharge)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Previous: {formatCurrency(extendPreview.currentRoomCharge)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-dark-800">
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
                  Cancel
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
                      <CalendarPlus size={18} />
                      <span>Confirm Extension</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {showDocumentPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-dark-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Document Preview</h2>
              <button
                onClick={() => setShowDocumentPreview(false)}
                className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            {documentError ? (
              <div className="p-6 text-center text-red-400">
                <AlertCircle size={48} className="mx-auto mb-4" />
                <p>{documentError}</p>
              </div>
            ) : (
              <div className="bg-white overflow-auto max-h-[70vh]">
                <iframe
                  src={documentUrl}
                  className="w-full h-[70vh] min-h-[500px]"
                  title="Document Preview"
                />
              </div>
            )}
          </div>
        </div>
      )}

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
                    {documentUrl ? (
                      <button
                        onClick={() => setShowDocumentPreview(true)}
                        className="text-primary-400 text-sm mt-1 flex items-center space-x-1 hover:underline"
                      >
                        <FileText size={14} />
                        <span>View Document</span>
                      </button>
                    ) : (
                      <p className="text-gray-500 text-sm mt-1">No document available</p>
                    )}
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

            {(guest.remarks || guest.advance_payment_amount > 0 || discountInfo) && (
              <div className="mt-6 pt-6 border-t border-dark-800 space-y-4">
                {discountInfo && (
                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <p className="text-yellow-400 font-medium mb-3 flex items-center space-x-2">
                      <Tag size={18} />
                      <span>Discount Applied</span>
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Discount Type</span>
                        <span className="text-white font-medium capitalize">
                          {discountInfo.discountType === 'percentage' 
                            ? `${discountInfo.discountValue}% Off` 
                            : `Fixed Amount`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Discount Amount</span>
                        <span className="text-yellow-400 font-medium">
                          -{formatCurrency(discountInfo.discountAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-yellow-500/20">
                        <span className="text-gray-400">Original Room Charge</span>
                        <span className="text-white font-medium line-through">
                          {formatCurrency(discountInfo.originalRoomCharge)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white font-semibold">Discounted Room Charge</span>
                        <span className="text-yellow-400 font-bold">
                          {formatCurrency(discountInfo.discountedRoomCharge)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
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
                {discountInfo ? (
                  <>
                    <div className="flex justify-between py-2 border-b border-dark-800">
                      <span className="text-gray-400">Room Charges (Original)</span>
                      <span className="text-white font-medium line-through">
                        {formatCurrency(discountInfo.originalRoomCharge)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dark-800">
                      <span className="text-yellow-400 flex items-center space-x-1">
                        <Tag size={16} />
                        <span>
                          Discount ({discountInfo.discountType === 'percentage' 
                            ? `${discountInfo.discountValue}%` 
                            : 'Fixed'})
                        </span>
                      </span>
                      <span className="text-yellow-400 font-medium">
                        -{formatCurrency(discountInfo.discountAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dark-800">
                      <span className="text-gray-400">Room Charges (After Discount)</span>
                      <span className="text-white font-medium">
                        {formatCurrency(discountInfo.discountedRoomCharge)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between py-2 border-b border-dark-800">
                    <span className="text-gray-400">Room Charges</span>
                    <span className="text-white font-medium">{formatCurrency(bill.roomCharges)}</span>
                  </div>
                )}
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