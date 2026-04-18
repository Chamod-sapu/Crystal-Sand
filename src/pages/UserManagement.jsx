import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logActivity } from '../lib/activityLogger'
import {
  Users,
  Plus,
  X,
  Trash2,
  AlertCircle,
  Search,
  Shield,
  ShieldCheck,
  User,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  UserPlus
} from 'lucide-react'

export default function UserManagement() {
  const { userProfile, isSuperAdmin, isAdmin } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddUser, setShowAddUser] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')
  const [notification, setNotification] = useState(null)
  const [createdCount, setCreatedCount] = useState(0)
  const [saving, setSaving] = useState(false)

  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'user'
  })
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    if (isAdmin() && userProfile) {
      countCreatedUsers()
    }
  }, [users, userProfile])

  function showNotif(message, type = 'success') {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }

  async function loadUsers() {
    try {
      let query = supabase
        .from('system_users')
        .select('*')
        .order('created_at', { ascending: false })

      // If admin, hide super_admin users
      if (isAdmin()) {
        query = query.neq('role', 'super_admin')
      }

      const { data, error } = await query

      if (error) throw error
      setUsers(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading users:', error)
      setLoading(false)
    }
  }

  async function countCreatedUsers() {
    if (!userProfile) return
    const count = users.filter(u => u.created_by === userProfile.id).length
    setCreatedCount(count)
  }

  async function handleAddUser(e) {
    e.preventDefault()
    setError('')

    // Validate
    if (!newUser.email.trim() || !newUser.full_name.trim() || !newUser.password.trim()) {
      setError('All fields are required')
      return
    }

    if (newUser.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    // Check admin user limit
    if (isAdmin() && createdCount >= 5) {
      setError('You have reached the maximum limit of 5 users')
      return
    }

    // Admin cannot create super_admin
    if (isAdmin() && newUser.role === 'super_admin') {
      setError('You do not have permission to create Super Admin users')
      return
    }

    setSaving(true)

    try {
      // Create user in Supabase Auth via Edge Function or Admin API
      // Since we're using client-side, we'll use the signUp method
      // Note: This creates the auth user but doesn't sign them in
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            full_name: newUser.full_name
          }
        }
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('Failed to create user account')
      }

      // Create system_users record
      const { error: profileError } = await supabase
        .from('system_users')
        .insert([{
          id: authData.user.id,
          email: newUser.email,
          full_name: newUser.full_name,
          role: newUser.role,
          created_by: userProfile.id
        }])

      if (profileError) throw profileError

      // Log activity
      await logActivity(
        userProfile,
        'create',
        'user',
        `Created new user: ${newUser.full_name} (${newUser.role})`,
        authData.user.id
      )

      showNotif(`User "${newUser.full_name}" created successfully`)
      resetForm()
      loadUsers()
    } catch (error) {
      console.error('Error creating user:', error)
      setError(error.message || 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(userId, currentStatus) {
    if (userId === userProfile.id) {
      showNotif('You cannot deactivate your own account', 'error')
      return
    }

    try {
      const { error } = await supabase
        .from('system_users')
        .update({ is_active: !currentStatus })
        .eq('id', userId)

      if (error) throw error

      // Log activity
      await logActivity(
        userProfile,
        'update',
        'user',
        `${!currentStatus ? 'Activated' : 'Deactivated'} user: ${users.find(u => u.id === userId)?.full_name}`,
        userId
      )

      showNotif(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`)
      loadUsers()
    } catch (error) {
      console.error('Error toggling user:', error)
      showNotif('Failed to update user status', 'error')
    }
  }

  async function handleDeleteUser(userId, userName) {
    if (userId === userProfile.id) {
      showNotif('You cannot delete your own account', 'error')
      return
    }

    if (!confirm(`Are you sure you want to delete "${userName}"? This action cannot be undone.`)) return

    try {
      // Delete from system_users (will cascade from auth if needed)
      const { error } = await supabase
        .from('system_users')
        .delete()
        .eq('id', userId)

      if (error) throw error

      // Log activity
      await logActivity(
        userProfile,
        'delete',
        'user',
        `Deleted user: ${userName}`,
        userId
      )

      showNotif(`User "${userName}" deleted successfully`)
      loadUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      showNotif('Failed to delete user', 'error')
    }
  }

  function resetForm() {
    setNewUser({ email: '', full_name: '', password: '', role: 'user' })
    setShowAddUser(false)
    setError('')
    setShowPassword(false)
  }

  function getRoleBadge(role) {
    switch (role) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
            <ShieldCheck size={12} />
            <span>Super Admin</span>
          </span>
        )
      case 'admin':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
            <Shield size={12} />
            <span>Admin</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-500/20 text-slate-400 rounded-full text-xs font-medium">
            <User size={12} />
            <span>User</span>
          </span>
        )
    }
  }

  const filteredUsers = users.filter(u => {
    const search = searchTerm.toLowerCase()
    return (
      u.full_name.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search) ||
      u.role.toLowerCase().includes(search)
    )
  })

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center space-x-3">
            <Users size={32} className="text-primary-400" />
            <span>User Management</span>
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1">
            Manage system users and access control
            {isAdmin() && (
              <span className="ml-2 text-primary-400 font-medium">
                ({createdCount}/5 users created)
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          disabled={isAdmin() && createdCount >= 5}
          className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UserPlus size={20} />
          <span>Add User</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 dark:text-gray-400 text-sm">Total Users</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{users.length}</p>
            </div>
            <div className="p-3 bg-primary-600/20 rounded-lg">
              <Users size={22} className="text-primary-400" />
            </div>
          </div>
        </div>
        {isSuperAdmin() && (
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 dark:text-gray-400 text-sm">Super Admins</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">
                  {users.filter(u => u.role === 'super_admin').length}
                </p>
              </div>
              <div className="p-3 bg-amber-500/20 rounded-lg">
                <ShieldCheck size={22} className="text-amber-400" />
              </div>
            </div>
          </div>
        )}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 dark:text-gray-400 text-sm">Admins</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">
                {users.filter(u => u.role === 'admin').length}
              </p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Shield size={22} className="text-blue-400" />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 dark:text-gray-400 text-sm">Active Users</p>
              <p className="text-2xl font-bold text-green-400 mt-1">
                {users.filter(u => u.is_active).length}
              </p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <CheckCircle size={22} className="text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card p-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Search users by name, email or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left py-4 px-6 text-slate-500 dark:text-gray-400 font-medium text-sm">User</th>
                <th className="text-left py-4 px-6 text-slate-500 dark:text-gray-400 font-medium text-sm">Email</th>
                <th className="text-left py-4 px-6 text-slate-500 dark:text-gray-400 font-medium text-sm">Role</th>
                <th className="text-left py-4 px-6 text-slate-500 dark:text-gray-400 font-medium text-sm">Status</th>
                <th className="text-left py-4 px-6 text-slate-500 dark:text-gray-400 font-medium text-sm">Created</th>
                <th className="text-left py-4 px-6 text-slate-500 dark:text-gray-400 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-gray-500">
                    <Users size={48} className="mx-auto mb-4 opacity-30" />
                    <p>No users found</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr
                    key={u.id}
                    className={`border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                      !u.is_active ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          u.role === 'super_admin' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                          u.role === 'admin' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                          'bg-gradient-to-br from-slate-500 to-slate-600'
                        }`}>
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-slate-900 dark:text-white font-medium">{u.full_name}</div>
                          {u.id === userProfile.id && (
                            <span className="text-xs text-primary-400">(You)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-500 dark:text-gray-400 text-sm">{u.email}</td>
                    <td className="py-4 px-6">{getRoleBadge(u.role)}</td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => handleToggleActive(u.id, u.is_active)}
                        disabled={u.id === userProfile.id}
                        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer disabled:cursor-default ${
                          u.is_active
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        }`}
                        title={u.id === userProfile.id ? 'Cannot change your own status' : `Click to ${u.is_active ? 'deactivate' : 'activate'}`}
                      >
                        {u.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        <span>{u.is_active ? 'Active' : 'Inactive'}</span>
                      </button>
                    </td>
                    <td className="py-4 px-6 text-slate-500 dark:text-gray-400 text-sm">
                      {new Date(u.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="py-4 px-6">
                      {u.id !== userProfile.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.full_name)}
                          className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                          title="Delete User"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <UserPlus size={22} className="text-primary-400" />
                  <span>Add New User</span>
                </h2>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-500 dark:text-gray-400" />
                </button>
              </div>
              {isAdmin() && (
                <p className="text-sm text-primary-400 mt-2">
                  You can create {5 - createdCount} more user(s)
                </p>
              )}
            </div>

            <form onSubmit={handleAddUser} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div>
                <label className="label">Full Name *</label>
                <input
                  type="text"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="input-field"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <label className="label">Email Address *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="input-field"
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div>
                <label className="label">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="input-field pr-12"
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Role *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="input-field"
                  required
                >
                  {isSuperAdmin() && <option value="super_admin">Super Admin</option>}
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex items-center space-x-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      <span>Create User</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
