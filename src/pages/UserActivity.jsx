import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Activity,
  Search,
  Filter,
  ShieldCheck,
  Shield,
  User,
  LogIn,
  LogOut,
  Plus,
  Edit2,
  Trash2,
  Eye,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  RefreshCw,
  X
} from 'lucide-react'
import { format, parseISO, subDays } from 'date-fns'

const PAGE_SIZE = 20

const ACTION_META = {
  create: { label: 'Created', icon: Plus, color: 'bg-green-500/20 text-green-400' },
  update: { label: 'Updated', icon: Edit2, color: 'bg-blue-500/20 text-blue-400' },
  delete: { label: 'Deleted', icon: Trash2, color: 'bg-red-500/20 text-red-400' },
  login:  { label: 'Login',   icon: LogIn, color: 'bg-primary-500/20 text-primary-400' },
  logout: { label: 'Logout',  icon: LogOut, color: 'bg-slate-500/20 text-slate-400' },
  view:   { label: 'Viewed',  icon: Eye, color: 'bg-cyan-500/20 text-cyan-400' },
  generate: { label: 'Generated', icon: FileText, color: 'bg-amber-500/20 text-amber-400' },
  system: { label: 'System',  icon: Settings, color: 'bg-purple-500/20 text-purple-400' },
}

const ENTITY_LABELS = {
  guest: 'Guest',
  room: 'Room',
  booking: 'Booking',
  fb_item: 'F&B Item',
  user: 'User',
  system: 'System',
  bill: 'Bill',
}

export default function UserActivity() {
  const { userProfile, isAdmin, isSuperAdmin } = useAuth()
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterAction, setFilterAction] = useState('all')
  const [filterEntity, setFilterEntity] = useState('all')
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadLogs()
  }, [page, searchTerm, filterRole, filterAction, filterEntity, dateFrom, dateTo])

  async function loadLogs() {
    setLoading(true)
    try {
      let query = supabase
        .from('user_activity_log')
        .select('*', { count: 'exact' })
        .gte('created_at', dateFrom + 'T00:00:00')
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (isAdmin()) {
        query = query.neq('user_role', 'super_admin')
      }

      if (filterRole !== 'all') query = query.eq('user_role', filterRole)
      if (filterAction !== 'all') query = query.eq('action', filterAction)
      if (filterEntity !== 'all') query = query.eq('entity_type', filterEntity)
      if (searchTerm.trim()) {
        query = query.or(`user_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      }

      const { data, count, error } = await query
      if (error) throw error

      setLogs(data || [])
      setTotal(count || 0)
    } catch (error) {
      console.error('Error loading activity logs:', error)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  function getRoleBadge(role) {
    switch (role) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
            <ShieldCheck size={10} />
            <span>Super Admin</span>
          </span>
        )
      case 'admin':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
            <Shield size={10} />
            <span>Admin</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-500/20 text-slate-400 rounded-full text-xs font-medium">
            <User size={10} />
            <span>User</span>
          </span>
        )
    }
  }

  function getActionBadge(action) {
    const meta = ACTION_META[action] || { label: action, icon: Activity, color: 'bg-slate-500/20 text-slate-400' }
    const Icon = meta.icon
    return (
      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${meta.color}`}>
        <Icon size={11} />
        <span>{meta.label}</span>
      </span>
    )
  }

  function getEntityBadge(entity) {
    return (
      <span className="text-xs text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
        {ENTITY_LABELS[entity] || entity}
      </span>
    )
  }

  function getUserAvatar(name, role) {
    const colors = {
      super_admin: 'from-amber-500 to-orange-600',
      admin: 'from-blue-500 to-indigo-600',
      user: 'from-slate-500 to-slate-600'
    }
    return (
      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colors[role] || colors.user} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
        {name?.charAt(0)?.toUpperCase() || '?'}
      </div>
    )
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasActiveFilters = filterRole !== 'all' || filterAction !== 'all' || filterEntity !== 'all'

  function clearFilters() {
    setFilterRole('all')
    setFilterAction('all')
    setFilterEntity('all')
    setPage(0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center space-x-3">
            <Activity size={32} className="text-primary-400" />
            <span>User Activity</span>
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1">
            Track all system actions performed by users
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadLogs}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-gray-400 hover:border-primary-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg border transition-colors ${
              hasActiveFilters
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-gray-300 hover:border-primary-400'
            }`}
          >
            <Filter size={16} />
            <span>Filters {hasActiveFilters && '•'}</span>
          </button>
        </div>
      </div>

      {/* Search + Date Range */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search by user name or activity description..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(0) }}
              className="input-field pl-10"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Calendar size={18} className="text-primary-400 flex-shrink-0" />
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }} className="input-field w-auto" />
            <span className="text-slate-500 dark:text-gray-400 text-sm">to</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }} className="input-field w-auto" />
          </div>
        </div>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="label">Role</label>
              <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(0) }} className="input-field w-auto">
                <option value="all">All Roles</option>
                {isSuperAdmin() && <option value="super_admin">Super Admin</option>}
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>
            <div>
              <label className="label">Action</label>
              <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0) }} className="input-field w-auto">
                <option value="all">All Actions</option>
                {Object.entries(ACTION_META).map(([val, meta]) => (
                  <option key={val} value={val}>{meta.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Entity</label>
              <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(0) }} className="input-field w-auto">
                <option value="all">All Entities</option>
                {Object.entries(ENTITY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center space-x-1 text-sm text-red-400 hover:text-red-300 transition-colors mt-5">
                <X size={14} />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(ACTION_META).slice(0, 4).map(([action, meta]) => {
          const Icon = meta.icon
          const count = logs.filter(l => l.action === action).length
          return (
            <div key={action} className="card p-4 flex items-center space-x-3">
              <div className={`p-2.5 rounded-lg ${meta.color.replace('text-', 'bg-').split(' ')[0]}`}>
                <Icon size={18} className={meta.color.split(' ')[1]} />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-gray-400">{meta.label}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{count}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Activity Log Table */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 dark:text-white">
            Activity Log
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-gray-400">
              ({total} {total === 1 ? 'entry' : 'entries'})
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={32} className="animate-spin text-primary-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Activity size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-medium">No activity logs found</p>
            <p className="text-sm mt-1">Activity will appear here once users start performing actions</p>
            <p className="text-xs mt-3 text-slate-400 dark:text-gray-600">
              Make sure you have run the activity log migration SQL in your Supabase dashboard.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {logs.map(log => (
              <div key={log.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <div className="flex items-start space-x-4">
                  {getUserAvatar(log.user_name, log.user_role)}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">{log.user_name}</span>
                      {getRoleBadge(log.user_role)}
                      {getActionBadge(log.action)}
                      {getEntityBadge(log.entity_type)}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-gray-300">{log.description}</p>
                    {log.entity_id && (
                      <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">ID: {log.entity_id}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-500 dark:text-gray-400 whitespace-nowrap">
                      {log.created_at ? format(parseISO(log.created_at), 'MMM dd, yyyy') : ''}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-gray-500 whitespace-nowrap">
                      {log.created_at ? format(parseISO(log.created_at), 'HH:mm:ss') : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:border-primary-400 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-slate-700 dark:text-gray-300 px-2">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:border-primary-400 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
