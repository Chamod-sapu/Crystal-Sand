import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  FileText,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'

export default function Layout({ children }) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Guests', href: '/guests', icon: Users },
    { name: 'New Guest', href: '/guests/new', icon: FileText },
  ]

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true
    if (path !== '/' && location.pathname.startsWith(path)) return true
    return false
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-dark-900 border-b border-dark-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">CS</span>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
            Crystal Sand
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed top-0 left-0 z-40 w-64 h-screen transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 bg-dark-900 border-r border-dark-800`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center space-x-3 px-6 py-6 border-b border-dark-800">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">CS</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                Crystal Sand
              </h1>
              <p className="text-xs text-gray-500">Hotel Management</p>
            </div>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto scrollbar-thin">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                      : 'text-gray-400 hover:bg-dark-800 hover:text-gray-200'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          <div className="px-6 py-4 border-t border-dark-800">
            <div className="text-xs text-gray-500">
              <p className="font-medium text-gray-400 mb-1">Crystal Sand Hotel</p>
              <p>Coastal Road, Bentota</p>
              <p>+94 34 227 5073</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
