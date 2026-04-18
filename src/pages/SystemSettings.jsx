import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logActivity } from '../lib/activityLogger'
import {
  Settings,
  Power,
  PowerOff,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Clock,
  User
} from 'lucide-react'
import { format } from 'date-fns'

export default function SystemSettings() {
  const { userProfile, refreshSystemSettings } = useAuth()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [notification, setNotification] = useState(null)
  const [deactivatedByUser, setDeactivatedByUser] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  function showNotif(message, type = 'success') {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }

  async function loadSettings() {
    try {
      const { data, error } = await supabase
        .from('system_activation')
        .select('*')
        .eq('id', 1)
        .single()

      if (error) throw error
      setSettings(data)

      // Load deactivated by user info
      if (data?.deactivated_by) {
        const { data: userData } = await supabase
          .from('system_users')
          .select('full_name, email')
          .eq('id', data.deactivated_by)
          .single()

        setDeactivatedByUser(userData)
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading settings:', error)
      setLoading(false)
    }
  }

  async function handleToggleSystem() {
    setToggling(true)

    try {
      const newStatus = !settings.is_system_active

      const updateData = {
        is_system_active: newStatus
      }

      if (!newStatus) {
        // Deactivating
        updateData.deactivated_by = userProfile.id
        updateData.deactivated_at = new Date().toISOString()
      } else {
        // Activating
        updateData.deactivated_by = null
        updateData.deactivated_at = null
      }

      const { error } = await supabase
        .from('system_activation')
        .update(updateData)
        .eq('id', 1)

      if (error) throw error

      // Log activity
      await logActivity(
        userProfile,
        'update',
        'system',
        `${newStatus ? 'Activated' : 'Deactivated'} the hotel management system`,
        '1'
      )

      showNotif(
        newStatus
          ? 'System activated successfully! All users can now access the system.'
          : 'System deactivated. Admin and User accounts can no longer access the system.'
      )

      await loadSettings()
      await refreshSystemSettings()
      setShowConfirm(false)
    } catch (error) {
      console.error('Error toggling system:', error)
      showNotif('Failed to update system status', 'error')
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

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
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center space-x-3">
          <Settings size={32} className="text-primary-400" />
          <span>System Settings</span>
        </h1>
        <p className="text-slate-500 dark:text-gray-400 mt-1">
          Manage system-wide configuration and access control
        </p>
      </div>

      {/* System Status Card */}
      <div className="card overflow-hidden">
        <div className={`p-1 ${settings?.is_system_active ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-rose-500'}`} />
        
        <div className="p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-5">
              <div className={`p-4 rounded-2xl ${
                settings?.is_system_active 
                  ? 'bg-green-500/20' 
                  : 'bg-red-500/20'
              }`}>
                {settings?.is_system_active ? (
                  <Power size={36} className="text-green-400" />
                ) : (
                  <PowerOff size={36} className="text-red-400" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  System Status
                </h2>
                <div className={`inline-flex items-center space-x-2 mt-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  settings?.is_system_active
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    settings?.is_system_active ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                  }`} />
                  <span>{settings?.is_system_active ? 'Active' : 'Deactivated'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowConfirm(true)}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg active:scale-95 ${
                settings?.is_system_active
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/30'
              }`}
            >
              {settings?.is_system_active ? (
                <>
                  <PowerOff size={20} />
                  <span>Deactivate System</span>
                </>
              ) : (
                <>
                  <Power size={20} />
                  <span>Activate System</span>
                </>
              )}
            </button>
          </div>

          {/* System Info */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center space-x-2 text-slate-500 dark:text-gray-400 mb-2">
                <ShieldCheck size={16} />
                <span className="text-sm">Managed By</span>
              </div>
              <p className="text-slate-900 dark:text-white font-medium">
                Super Admin Only
              </p>
            </div>

            {!settings?.is_system_active && settings?.deactivated_at && (
              <>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center space-x-2 text-slate-500 dark:text-gray-400 mb-2">
                    <Clock size={16} />
                    <span className="text-sm">Deactivated At</span>
                  </div>
                  <p className="text-red-400 font-medium">
                    {format(new Date(settings.deactivated_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center space-x-2 text-slate-500 dark:text-gray-400 mb-2">
                    <User size={16} />
                    <span className="text-sm">Deactivated By</span>
                  </div>
                  <p className="text-red-400 font-medium">
                    {deactivatedByUser?.full_name || 'Unknown'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Impact Description */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">What happens when system is deactivated?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-3">
              <ShieldCheck size={18} className="text-amber-400" />
              <h4 className="font-semibold text-amber-400">Super Admin</h4>
            </div>
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Full access maintained. Can reactivate the system at any time.
            </p>
          </div>
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-3">
              <AlertTriangle size={18} className="text-red-400" />
              <h4 className="font-semibold text-red-400">Admin</h4>
            </div>
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Completely locked out. Cannot login or access any system features.
            </p>
          </div>
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-3">
              <AlertTriangle size={18} className="text-red-400" />
              <h4 className="font-semibold text-red-400">User</h4>
            </div>
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Completely locked out. Cannot login or access any system features.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full overflow-hidden">
            <div className={`p-6 ${
              settings?.is_system_active 
                ? 'bg-red-500/10 border-b border-red-500/20' 
                : 'bg-green-500/10 border-b border-green-500/20'
            }`}>
              <div className="flex items-center space-x-3">
                {settings?.is_system_active ? (
                  <AlertTriangle size={28} className="text-red-400" />
                ) : (
                  <Power size={28} className="text-green-400" />
                )}
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {settings?.is_system_active ? 'Deactivate System?' : 'Activate System?'}
                </h2>
              </div>
            </div>

            <div className="p-6">
              <p className="text-slate-500 dark:text-gray-400">
                {settings?.is_system_active
                  ? 'This will prevent all Admin and User accounts from accessing the system. Only Super Admins will be able to login. Are you sure?'
                  : 'This will restore access for all Admin and User accounts. They will be able to login and use the system again.'}
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 px-6 pb-6">
              <button
                onClick={() => setShowConfirm(false)}
                className="btn-secondary"
                disabled={toggling}
              >
                Cancel
              </button>
              <button
                onClick={handleToggleSystem}
                disabled={toggling}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 ${
                  settings?.is_system_active
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {toggling ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    {settings?.is_system_active ? <PowerOff size={18} /> : <Power size={18} />}
                    <span>{settings?.is_system_active ? 'Deactivate' : 'Activate'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
