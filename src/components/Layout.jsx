import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  FileText,
  Menu,
  X,
  Building2,
  TrendingUp,
  Coffee,
  Sun,
  Moon,
  Settings,
  LogOut,
  ShieldCheck,
  Shield,
  User,
  Activity,
  DollarSign
} from 'lucide-react'
import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import logo from '../Images/Untitled design (2).png'

export default function Layout({ children }) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { isDarkMode, toggleTheme } = useTheme()
  const { userProfile, isSuperAdmin, canManageUsers, canManageSystem, logout } = useAuth()

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, show: true },
    { name: 'Guests', href: '/guests', icon: Users, show: true },
    { name: 'Rooms', href: '/rooms', icon: Building2, show: true },
    { name: 'F & B', href: '/food-beverage', icon: Coffee, show: true },
    { name: 'Forecast', href: '/forecast', icon: TrendingUp, show: true },
    { name: 'Sales', href: '/sales', icon: DollarSign, show: canManageUsers() },
    { name: 'Activity', href: '/activity', icon: Activity, show: canManageUsers() },
    { name: 'Users', href: '/users', icon: Users, show: canManageUsers() },
    { name: 'System', href: '/system-settings', icon: Settings, show: canManageSystem() },
  ]

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true
    if (path !== '/' && location.pathname.startsWith(path)) return true
    return false
  }

  function getRoleIcon() {
    if (!userProfile) return null
    switch (userProfile.role) {
      case 'super_admin':
        return <ShieldCheck size={14} className="text-amber-400" />
      case 'admin':
        return <Shield size={14} className="text-blue-400" />
      default:
        return <User size={14} className="text-slate-400" />
    }
  }

  function getRoleLabel() {
    if (!userProfile) return ''
    switch (userProfile.role) {
      case 'super_admin': return 'Super Admin'
      case 'admin': return 'Admin'
      default: return 'User'
    }
  }

  function getRoleBadgeColor() {
    if (!userProfile) return ''
    switch (userProfile.role) {
      case 'super_admin': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'admin': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  async function handleLogout() {
    await logout()
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-gray-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className={`lg:hidden fixed top-0 left-0 right-0 z-50 border-b px-4 py-3 flex items-center justify-between transition-colors ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center space-x-3">
          <img src={logo} alt="Crystal Sand Logo" className="w-36 dark:invert-0" />
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-gray-400"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-gray-400"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed top-0 left-0 z-40 w-64 h-screen transition-all ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 border-r ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center space-x-3 px-1 py-1 border-b border-slate-200 dark:border-slate-800">
            <img src={logo} alt="Crystal Sand Logo" className="w-44" />
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto scrollbar-thin">
            {navigation.filter(item => item.show).map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                      : 'text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Theme Toggle */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={toggleTheme}
              className={`w-full flex items-center justify-between px-4 py-2 rounded-lg transition-colors ${
                isDarkMode ? 'bg-slate-800 text-gray-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                <span className="font-medium">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </div>
            </button>
          </div>

          {/* User Profile & Logout */}
          <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800">
            {userProfile && (
              <div className="mb-3">
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    userProfile.role === 'super_admin' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                    userProfile.role === 'admin' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                    'bg-gradient-to-br from-slate-500 to-slate-600'
                  }`}>
                    {userProfile.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {userProfile.full_name}
                    </p>
                    <div className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getRoleBadgeColor()}`}>
                      {getRoleIcon()}
                      <span>{getRoleLabel()}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm font-medium"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-gray-500">
              <p className="font-medium text-slate-700 dark:text-gray-400 mb-1">Crystal Sand Hotel</p>
              <p>No 26/8 ,De Seram Road , Mt.Lavinia</p>
              <p>+9477 880 8099</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6 lg:p-8 transition-opacity duration-300">
          {children}
        </div>
      </main>
    </div>
  )
}
