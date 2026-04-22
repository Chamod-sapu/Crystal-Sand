import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../utils/calculations'
import {
  TrendingUp,
  DollarSign,
  Bed,
  Coffee,
  ShoppingBag,
  Calendar,
  ChevronDown,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Filter
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO } from 'date-fns'
import XLSX from 'xlsx-js-style'

const PERIOD_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 3 Days', value: '3days' },
  { label: 'Last 7 Days', value: '7days' },
  { label: 'Last 30 Days', value: '30days' },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' },
  { label: 'Custom Range', value: 'custom' },
]

function getPeriodDates(period, customFrom, customTo) {
  const now = new Date()
  switch (period) {
    case 'today':
      return { from: format(now, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    case 'yesterday':
      const yesterday = subDays(now, 1)
      return { from: format(yesterday, 'yyyy-MM-dd'), to: format(yesterday, 'yyyy-MM-dd') }
    case '3days':
      return { from: format(subDays(now, 2), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    case '7days':
      return { from: format(subDays(now, 6), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    case '30days':
      return { from: format(subDays(now, 29), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    case 'month':
      return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }
    case 'year':
      return { from: format(startOfYear(now), 'yyyy-MM-dd'), to: format(endOfYear(now), 'yyyy-MM-dd') }
    case 'custom':
      return { from: customFrom, to: customTo }
    default:
      return { from: format(now, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
  }
}

function StatCard({ title, value, icon: Icon, color, sub, trend }) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{value}</p>
          {sub && <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center space-x-1 mt-3 text-xs font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <span>{Math.abs(trend).toFixed(1)}% vs previous period</span>
        </div>
      )}
    </div>
  )
}

export default function Sales() {
  const [period, setPeriod] = useState('today')
  const [customFrom, setCustomFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState({
    roomRevenue: 0,
    fbRevenue: 0,
    otherRevenue: 0,
    totalRevenue: 0,
    totalCheckouts: 0,
    totalGuests: 0,
    avgRoomRate: 0,
  })

  const [topItems, setTopItems] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [revenueByCategory, setRevenueByCategory] = useState([])

  useEffect(() => {
    loadSalesData()
  }, [period, customFrom, customTo])

  async function loadSalesData() {
    setLoading(true)
    const { from, to } = getPeriodDates(period, customFrom, customTo)
    const toInclusive = to + 'T23:59:59'

    try {
      // 1. Room Revenue — from checked-out guests in period
      const { data: guestsData } = await supabase
        .from('guests')
        .select('id, name_with_initials, total_room_charge, date_of_departure, number_of_rooms, room_type, created_at')
        .gte('date_of_departure', from)
        .lte('date_of_departure', to)
        .eq('status', 'checked_out')
        .order('date_of_departure', { ascending: false })

      // Also get checked-in guests for count
      const { data: checkedInGuests } = await supabase
        .from('guests')
        .select('id')
        .gte('date_of_arrival', from)
        .lte('date_of_arrival', to)

      // 2. F&B Revenue (room consumption)
      const { data: fbConsumption } = await supabase
        .from('fb_consumption')
        .select('total_price, category, item_name, consumed_at, quantity')
        .gte('consumed_at', from)
        .lte('consumed_at', toInclusive)

      // 3. Restaurant orders
      const { data: restaurantOrders } = await supabase
        .from('restaurant_orders')
        .select('total_price, item_name, created_at, quantity')
        .gte('created_at', from)
        .lte('created_at', toInclusive)

      // 4. Other purchases
      const { data: purchases } = await supabase
        .from('purchases')
        .select('total_price, category, item_name, purchase_date')
        .gte('purchase_date', from)
        .lte('purchase_date', toInclusive)

      // Calculate totals
      const roomRevenue = (guestsData || []).reduce((s, g) => s + (parseFloat(g.total_room_charge) || 0), 0)
      const fbRoomRevenue = (fbConsumption || []).reduce((s, c) => s + (parseFloat(c.total_price) || 0), 0)
      const fbRestoRevenue = (restaurantOrders || []).reduce((s, o) => s + (parseFloat(o.total_price) || 0), 0)
      const fbRevenue = fbRoomRevenue + fbRestoRevenue
      const otherRevenue = (purchases || []).reduce((s, p) => s + (parseFloat(p.total_price) || 0), 0)
      const totalRevenue = roomRevenue + fbRevenue + otherRevenue
      const totalCheckouts = guestsData?.length || 0
      const totalGuests = (checkedInGuests?.length || 0) + totalCheckouts
      const avgRoomRate = totalCheckouts > 0 ? roomRevenue / totalCheckouts : 0

      setStats({ roomRevenue, fbRevenue, otherRevenue, totalRevenue, totalCheckouts, totalGuests, avgRoomRate })

      // Revenue breakdown by category
      const categoryMap = {}
      ;(fbConsumption || []).forEach(c => {
        const cat = c.category || 'F&B (Room)'
        categoryMap[cat] = (categoryMap[cat] || 0) + parseFloat(c.total_price || 0)
      })
      ;(restaurantOrders || []).forEach(() => {
        categoryMap['Restaurant'] = (categoryMap['Restaurant'] || 0) + fbRestoRevenue
      })
      ;(purchases || []).forEach(p => {
        const cat = p.category.charAt(0).toUpperCase() + p.category.slice(1)
        categoryMap[cat] = (categoryMap[cat] || 0) + parseFloat(p.total_price || 0)
      })
      if (roomRevenue > 0) categoryMap['Room Charges'] = roomRevenue

      const breakdown = Object.entries(categoryMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
      setRevenueByCategory(breakdown)

      // Top selling F&B items
      const itemMap = {}
      ;[...(fbConsumption || []), ...(restaurantOrders || [])].forEach(item => {
        const key = item.item_name
        if (!itemMap[key]) itemMap[key] = { name: key, revenue: 0, qty: 0 }
        itemMap[key].revenue += parseFloat(item.total_price || 0)
        itemMap[key].qty += parseInt(item.quantity || 1)
      })
      setTopItems(Object.values(itemMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8))

      // Recent transactions — combine checkouts and F&B
      const transactions = [
        ...(guestsData || []).slice(0, 5).map(g => ({
          id: g.id,
          type: 'room',
          name: g.name_with_initials,
          amount: parseFloat(g.total_room_charge || 0),
          date: g.date_of_departure,
          label: `Room ${g.room_type} checkout`
        })),
        ...(fbConsumption || []).slice(0, 5).map(c => ({
          id: c.id || Math.random(),
          type: 'fb',
          name: c.item_name,
          amount: parseFloat(c.total_price || 0),
          date: c.consumed_at?.split('T')[0],
          label: c.category
        }))
      ]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10)

      setRecentTransactions(transactions)
    } catch (error) {
      console.error('Error loading sales data:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportSalesData = async () => {
    setLoading(true)
    try {
      const { from, to } = getPeriodDates(period, customFrom, customTo)
      const toInclusive = to + 'T23:59:59'
      const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label || period
      const exportedAt = format(new Date(), 'dd MMM yyyy, HH:mm')

      // ── Fetch data ──────────────────────────────────────────────────────────
      const { data: guestsData } = await supabase
        .from('guests')
        .select('id, name_with_initials, room_numbers, total_room_charge, room_type, number_of_rooms, date_of_arrival, date_of_departure, time_of_arrival, time_of_departure')
        .gte('date_of_departure', from)
        .lte('date_of_departure', to)
        .eq('status', 'checked_out')

      const { data: fbData } = await supabase
        .from('fb_consumption')
        .select('total_price, item_name, quantity, guests!inner(room_numbers, date_of_arrival, date_of_departure, time_of_arrival, time_of_departure)')
        .gte('consumed_at', from)
        .lte('consumed_at', toInclusive)

      const { data: restoData } = await supabase
        .from('restaurant_orders')
        .select('total_price, item_name, quantity')
        .gte('created_at', from)
        .lte('created_at', toInclusive)

      const { data: extraData } = await supabase
        .from('purchases')
        .select('total_price, item_name, category, guests!inner(room_numbers, date_of_arrival, date_of_departure, time_of_arrival, time_of_departure)')
        .gte('purchase_date', from)
        .lte('purchase_date', toInclusive)

      // ── Colour palette ───────────────────────────────────────────────────────
      // Deep navy (header bg)
      const NAVY    = { rgb: '1E293B' }
      // Accent teal
      const TEAL    = { rgb: '0891B2' }
      // Soft teal for sub-headers
      const TEAL_LT = { rgb: 'CFFAFE' }
      // Amber for F&B
      const AMBER   = { rgb: 'D97706' }
      const AMB_LT  = { rgb: 'FEF3C7' }
      // Green for extra
      const GREEN   = { rgb: '059669' }
      const GRN_LT  = { rgb: 'D1FAE5' }
      // Alternating row bg
      const ROW_ALT = { rgb: 'F1F5F9' }
      // Total row
      const TOTAL_BG = { rgb: '1E293B' }
      const WHITE   = { rgb: 'FFFFFF' }
      const DARK    = { rgb: '0F172A' }

      // ── Helper: style cell ─────────────────────────────────────────────────
      const cell = (v, opts = {}) => {
        const {
          bold = false,
          italic = false,
          sz = 11,
          fgColor = null,
          bgColor = null,
          halign = 'left',
          numFmt = null,
          wrap = false,
          border = false,
        } = opts
        const c = { v, t: typeof v === 'number' ? 'n' : 's' }
        if (numFmt) { c.t = 'n'; c.z = numFmt }
        c.s = {
          font: { name: 'Calibri', sz, bold, italic, color: fgColor || DARK },
          alignment: { horizontal: halign, vertical: 'center', wrapText: wrap },
          ...(bgColor ? { fill: { patternType: 'solid', fgColor: bgColor } } : {}),
          ...(border ? {
            border: {
              top:    { style: 'thin', color: { rgb: 'CBD5E1' } },
              bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
              left:   { style: 'thin', color: { rgb: 'CBD5E1' } },
              right:  { style: 'thin', color: { rgb: 'CBD5E1' } },
            }
          } : {}),
        }
        return c
      }

      // ── Helper: blank cell ─────────────────────────────────────────────────
      const blank = (bgColor = null, border = false) => cell('', { bgColor, border })

      // ── Helper: build a styled sheet ──────────────────────────────────────
      const buildSheet = (rows, cols, dataStartRow) => {
        const ws = {}
        rows.forEach((row, ri) => {
          row.forEach((c, ci) => {
            if (c == null) return
            const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
            ws[addr] = c
          })
        })
        ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: cols.length - 1 } })
        ws['!cols'] = cols
        return ws
      }

      // ═══════════════════════════════════════════════════════════════════════
      // SHEET 1 — COVER / SUMMARY
      // ═══════════════════════════════════════════════════════════════════════
      const totalRooms = (guestsData || []).reduce((s, g) => s + parseFloat(g.total_room_charge || 0), 0)
      const totalFB    = [...(fbData || []), ...(restoData || [])].reduce((s, i) => s + parseFloat(i.total_price || 0), 0)
      const totalExtra = (extraData || []).reduce((s, i) => s + parseFloat(i.total_price || 0), 0)
      const grandTotal = totalRooms + totalFB + totalExtra

      const fmt = '#,##0.00'
      const coverRows = [
        // Row 0 – logo / title span
        [cell('CRYSTAL SANDS', { bold: true, sz: 22, bgColor: NAVY, fgColor: WHITE, halign: 'center' }), null, null, null, null, null],
        [cell('Sales Revenue Report', { bold: false, sz: 13, bgColor: NAVY, fgColor: { rgb: '94A3B8' }, halign: 'center' }), null, null, null, null, null],
        [blank(NAVY), null, null, null, null, null],
        // Row 3 – meta
        [cell('Period', { bold: true, sz: 11, bgColor: TEAL_LT, border: true }), cell(periodLabel, { sz: 11, halign: 'center', border: true }), blank(), blank(), blank(), blank()],
        [cell('Date Range', { bold: true, sz: 11, bgColor: TEAL_LT, border: true }), cell(`${from}  →  ${to}`, { sz: 11, halign: 'center', border: true }), blank(), blank(), blank(), blank()],
        [cell('Exported On', { bold: true, sz: 11, bgColor: TEAL_LT, border: true }), cell(exportedAt, { sz: 11, halign: 'center', border: true }), blank(), blank(), blank(), blank()],
        [blank(), blank(), blank(), blank(), blank(), blank()],
        // Row 7 – summary header
        [cell('REVENUE SUMMARY', { bold: true, sz: 12, bgColor: TEAL, fgColor: WHITE, halign: 'center' }), null, null, null, null, null],
        // header columns
        [
          cell('Category', { bold: true, sz: 11, bgColor: NAVY, fgColor: WHITE, border: true }),
          cell('Transactions', { bold: true, sz: 11, bgColor: NAVY, fgColor: WHITE, halign: 'center', border: true }),
          cell('Total (LKR)', { bold: true, sz: 11, bgColor: NAVY, fgColor: WHITE, halign: 'right', border: true }),
          cell('% of Total', { bold: true, sz: 11, bgColor: NAVY, fgColor: WHITE, halign: 'right', border: true }),
          blank(NAVY), blank(NAVY),
        ],
        // Room row
        [
          cell('Room Revenue', { bold: true, sz: 11, bgColor: TEAL_LT, border: true }),
          cell(guestsData?.length || 0, { sz: 11, halign: 'center', bgColor: TEAL_LT, border: true }),
          cell(totalRooms, { bold: true, sz: 11, halign: 'right', bgColor: TEAL_LT, numFmt: fmt, border: true }),
          cell(grandTotal > 0 ? +((totalRooms / grandTotal) * 100).toFixed(1) : 0, { sz: 11, halign: 'right', bgColor: TEAL_LT, numFmt: '0.0"%"', border: true }),
          blank(TEAL_LT), blank(TEAL_LT),
        ],
        // F&B row
        [
          cell('F&B / Restaurant', { bold: true, sz: 11, bgColor: AMB_LT, border: true }),
          cell((fbData?.length || 0) + (restoData?.length || 0), { sz: 11, halign: 'center', bgColor: AMB_LT, border: true }),
          cell(totalFB, { bold: true, sz: 11, halign: 'right', bgColor: AMB_LT, numFmt: fmt, border: true }),
          cell(grandTotal > 0 ? +((totalFB / grandTotal) * 100).toFixed(1) : 0, { sz: 11, halign: 'right', bgColor: AMB_LT, numFmt: '0.0"%"', border: true }),
          blank(AMB_LT), blank(AMB_LT),
        ],
        // Extra row
        [
          cell('Extra / Other', { bold: true, sz: 11, bgColor: GRN_LT, border: true }),
          cell(extraData?.length || 0, { sz: 11, halign: 'center', bgColor: GRN_LT, border: true }),
          cell(totalExtra, { bold: true, sz: 11, halign: 'right', bgColor: GRN_LT, numFmt: fmt, border: true }),
          cell(grandTotal > 0 ? +((totalExtra / grandTotal) * 100).toFixed(1) : 0, { sz: 11, halign: 'right', bgColor: GRN_LT, numFmt: '0.0"%"', border: true }),
          blank(GRN_LT), blank(GRN_LT),
        ],
        // Grand total row
        [
          cell('GRAND TOTAL', { bold: true, sz: 12, bgColor: TOTAL_BG, fgColor: WHITE, border: true }),
          cell((guestsData?.length || 0) + (fbData?.length || 0) + (restoData?.length || 0) + (extraData?.length || 0), { bold: true, sz: 11, halign: 'center', bgColor: TOTAL_BG, fgColor: WHITE, border: true }),
          cell(grandTotal, { bold: true, sz: 12, halign: 'right', bgColor: TOTAL_BG, fgColor: { rgb: '34D399' }, numFmt: fmt, border: true }),
          cell(100, { bold: true, sz: 11, halign: 'right', bgColor: TOTAL_BG, fgColor: WHITE, numFmt: '0.0"%"', border: true }),
          blank(TOTAL_BG, true), blank(TOTAL_BG, true),
        ],
        [blank(), blank(), blank(), blank(), blank(), blank()],
        [cell('Crystal Sands Hotel Management System', { italic: true, sz: 9, fgColor: { rgb: '94A3B8' } }), null, null, null, null, null],
      ]

      const wsCover = buildSheet(coverRows, [
        { wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 10 }
      ], 8)

      // Merge cells for title rows and summary header
      wsCover['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
        { s: { r: 3, c: 1 }, e: { r: 3, c: 5 } },
        { s: { r: 4, c: 1 }, e: { r: 4, c: 5 } },
        { s: { r: 5, c: 1 }, e: { r: 5, c: 5 } },
        { s: { r: 7, c: 0 }, e: { r: 7, c: 5 } },
        { s: { r: 14, c: 0 }, e: { r: 14, c: 5 } },
      ]
      wsCover['!rows'] = [{ hpt: 36 }, { hpt: 22 }, { hpt: 10 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 10 }, { hpt: 24 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 26 }]

      // ═══════════════════════════════════════════════════════════════════════
      // Helper: build data sheet (rooms / F&B / extra)
      // ═══════════════════════════════════════════════════════════════════════
      const buildDataSheet = ({ title, sheetColor, lightColor, dataRows, totalAmount, totalLabel }) => {
        const COLS = ['Room No.', 'Guest / Description', 'Check-in Date & Time', 'Checkout Date & Time', 'Amount (LKR)']
        const numFmtLKR = '#,##0.00'

        const rows = [
          // Row 0: big title
          Array(COLS.length).fill(null).map((_, i) =>
            i === 0 ? cell('CRYSTAL SANDS', { bold: true, sz: 18, bgColor: NAVY, fgColor: WHITE }) : blank(NAVY)),
          // Row 1: sub-title
          Array(COLS.length).fill(null).map((_, i) =>
            i === 0 ? cell(title, { bold: true, sz: 12, bgColor: sheetColor, fgColor: WHITE }) : blank(sheetColor)),
          // Row 2: period info
          Array(COLS.length).fill(null).map((_, i) =>
            i === 0 ? cell(`Period: ${periodLabel}  |  ${from} to ${to}  |  Exported: ${exportedAt}`, { italic: true, sz: 9, bgColor: lightColor }) : blank(lightColor)),
          // Row 3: blank separator
          Array(COLS.length).fill(null).map(() => blank()),
          // Row 4: column headers
          COLS.map(h => cell(h, { bold: true, sz: 11, bgColor: sheetColor, fgColor: WHITE, halign: h.includes('Amount') ? 'right' : 'left', border: true })),
        ]

        // Data rows
        dataRows.forEach((dr, idx) => {
          const isAlt = idx % 2 === 1
          const bg = isAlt ? ROW_ALT : null
          rows.push([
            cell(dr.room || '', { sz: 11, bgColor: bg, border: true }),
            cell(dr.desc || '', { sz: 11, bgColor: bg, border: true, wrap: true }),
            cell(dr.checkIn || '', { sz: 10, bgColor: bg, border: true }),
            cell(dr.checkOut || '', { sz: 10, bgColor: bg, border: true }),
            cell(dr.amount, { sz: 11, halign: 'right', bgColor: bg, numFmt: numFmtLKR, border: true }),
          ])
        })

        // Empty row before total
        rows.push(Array(COLS.length).fill(null).map(() => blank()))

        // Total row
        rows.push([
          cell(totalLabel, { bold: true, sz: 12, bgColor: TOTAL_BG, fgColor: WHITE, border: true }),
          blank(TOTAL_BG, true), blank(TOTAL_BG, true), blank(TOTAL_BG, true),
          cell(totalAmount, { bold: true, sz: 12, halign: 'right', bgColor: TOTAL_BG, fgColor: { rgb: '34D399' }, numFmt: numFmtLKR, border: true }),
        ])

        // Footer note
        rows.push(Array(COLS.length).fill(null).map(() => blank()))
        rows.push([
          cell('Crystal Sands Hotel Management System — Confidential', { italic: true, sz: 9, fgColor: { rgb: '94A3B8' } }),
          null, null, null, null,
        ])

        const ws = buildSheet(rows,
          [{ wch: 16 }, { wch: 36 }, { wch: 24 }, { wch: 24 }, { wch: 18 }],
          4)

        // Row heights
        ws['!rows'] = [{ hpt: 32 }, { hpt: 22 }, { hpt: 18 }, { hpt: 6 }, { hpt: 20 }]

        // Merges: title + subtitle + period row span all 5 cols
        ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
          { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
          { s: { r: rows.length - 2, c: 0 }, e: { r: rows.length - 2, c: 4 } },
          { s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 4 } },
          { s: { r: rows.length - 3, c: 0 }, e: { r: rows.length - 3, c: 3 } }, // total label span
        ]

        return ws
      }

      // ── Sheet 2: Room Revenue ───────────────────────────────────────────────
      const roomDataRows = (guestsData || []).map(g => ({
        room:     (g.room_numbers || []).join(', '),
        desc:     `${g.name_with_initials || '—'} · Room ×${g.number_of_rooms || 1} (${g.room_type || ''})`,
        checkIn:  `${g.date_of_arrival || ''}  ${g.time_of_arrival || ''}`.trim(),
        checkOut: `${g.date_of_departure || ''}  ${g.time_of_departure || ''}`.trim(),
        amount:   parseFloat(g.total_room_charge || 0),
      }))

      const wsRooms = buildDataSheet({
        title:       'Daily Revenue Summary — Rooms',
        sheetColor:  TEAL,
        lightColor:  TEAL_LT,
        dataRows:    roomDataRows,
        totalAmount: totalRooms,
        totalLabel:  'TOTAL ROOM REVENUE',
      })

      // ── Sheet 3: F&B Revenue ───────────────────────────────────────────────
      const fbDataRows = [
        ...(fbData || []).map(item => {
          const g = item.guests || {}
          return {
            room:     (g.room_numbers || []).join(', '),
            desc:     item.item_name || '—',
            checkIn:  `${g.date_of_arrival || ''}  ${g.time_of_arrival || ''}`.trim(),
            checkOut: `${g.date_of_departure || ''}  ${g.time_of_departure || ''}`.trim(),
            amount:   parseFloat(item.total_price || 0),
          }
        }),
        ...(restoData || []).map(item => ({
          room:     'Restaurant',
          desc:     item.item_name || '—',
          checkIn:  '',
          checkOut: '',
          amount:   parseFloat(item.total_price || 0),
        })),
      ]

      const wsFB = buildDataSheet({
        title:       'Daily Revenue Summary — F&B / Restaurant',
        sheetColor:  AMBER,
        lightColor:  AMB_LT,
        dataRows:    fbDataRows,
        totalAmount: totalFB,
        totalLabel:  'TOTAL F&B REVENUE',
      })

      // ── Sheet 4: Extra Revenue ─────────────────────────────────────────────
      const extraDataRows = (extraData || []).map(item => {
        const g = item.guests || {}
        return {
          room:     (g.room_numbers || []).join(', '),
          desc:     `${item.item_name || '—'} (${item.category || ''})`,
          checkIn:  `${g.date_of_arrival || ''}  ${g.time_of_arrival || ''}`.trim(),
          checkOut: `${g.date_of_departure || ''}  ${g.time_of_departure || ''}`.trim(),
          amount:   parseFloat(item.total_price || 0),
        }
      })

      const wsExtra = buildDataSheet({
        title:       'Daily Revenue Summary — Extra / Other',
        sheetColor:  GREEN,
        lightColor:  GRN_LT,
        dataRows:    extraDataRows,
        totalAmount: totalExtra,
        totalLabel:  'TOTAL EXTRA REVENUE',
      })

      // ── Assemble workbook ─────────────────────────────────────────────────
      const wb = XLSX.utils.book_new()
      wb.Props = {
        Title: 'Crystal Sands Sales Report',
        Subject: 'Revenue Export',
        Author: 'Crystal Sands HMS',
        CreatedDate: new Date(),
      }
      XLSX.utils.book_append_sheet(wb, wsCover, '📊 Summary')
      XLSX.utils.book_append_sheet(wb, wsRooms, '🏨 Room Revenue')
      XLSX.utils.book_append_sheet(wb, wsFB,    '☕ F&B Revenue')
      XLSX.utils.book_append_sheet(wb, wsExtra, '🛍️ Extra Revenue')

      XLSX.writeFile(wb, `CrystalSands_Sales_${from}_to_${to}.xlsx`)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export data. Please try again.')
    } finally {
      setLoading(false)
    }
  }


  const maxBreakdown = Math.max(...revenueByCategory.map(c => c.value), 1)
  const categoryColors = [
    'bg-primary-500', 'bg-cyan-500', 'bg-amber-500', 'bg-green-500',
    'bg-purple-500', 'bg-rose-500', 'bg-indigo-500', 'bg-orange-500'
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center space-x-3">
            <TrendingUp size={32} className="text-primary-400" />
            <span>Sales Overview</span>
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1">Hotel revenue and sales analytics</p>
        </div>

        {/* Period Selector */}
        <div className="relative">
          <button
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-gray-300 hover:border-primary-400 transition-colors shadow-sm"
          >
            <Calendar size={16} className="text-primary-400" />
            <span className="font-medium">{PERIOD_OPTIONS.find(p => p.value === period)?.label}</span>
            <ChevronDown size={16} />
          </button>
          {showPeriodDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setPeriod(opt.value); setShowPeriodDropdown(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    period === opt.value
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={exportSalesData}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors shadow-sm"
        >
          <TrendingUp size={16} />
          <span className="font-medium">Export</span>
        </button>
      </div>

      {/* Custom Range Picker */}
      {period === 'custom' && (
        <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <Filter size={18} className="text-primary-400 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Custom Filter</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
            <div className="flex-1 sm:flex-none">
              <label className="label">From</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="input-field" />
            </div>
            <div className="flex-1 sm:flex-none">
              <label className="label">To</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="input-field" />
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={40} className="animate-spin text-primary-400" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Revenue"
              value={formatCurrency(stats.totalRevenue)}
              icon={DollarSign}
              color="bg-gradient-to-br from-primary-500 to-primary-700"
              sub={`${stats.totalCheckouts} checkouts`}
            />
            <StatCard
              title="Room Revenue"
              value={formatCurrency(stats.roomRevenue)}
              icon={Bed}
              color="bg-gradient-to-br from-cyan-500 to-cyan-700"
              sub={`Avg ${formatCurrency(stats.avgRoomRate)} / stay`}
            />
            <StatCard
              title="F&B Revenue"
              value={formatCurrency(stats.fbRevenue)}
              icon={Coffee}
              color="bg-gradient-to-br from-amber-500 to-orange-600"
            />
            <StatCard
              title="Other Revenue"
              value={formatCurrency(stats.otherRevenue)}
              icon={ShoppingBag}
              color="bg-gradient-to-br from-green-500 to-emerald-600"
              sub={`${stats.totalGuests} guest visits`}
            />
          </div>

          {/* Revenue Breakdown + Top Items */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Category */}
            <div className="card p-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2 mb-5">
                <BarChart2 size={20} className="text-primary-400" />
                <span>Revenue by Category</span>
              </h2>
              {revenueByCategory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No revenue data for this period</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {revenueByCategory.map((cat, i) => (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{cat.name}</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(cat.value)}</span>
                      </div>
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${categoryColors[i % categoryColors.length]} transition-all duration-700`}
                          style={{ width: `${(cat.value / maxBreakdown) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">
                        {stats.totalRevenue > 0 ? ((cat.value / stats.totalRevenue) * 100).toFixed(1) : 0}% of total
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Selling F&B Items */}
            <div className="card p-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2 mb-5">
                <Coffee size={20} className="text-amber-400" />
                <span>Top Selling Items</span>
              </h2>
              {topItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Coffee size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No F&B data for this period</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topItems.map((item, i) => (
                    <div key={item.name} className="flex items-center space-x-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                        i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-600' : 'bg-slate-600 dark:bg-slate-700'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.name}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">{item.qty} orders</p>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(item.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Transactions</h2>
            </div>
            <div className="overflow-x-auto">
              {recentTransactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No transactions for this period</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left py-3 px-6 text-slate-500 dark:text-gray-400 font-medium text-sm">Description</th>
                      <th className="text-left py-3 px-6 text-slate-500 dark:text-gray-400 font-medium text-sm">Type</th>
                      <th className="text-left py-3 px-6 text-slate-500 dark:text-gray-400 font-medium text-sm">Date</th>
                      <th className="text-right py-3 px-6 text-slate-500 dark:text-gray-400 font-medium text-sm">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((txn, i) => (
                      <tr key={i} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-6 text-slate-900 dark:text-white font-medium">{txn.name}</td>
                        <td className="py-3 px-6">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            txn.type === 'room'
                              ? 'bg-cyan-500/20 text-cyan-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {txn.label}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-slate-500 dark:text-gray-400 text-sm">
                          {txn.date ? format(parseISO(txn.date), 'MMM dd, yyyy') : '—'}
                        </td>
                        <td className="py-3 px-6 text-right font-bold text-slate-900 dark:text-white">
                          {formatCurrency(txn.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
