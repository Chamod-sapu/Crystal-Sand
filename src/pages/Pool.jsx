import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../utils/calculations'
import {
  Users,
  Search,
  Plus,
  FileText,
  Loader2,
  Trash2,
  Calendar
} from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import logo from '../Images/Untitled design (2).png'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../context/AuthContext'

export default function Pool() {
  const { userProfile, isSuperAdmin } = useAuth()
  const canEditPrice = isSuperAdmin() || userProfile?.role === 'admin'

  const [activeTab, setActiveTab] = useState('inhouse') // 'inhouse' | 'outside'
  const [loading, setLoading] = useState(false)
  const [inhouseGuests, setInhouseGuests] = useState([])
  const [outsideVisitors, setOutsideVisitors] = useState([])
  const [poolVisits, setPoolVisits] = useState([])
  const [poolPrice, setPoolPrice] = useState(600)
  const [savingPrice, setSavingPrice] = useState(false)
  const [settingsId, setSettingsId] = useState(null)
  
  // Inhouse form state
  const [selectedGuest, setSelectedGuest] = useState('')
  const [inhousePersons, setInhousePersons] = useState(1)
  const [inhouseHours, setInhouseHours] = useState(4)
  const [inhouseNotes, setInhouseNotes] = useState('')

  // Outside form state
  const [outsideName, setOutsideName] = useState('')
  const [outsideContact, setOutsideContact] = useState('')
  const [outsidePersons, setOutsidePersons] = useState(1)
  const [outsideHours, setOutsideHours] = useState(4)
  const [outsideNotes, setOutsideNotes] = useState('')

  const getChargePerPerson = (hours) => Math.ceil((hours || 1) / 4) * poolPrice

  useEffect(() => {
    loadData()
  }, [activeTab])

  async function loadData() {
    setLoading(true)
    try {
      try {
        const { data: settingsData, error } = await supabase.from('settings').select('id, pool_price').single()
        if (!error && settingsData) {
          setSettingsId(settingsData.id)
          if (settingsData.pool_price) {
            setPoolPrice(settingsData.pool_price)
          }
        }
      } catch (err) {
        console.warn('Could not load pool_price from settings (maybe migration not run yet)', err)
      }

      if (activeTab === 'inhouse') {
        const { data: guests } = await supabase
          .from('guests')
          .select('id, name_with_initials, grc_number, room_numbers')
          .eq('status', 'checked_in')
          .order('name_with_initials')
        setInhouseGuests(guests || [])

        const { data: visits } = await supabase
          .from('pool_visits')
          .select('*, guests(name_with_initials, room_numbers)')
          .order('created_at', { ascending: false })
          .limit(50)
        setPoolVisits(visits || [])
      } else {
        const { data: visitors } = await supabase
          .from('pool_outside_visitors')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
        setOutsideVisitors(visitors || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePrice() {
    if (!canEditPrice || !settingsId) {
      if (!settingsId) alert('Settings not loaded yet. Please refresh the page.')
      return
    }
    setSavingPrice(true)
    try {
      const { error } = await supabase.from('settings').update({ pool_price: poolPrice }).eq('id', settingsId)
      if (error) throw error
      alert('Pool price updated successfully')
    } catch (error) {
      console.error(error)
      alert('Failed to update pool price. Please make sure you have run the latest database migrations (database_updates.sql) and reloaded the Supabase schema cache.')
    } finally {
      setSavingPrice(false)
    }
  }

  async function handleAddInhouse(e) {
    e.preventDefault()
    if (!selectedGuest) return alert('Please select a guest')

    setLoading(true)
    try {
      const chargePerPerson = getChargePerPerson(inhouseHours)
      const totalCharge = inhousePersons * chargePerPerson
      const { error } = await supabase.from('pool_visits').insert([{
        guest_id: selectedGuest,
        number_of_persons: inhousePersons,
        number_of_hours: inhouseHours,
        charge_per_person: chargePerPerson,
        total_charge: totalCharge,
        notes: inhouseNotes,
        visit_date: format(new Date(), 'yyyy-MM-dd')
      }])

      if (error) throw error
      
      // Reset form
      setSelectedGuest('')
      setInhousePersons(1)
      setInhouseHours(4)
      setInhouseNotes('')
      
      loadData()
      alert('Pool visit added for in-house guest.')
    } catch (error) {
      console.error(error)
      alert('Failed to add pool visit.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddOutside(e) {
    e.preventDefault()
    if (!outsideName) return alert('Please enter visitor name')

    setLoading(true)
    try {
      const chargePerPerson = getChargePerPerson(outsideHours)
      const totalCharge = outsidePersons * chargePerPerson
      const { error } = await supabase.from('pool_outside_visitors').insert([{
        visitor_name: outsideName,
        contact_number: outsideContact,
        number_of_persons: outsidePersons,
        number_of_hours: outsideHours,
        charge_per_person: chargePerPerson,
        total_charge: totalCharge,
        notes: outsideNotes,
        visit_date: format(new Date(), 'yyyy-MM-dd')
      }])

      if (error) throw error
      
      // Reset form
      setOutsideName('')
      setOutsideContact('')
      setOutsidePersons(1)
      setOutsideHours(4)
      setOutsideNotes('')
      
      loadData()
      alert('Outside visitor added.')
    } catch (error) {
      console.error(error)
      alert('Failed to add outside visitor.')
    } finally {
      setLoading(false)
    }
  }

  async function downloadOutsideBill(visitor) {
    try {
      if (!visitor.first_bill_downloaded_at) {
        const now = new Date().toISOString()
        const { error } = await supabase
          .from('pool_outside_visitors')
          .update({ first_bill_downloaded_at: now })
          .eq('id', visitor.id)
        
        if (error) throw error
        // Update local state so it shows correctly
        setOutsideVisitors(prev => prev.map(v => v.id === visitor.id ? { ...v, first_bill_downloaded_at: now } : v))
      }

      // Generate PDF
      const doc = new jsPDF()
      const cyanColor = [8, 145, 178]
      
      const logoWidth = 60
      const logoHeight = 20
      const logoX = (210 - logoWidth) / 2
      doc.addImage(logo, 'PNG', logoX, 10, logoWidth, logoHeight)

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('POOL VISITOR BILL', 105, 45, { align: 'center' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Date: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, 20, 60)
      doc.text(`Visitor Name: ${visitor.visitor_name}`, 20, 66)
      if (visitor.contact_number) {
        doc.text(`Contact: ${visitor.contact_number}`, 20, 72)
      }

      doc.autoTable({
        startY: 85,
        head: [['Description', 'Persons', 'Rate', 'Amount']],
        body: [
          [`Pool Access (${visitor.number_of_hours || 4} hours)`, visitor.number_of_persons.toString(), formatCurrency(visitor.charge_per_person), formatCurrency(visitor.total_charge)]
        ],
        theme: 'striped',
        headStyles: { fillColor: cyanColor }
      })

      const finalY = doc.lastAutoTable.finalY || 85
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Total:', 130, finalY + 15)
      doc.text(formatCurrency(visitor.total_charge), 180, finalY + 15, { align: 'right' })

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.text('Thank you for visiting Crystal Sands!', 105, finalY + 30, { align: 'center' })

      doc.save(`PoolBill-${visitor.visitor_name.replace(/\s+/g, '-')}.pdf`)
    } catch (error) {
      console.error(error)
      alert('Failed to generate bill.')
    }
  }

  async function handleDeleteInhouse(id) {
    if (!confirm('Are you sure you want to delete this record?')) return
    try {
      await supabase.from('pool_visits').delete().eq('id', id)
      loadData()
    } catch (error) {
      console.error(error)
    }
  }

  async function handleDeleteOutside(id) {
    if (!confirm('Are you sure you want to delete this record?')) return
    try {
      await supabase.from('pool_outside_visitors').delete().eq('id', id)
      loadData()
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center space-x-3">
            <Users size={32} className="text-primary-400" />
            <span>Pool Management</span>
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1">Manage pool access for guests and visitors</p>
        </div>
        {canEditPrice && (
          <div className="flex items-center space-x-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-gray-400">Base Price (Per 4 Hours)</label>
              <input 
                type="number" min="0" step="0.01" 
                className="input-field py-1 text-sm w-32" 
                value={poolPrice} 
                onChange={e => setPoolPrice(parseFloat(e.target.value) || 0)}
              />
            </div>
            <button 
              onClick={handleSavePrice} 
              disabled={savingPrice}
              className="btn-primary py-1 px-3 mt-4 text-sm"
            >
              {savingPrice ? 'Saving...' : 'Save Price'}
            </button>
          </div>
        )}
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('inhouse')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${
            activeTab === 'inhouse' 
              ? 'text-primary-600 dark:text-primary-400' 
              : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          In-House Guests
          {activeTab === 'inhouse' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('outside')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${
            activeTab === 'outside' 
              ? 'text-primary-600 dark:text-primary-400' 
              : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Outside Visitors
          {activeTab === 'outside' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            {activeTab === 'inhouse' ? 'Add In-House Guest' : 'Add Outside Visitor'}
          </h2>
          
          {activeTab === 'inhouse' ? (
            <form onSubmit={handleAddInhouse} className="space-y-4">
              <div>
                <label className="label">Select Guest</label>
                <select 
                  className="input-field" 
                  value={selectedGuest} 
                  onChange={e => setSelectedGuest(e.target.value)}
                  required
                >
                  <option value="">-- Select Guest --</option>
                  {inhouseGuests.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name_with_initials} (Room: {g.room_numbers.join(', ')})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">No. of Persons</label>
                  <input 
                    type="number" min="1" className="input-field" 
                    value={inhousePersons} onChange={e => setInhousePersons(parseInt(e.target.value) || 1)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Duration (Hours)</label>
                  <input 
                    type="number" min="1" className="input-field" 
                    value={inhouseHours} onChange={e => setInhouseHours(parseInt(e.target.value) || 1)}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">Calculated Rate: {formatCurrency(getChargePerPerson(inhouseHours))} / person</p>
                </div>
              </div>
              <div>
                <label className="label">Total Charge</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-lg font-bold text-slate-900 dark:text-white">
                  {formatCurrency(inhousePersons * getChargePerPerson(inhouseHours))}
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <input 
                  type="text" className="input-field" 
                  value={inhouseNotes} onChange={e => setInhouseNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full btn-primary flex justify-center items-center space-x-2">
                <Plus size={18} />
                <span>Add Record</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddOutside} className="space-y-4">
              <div>
                <label className="label">Visitor Name</label>
                <input 
                  type="text" className="input-field" 
                  value={outsideName} onChange={e => setOutsideName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Contact Number</label>
                <input 
                  type="text" className="input-field" 
                  value={outsideContact} onChange={e => setOutsideContact(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">No. of Persons</label>
                  <input 
                    type="number" min="1" className="input-field" 
                    value={outsidePersons} onChange={e => setOutsidePersons(parseInt(e.target.value) || 1)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Duration (Hours)</label>
                  <input 
                    type="number" min="1" className="input-field" 
                    value={outsideHours} onChange={e => setOutsideHours(parseInt(e.target.value) || 1)}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">Calculated Rate: {formatCurrency(getChargePerPerson(outsideHours))} / person</p>
                </div>
              </div>
              <div>
                <label className="label">Total Charge</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-lg font-bold text-slate-900 dark:text-white">
                  {formatCurrency(outsidePersons * getChargePerPerson(outsideHours))}
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <input 
                  type="text" className="input-field" 
                  value={outsideNotes} onChange={e => setOutsideNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full btn-primary flex justify-center items-center space-x-2">
                <Plus size={18} />
                <span>Add Record</span>
              </button>
            </form>
          )}
        </div>

        {/* List Section */}
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            Recent Records
          </h2>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-primary-500" size={32} />
            </div>
          ) : activeTab === 'inhouse' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-sm text-slate-500 dark:text-gray-400">
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Guest</th>
                    <th className="pb-3 pr-4 font-medium">Pax</th>
                    <th className="pb-3 pr-4 font-medium">Total</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {poolVisits.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-500">No records found</td>
                    </tr>
                  ) : poolVisits.map(visit => (
                    <tr key={visit.id} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 pr-4 text-sm">{format(parseISO(visit.created_at), 'MMM dd, HH:mm')}</td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-900 dark:text-white">{visit.guests?.name_with_initials}</p>
                        <p className="text-xs text-slate-500">Room {visit.guests?.room_numbers?.join(', ')}</p>
                      </td>
                      <td className="py-3 pr-4 text-sm">{visit.number_of_persons}</td>
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{formatCurrency(visit.total_charge)}</td>
                      <td className="py-3 text-right">
                        <button onClick={() => handleDeleteInhouse(visit.id)} className="text-red-400 hover:text-red-500 p-1">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-sm text-slate-500 dark:text-gray-400">
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Visitor</th>
                    <th className="pb-3 pr-4 font-medium">Pax</th>
                    <th className="pb-3 pr-4 font-medium">Total</th>
                    <th className="pb-3 pr-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outsideVisitors.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-500">No records found</td>
                    </tr>
                  ) : outsideVisitors.map(visitor => (
                    <tr key={visitor.id} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 pr-4 text-sm">{format(parseISO(visitor.created_at), 'MMM dd, HH:mm')}</td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-900 dark:text-white">{visitor.visitor_name}</p>
                        {visitor.contact_number && <p className="text-xs text-slate-500">{visitor.contact_number}</p>}
                      </td>
                      <td className="py-3 pr-4 text-sm">{visitor.number_of_persons}</td>
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{formatCurrency(visitor.total_charge)}</td>
                      <td className="py-3 flex items-center space-x-2">
                        <button 
                          onClick={() => downloadOutsideBill(visitor)} 
                          className="flex items-center space-x-1 text-xs px-2 py-1 bg-primary-50 text-primary-600 rounded hover:bg-primary-100"
                          title={visitor.first_bill_downloaded_at ? `Downloaded: ${format(parseISO(visitor.first_bill_downloaded_at), 'MMM dd, HH:mm')}` : 'Download Bill'}
                        >
                          <FileText size={14} />
                          <span>Bill</span>
                        </button>
                        <button onClick={() => handleDeleteOutside(visitor.id)} className="text-red-400 hover:text-red-500 p-1">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
