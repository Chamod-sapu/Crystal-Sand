import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  getOccupancyPercentage,
  getUpcomingReservations,
  generateCalendarOccupancy
} from '../utils/availability'
import { formatCurrency } from '../utils/calculations'
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns'
import { Calendar, TrendingUp, Users, DollarSign, X, ChevronLeft, ChevronRight, Download, FileDown } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export default function ReservationForecast() {
  const [guests, setGuests] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(addDays(new Date(), 30), 'yyyy-MM-dd')
  })
  const [roomTypeFilter, setRoomTypeFilter] = useState('all')
  const [forecastData, setForecastData] = useState({
    occupancyPercentage: 0,
    expectedRevenue: 0,
    upcomingReservations: 0,
    occupancyTrend: [],
    roomTypeDistribution: [],
    dailyOccupancy: []
  })

  // Reservation Chart states
  const [showReservationChart, setShowReservationChart] = useState(false)
  const [chartMonth, setChartMonth] = useState(new Date())
  const [reservations, setReservations] = useState([])
  const [chartLoading, setChartLoading] = useState(false)
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [customDateRange, setCustomDateRange] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(addDays(new Date(), 30), 'yyyy-MM-dd')
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    generateForecast()
  }, [guests, rooms, dateRange, roomTypeFilter])

  useEffect(() => {
    if (showReservationChart) {
      loadReservations()
    }
  }, [chartMonth, showReservationChart, useCustomRange, customDateRange])

  async function loadData() {
    try {
      const { data: guestsData } = await supabase
        .from('guests')
        .select('*')

      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')

      setGuests(guestsData || [])
      setRooms(roomsData || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  async function loadReservations() {
    setChartLoading(true)
    try {
      let monthStart, monthEnd
      
      if (useCustomRange) {
        monthStart = customDateRange.start
        monthEnd = customDateRange.end
      } else {
        monthStart = format(startOfMonth(chartMonth), 'yyyy-MM-dd')
        monthEnd = format(endOfMonth(chartMonth), 'yyyy-MM-dd')
      }

      const { data } = await supabase
        .from('guests')
        .select('*')
        .or(`and(date_of_arrival.lte.${monthEnd},date_of_departure.gte.${monthStart})`)
        .neq('status', 'cancelled')

      setReservations(data || [])
    } catch (error) {
      console.error('Error loading reservations:', error)
      setReservations([])
    } finally {
      setChartLoading(false)
    }
  }

  function generateForecast() {
    const startDate = new Date(dateRange.start)
    const endDate = new Date(dateRange.end)

    const filteredGuests = roomTypeFilter === 'all'
      ? guests.filter(g => g.status !== 'cancelled')
      : guests.filter(g => g.status !== 'cancelled' && g.room_type === roomTypeFilter)

    const upcomingRes = getUpcomingReservations(filteredGuests, 60)
    const occupancyData = generateCalendarOccupancy(filteredGuests, startDate, endDate)
    const occupancyPercentage = getOccupancyPercentage(occupancyData, rooms.length)

    const dailyOccupancyTrend = Object.entries(occupancyData)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, data]) => ({
        date: format(new Date(date), 'MMM dd'),
        occupancy: Math.round((data.occupiedCount / rooms.length) * 100),
        rooms: data.occupiedCount
      }))

    const expectedRevenue = filteredGuests.reduce((sum, guest) => {
      if (guest.status === 'cancelled') return sum
      return sum + parseFloat(guest.total_room_charge || 0)
    }, 0)

    const roomTypeDistribution = rooms
      .filter(room => roomTypeFilter === 'all' || room.room_type === roomTypeFilter)
      .reduce((acc, room) => {
        const existing = acc.find(r => r.name === room.room_type)
        if (existing) {
          existing.value++
        } else {
          acc.push({ name: room.room_type, value: 1 })
        }
        return acc
      }, [])

    const occupancyTrend = dailyOccupancyTrend.slice(-14)

    setForecastData({
      occupancyPercentage,
      expectedRevenue,
      upcomingReservations: upcomingRes.length,
      occupancyTrend,
      roomTypeDistribution,
      dailyOccupancy: dailyOccupancyTrend
    })
  }

  const isRoomOccupied = (roomNumber, date) => {
    return reservations.some(reservation => {
      const arrival = new Date(reservation.date_of_arrival)
      const departure = new Date(reservation.date_of_departure)
      const checkDate = new Date(date)
      
      return reservation.room_numbers.includes(roomNumber) &&
             checkDate >= arrival &&
             checkDate <= departure
    })
  }

  const getGuestForRoom = (roomNumber, date) => {
    return reservations.find(reservation => {
      const arrival = new Date(reservation.date_of_arrival)
      const departure = new Date(reservation.date_of_departure)
      const checkDate = new Date(date)
      
      return reservation.room_numbers.includes(roomNumber) &&
             checkDate >= arrival &&
             checkDate <= departure
    })
  }

  const downloadAsExcel = () => {
    let monthStart, monthEnd, days
    
    if (useCustomRange) {
      monthStart = new Date(customDateRange.start)
      monthEnd = new Date(customDateRange.end)
      days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    } else {
      monthStart = startOfMonth(chartMonth)
      monthEnd = endOfMonth(chartMonth)
      days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const chartTitle = useCustomRange 
      ? `${format(monthStart, 'MMM dd, yyyy')} - ${format(monthEnd, 'MMM dd, yyyy')}`
      : format(chartMonth, 'MMMM yyyy')

    // Create HTML table with styles for Excel
    let htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Reservation Chart</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; padding: 8px; text-align: center; font-size: 11px; }
          th { background-color: #c19440; color: white; font-weight: bold; }
          .reserved { background-color: #ff6b6b; color: white; }
          .checked_in { background-color: #4dabf7; color: white; }
          .checked_out { background-color: #ffd700; color: #333; }
          .available { background-color: #90ee90; }
          .past { background-color: #d3d3d3; }
          .room-header { background-color: #f0f0f0; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>Crystal Sand Hotel - Reservation Chart - ${chartTitle}</h2>
        <table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Type</th>
    `

    days.forEach(day => {
      const isPast = day < today
      htmlContent += `<th style="${isPast ? 'background-color: #999; color: white;' : ''}">${format(day, 'dd')}<br/>${format(day, 'EEE')}</th>`
    })

    htmlContent += `
            </tr>
          </thead>
          <tbody>
    `

    const sortedRooms = [...rooms].sort((a, b) => {
      const numA = parseInt(a.room_number.replace(/\D/g, ''))
      const numB = parseInt(b.room_number.replace(/\D/g, ''))
      return numA - numB
    })

    sortedRooms.forEach(room => {
      htmlContent += `
            <tr>
              <td class="room-header">${room.room_number}</td>
              <td class="room-header">${room.room_type}</td>
      `
      
      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const guest = getGuestForRoom(room.room_number, dateStr)
        const isPast = day < today
        const cellClass = isPast && !guest ? 'past' : guest ? guest.status : 'available'
        const cellContent = guest ? `${guest.room_type}${guest.meal_plan ? guest.meal_plan : ''}` : ''
        
        htmlContent += `<td class="${cellClass}">${cellContent}</td>`
      })
      
      htmlContent += `
            </tr>
      `
    })

    htmlContent += `
          </tbody>
        </table>
        <br/>
        <p><strong>Legend:</strong></p>
        <p><span style="background-color: #90ee90; padding: 5px; border: 1px solid #000;">Green</span> = Available | 
           <span style="background-color: #ff6b6b; color:white; padding: 5px; border: 1px solid #000;">Red</span> = Reserved | 
           <span style="background-color: #4dabf7; color:white; padding: 5px; border: 1px solid #000;">Blue</span> = Checked In | 
           <span style="background-color: #ffd700; padding: 5px; border: 1px solid #000;">Yellow</span> = Checked Out | 
           <span style="background-color: #d3d3d3; padding: 5px; border: 1px solid #000;">Gray</span> = Past Date</p>
        <p>Generated on: ${format(new Date(), 'PPpp')}</p>
      </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    const filename = useCustomRange 
      ? `Reservation_Chart_${format(monthStart, 'MMM_dd_yyyy')}_to_${format(monthEnd, 'MMM_dd_yyyy')}.xls`
      : `Reservation_Chart_${format(chartMonth, 'MMMM_yyyy')}.xls`
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadAsPDF = () => {
    let monthStart, monthEnd, days
    
    if (useCustomRange) {
      monthStart = new Date(customDateRange.start)
      monthEnd = new Date(customDateRange.end)
      days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    } else {
      monthStart = startOfMonth(chartMonth)
      monthEnd = endOfMonth(chartMonth)
      days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const chartTitle = useCustomRange 
      ? `${format(monthStart, 'MMM dd, yyyy')} - ${format(monthEnd, 'MMM dd, yyyy')}`
      : format(chartMonth, 'MMMM yyyy')

    const sortedRooms = [...rooms].sort((a, b) => {
      const numA = parseInt(a.room_number.replace(/\D/g, ''))
      const numB = parseInt(b.room_number.replace(/\D/g, ''))
      return numA - numB
    })

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reservation Chart - ${chartTitle}</title>
        <style>
          @media print {
            @page { 
              size: landscape;
              margin: 0.5cm;
            }
            body { margin: 0; }
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 10px;
          }
          h1 { 
            text-align: center; 
            color: #333;
            font-size: 18px;
            margin-bottom: 5px;
          }
          h2 { 
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-top: 0;
            margin-bottom: 10px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 9px;
          }
          th, td { 
            border: 1px solid #000; 
            padding: 3px; 
            text-align: center;
          }
          th { 
            background-color: #c19440; 
            color: white; 
            font-weight: bold;
            font-size: 8px;
          }
          .reserved { 
            background-color: #ff6b6b;
            color: white;
            font-weight: bold;
          }
          .checked_in { 
            background-color: #4dabf7;
            color: white;
            font-weight: bold;
          }
          .checked_out { 
            background-color: #ffd700;
            color: #333;
            font-weight: bold;
          }
          .available { 
            background-color: #90ee90; 
          }
          .past { 
            background-color: #d3d3d3; 
            color: #666;
          }
          .past-header {
            background-color: #999;
            color: white;
          }
          .room-header { 
            background-color: #f0f0f0; 
            font-weight: bold;
          }
          .legend {
            margin-top: 10px;
            font-size: 10px;
          }
          .legend-item {
            display: inline-block;
            margin-right: 15px;
          }
          .legend-box {
            display: inline-block;
            width: 20px;
            height: 15px;
            border: 1px solid #000;
            vertical-align: middle;
            margin-right: 5px;
          }
        </style>
      </head>
      <body>
        <h1>Crystal Sand Hotel - Reservation Chart</h1>
        <h2>${chartTitle}</h2>
        <table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Type</th>
              ${days.map(day => {
                const isPast = day < today
                return `<th class="${isPast ? 'past-header' : ''}">${format(day, 'dd')}<br/>${format(day, 'EEE')}</th>`
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${sortedRooms.map(room => `
              <tr>
                <td class="room-header">${room.room_number}</td>
                <td class="room-header">${room.room_type}</td>
                ${days.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const guest = getGuestForRoom(room.room_number, dateStr)
                  const isPast = day < today
                  const cellClass = isPast && !guest ? 'past' : guest ? guest.status : 'available'
                  return `<td class="${cellClass}">${guest ? `${guest.room_type}${guest.meal_plan || ''}` : ''}</td>`
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="legend">
          <p><strong>Legend:</strong></p>
          <div class="legend-item">
            <span class="legend-box" style="background-color: #90ee90;"></span>
            <span>Available</span>
          </div>
          <div class="legend-item">
            <span class="legend-box" style="background-color: #ff6b6b;"></span>
            <span>Reserved</span>
          </div>
          <div class="legend-item">
            <span class="legend-box" style="background-color: #4dabf7;"></span>
            <span>Checked In</span>
          </div>
          <div class="legend-item">
            <span class="legend-box" style="background-color: #ffd700;"></span>
            <span>Checked Out</span>
          </div>
          <div class="legend-item">
            <span class="legend-box" style="background-color: #d3d3d3;"></span>
            <span>Past Date</span>
          </div>
          <p style="margin-top: 10px; font-size: 9px;">Generated on: ${format(new Date(), 'PPpp')}</p>
        </div>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const renderReservationChart = () => {
    let monthStart, monthEnd, days
    
    if (useCustomRange) {
      monthStart = new Date(customDateRange.start)
      monthEnd = new Date(customDateRange.end)
      days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    } else {
      monthStart = startOfMonth(chartMonth)
      monthEnd = endOfMonth(chartMonth)
      days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sortedRooms = [...rooms].sort((a, b) => {
      const numA = parseInt(a.room_number.replace(/\D/g, ''))
      const numB = parseInt(b.room_number.replace(/\D/g, ''))
      return numA - numB
    })

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-dark-800">
              <th className="border border-dark-700 p-2 text-left sticky left-0 bg-dark-800 z-10">Room</th>
              <th className="border border-dark-700 p-2 text-left sticky left-16 bg-dark-800 z-10">Type</th>
              {days.map((day, index) => {
                const isPast = day < today
                return (
                  <th key={index} className={`border border-dark-700 p-2 min-w-[40px] ${isPast ? 'bg-gray-700/30' : ''}`}>
                    <div className={isPast ? 'text-gray-600' : ''}>{format(day, 'dd')}</div>
                    <div className={`text-[10px] ${isPast ? 'text-gray-700' : 'text-gray-500'}`}>{format(day, 'EEE')}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRooms.map((room) => (
              <tr key={room.id} className="hover:bg-dark-800/50">
                <td className="border border-dark-700 p-2 font-bold sticky left-0 bg-dark-900 z-10">
                  {room.room_number}
                </td>
                <td className="border border-dark-700 p-2 sticky left-16 bg-dark-900 z-10">
                  {room.room_type}
                </td>
                {days.map((day, index) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const guest = getGuestForRoom(room.room_number, dateStr)
                  const isOccupied = isRoomOccupied(room.room_number, dateStr)
                  const isPast = day < today
                  
                  return (
                    <td
                      key={index}
                      className={`border border-dark-700 p-1 text-center ${
                        isPast && !isOccupied
                          ? 'bg-gray-700/20 cursor-not-allowed'
                          : guest?.status === 'reserved'
                          ? 'bg-red-500/30 hover:bg-red-500/40 cursor-pointer'
                          : guest?.status === 'checked_in'
                          ? 'bg-blue-500/30 hover:bg-blue-500/40 cursor-pointer'
                          : guest?.status === 'checked_out'
                          ? 'bg-yellow-500/30 hover:bg-yellow-500/40 cursor-pointer'
                          : 'bg-green-500/20 hover:bg-green-500/30 cursor-pointer'
                      }`}
                      title={
                        isPast && !isOccupied 
                          ? 'Past date' 
                          : guest 
                          ? `${guest.name_with_initials} (${guest.grc_number}) - ${guest.status}` 
                          : 'Available'
                      }
                    >
                      {guest && (
                        <div className={`text-[10px] font-bold ${isPast ? 'text-gray-500' : 'text-white'}`}>
                          {guest.room_type}{guest.meal_plan || ''}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const colors = ['#c19440', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Reservation Forecast</h1>
          <p className="text-gray-400 mt-1">Analytics and planning for upcoming reservations</p>
        </div>
        <button
          onClick={() => setShowReservationChart(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Calendar size={20} />
          <span>Reservation Chart</span>
        </button>
      </div>

      {/* Reservation Chart Modal */}
      {showReservationChart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-lg w-full max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-dark-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Monthly Reservation Chart</h2>
                <button
                  onClick={() => setShowReservationChart(false)}
                  className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              {/* Date Range Toggle */}
              <div className="mb-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setUseCustomRange(false)}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      !useCustomRange 
                        ? 'bg-primary-600 text-white' 
                        : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                    }`}
                  >
                    Monthly View
                  </button>
                  <button
                    onClick={() => setUseCustomRange(true)}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      useCustomRange 
                        ? 'bg-primary-600 text-white' 
                        : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                    }`}
                  >
                    Custom Range
                  </button>
                </div>
              </div>

              {/* Month Navigation or Custom Date Range */}
              {!useCustomRange ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setChartMonth(subMonths(chartMonth, 1))}
                      className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                    >
                      <ChevronLeft size={20} className="text-gray-400" />
                    </button>
                    <span className="text-white font-medium text-lg min-w-[160px] text-center">
                      {format(chartMonth, 'MMMM yyyy')}
                    </span>
                    <button
                      onClick={() => setChartMonth(addMonths(chartMonth, 1))}
                      className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                    >
                      <ChevronRight size={20} className="text-gray-400" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={downloadAsExcel}
                      className="btn-secondary flex items-center space-x-2 text-sm"
                    >
                      <FileDown size={16} />
                      <span>Excel</span>
                    </button>
                    <button
                      onClick={downloadAsPDF}
                      className="btn-secondary flex items-center space-x-2 text-sm"
                    >
                      <Download size={16} />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label text-sm">Start Date</label>
                      <input
                        type="date"
                        value={customDateRange.start}
                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label text-sm">End Date</label>
                      <input
                        type="date"
                        value={customDateRange.end}
                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                        min={customDateRange.start}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-400">
                      Showing: <span className="text-white font-medium">
                        {format(new Date(customDateRange.start), 'MMM dd, yyyy')} - {format(new Date(customDateRange.end), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={downloadAsExcel}
                        className="btn-secondary flex items-center space-x-2 text-sm"
                      >
                        <FileDown size={16} />
                        <span>Excel</span>
                      </button>
                      <button
                        onClick={downloadAsPDF}
                        className="btn-secondary flex items-center space-x-2 text-sm"
                      >
                        <Download size={16} />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center flex-wrap gap-4 mt-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500/20 border border-green-500/50 rounded"></div>
                  <span className="text-gray-400">Available</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500/30 border border-red-500/50 rounded"></div>
                  <span className="text-gray-400">Reserved</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500/30 border border-blue-500/50 rounded"></div>
                  <span className="text-gray-400">Check-in</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-yellow-500/30 border border-yellow-500/50 rounded"></div>
                  <span className="text-gray-400">Check-out</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-700/20 border border-gray-700/50 rounded"></div>
                  <span className="text-gray-400">Past Date</span>
                </div>
                <div className="text-gray-500">
                  Total Rooms: <span className="text-white font-medium">{rooms.length}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {chartLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                renderReservationChart()
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-lg font-bold text-white mb-4">Forecast Period</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Filter by Room Type</label>
            <select
              value={roomTypeFilter}
              onChange={(e) => setRoomTypeFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All Types</option>
              <option value="SGL">Single</option>
              <option value="DBL">Double</option>
              <option value="TPL">Triple</option>
              <option value="QUAD">Quadruple</option>
              <option value="FAMILY">Family</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400 text-sm font-medium">Occupancy Rate</h3>
            <TrendingUp className="text-primary-400" size={20} />
          </div>
          <p className="text-xl font-bold text-primary-400">{forecastData.occupancyPercentage}%</p>
          <p className="text-xs text-gray-500 mt-2">Average occupancy in forecast period</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400 text-sm font-medium">Expected Revenue</h3>
            <DollarSign className="text-green-400" size={20} />
          </div>
          <p className="text-xl font-bold text-green-400">{formatCurrency(forecastData.expectedRevenue)}</p>
          <p className="text-xs text-gray-500 mt-2">From room charges only</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400 text-sm font-medium">Upcoming Reservations</h3>
            <Users className="text-blue-400" size={20} />
          </div>
          <p className="text-xl font-bold text-blue-400">{forecastData.upcomingReservations}</p>
          <p className="text-xs text-gray-500 mt-2">In the next 60 days</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400 text-sm font-medium">Total Rooms</h3>
            <Calendar className="text-orange-400" size={20} />
          </div>
          <p className="text-xl font-bold text-orange-400">{rooms.length}</p>
          <p className="text-xs text-gray-500 mt-2">In property</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-4">Occupancy Trend (Last 14 Days)</h2>
          {forecastData.occupancyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={forecastData.occupancyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#F3F4F6'
                  }}
                  formatter={(value) => `${value}%`}
                />
                <Line
                  type="monotone"
                  dataKey="occupancy"
                  stroke="#c19440"
                  strokeWidth={2}
                  dot={{ fill: '#c19440', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">
              No occupancy data available
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-4">Room Type Distribution</h2>
          {forecastData.roomTypeDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={forecastData.roomTypeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {forecastData.roomTypeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#F3F4F6'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">
              No room data available
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold text-white mb-4">Daily Occupancy</h2>
        {forecastData.dailyOccupancy.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={forecastData.dailyOccupancy}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  color: '#F3F4F6'
                }}
                formatter={(value) => [`${value}%`, 'Occupancy']}
              />
              <Bar dataKey="occupancy" fill="#c19440" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-96 flex items-center justify-center text-gray-500">
            No occupancy data for this period
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold text-white mb-6">Upcoming Reservations</h2>
        <div className="space-y-3">
          {getUpcomingReservations(
            roomTypeFilter === 'all'
              ? guests
              : guests.filter(g => g.room_type === roomTypeFilter)
          ).length === 0 ? (
            <p className="text-center text-gray-500 py-8">No upcoming reservations</p>
          ) : (
            getUpcomingReservations(
              roomTypeFilter === 'all'
                ? guests
                : guests.filter(g => g.room_type === roomTypeFilter)
            ).slice(0, 10).map(guest => (
              <div key={guest.id} className="p-4 bg-dark-800 rounded-lg flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-white font-medium">{guest.name_with_initials}</h3>
                  <p className="text-sm text-gray-400">
                    {format(new Date(guest.date_of_arrival), 'MMM dd')} - {format(new Date(guest.date_of_departure), 'MMM dd')} • {guest.room_numbers.join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-primary-400 font-bold">
                    {formatCurrency(guest.total_room_charge)}
                  </p>
                  <p className="text-xs text-gray-500">{guest.room_type}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}