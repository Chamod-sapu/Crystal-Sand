import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  FileText,
  Menu,
  X,
  Building2,
  TrendingUp
} from 'lucide-react'
import { useState } from 'react'
import logo from '../Images/Untitled design (2).png'

export default function Layout({ children }) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Guests', href: '/guests', icon: Users },
    { name: 'New Guest', href: '/guests/new', icon: FileText },
    { name: 'Rooms', href: '/rooms', icon: Building2 },
    { name: 'Forecast', href: '/forecast', icon: TrendingUp },
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
          <img src={logo} alt="Crystal Sand Logo" className="w-36" />
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
          <div className="flex items-center space-x-3 px-1 py-1 border-b border-dark-800" >
              <img src={logo} alt="Crystal Sand Logo" className="w-44"/>
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
              <p>Sea Sound pvt ltd , No 26/8 ,De Seram Road , Mt.Lavinia</p>
              <p>+9477 880 8099</p>
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
