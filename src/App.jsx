import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import GuestList from './pages/GuestList'
import NewGuest from './pages/NewGuest'
import GuestDetails from './pages/GuestDetails'
import Rooms from './pages/Rooms'
import ReservationForecast from './pages/ReservationForecast'
import FoodBeverage from './pages/FoodBeverage'
import Login from './pages/Login'
import UserManagement from './pages/UserManagement'
import SystemSettings from './pages/SystemSettings'
import Sales from './pages/Sales'
import UserActivity from './pages/UserActivity'
import Pool from './pages/Pool'
import OtherItems from './pages/OtherItems'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PowerOff } from 'lucide-react'

function SystemDeactivatedScreen() {
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/20 rounded-full mb-6">
          <PowerOff size={40} className="text-red-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">System Deactivated</h1>
        <p className="text-gray-400 mb-8">
          The system has been temporarily deactivated by the Super Admin. 
          Please contact your administrator for assistance.
        </p>
        <button
          onClick={logout}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg transition-colors font-medium"
        >
          Back to Login
        </button>
      </div>
    </div>
  )
}

function ProtectedRoute({ children, requireRole }) {
  const { user, userProfile, loading, isSystemActive, isSuperAdmin, canManageUsers, canManageSystem } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user || !userProfile) {
    return <Navigate to="/login" replace />
  }

  // System deactivated check (Super Admin bypasses)
  if (!isSystemActive && !isSuperAdmin()) {
    return <SystemDeactivatedScreen />
  }

  // Role-based access checks
  if (requireRole === 'manage_users' && !canManageUsers()) {
    return <Navigate to="/" replace />
  }

  if (requireRole === 'manage_system' && !canManageSystem()) {
    return <Navigate to="/" replace />
  }

  return children
}

function AppRoutes() {
  const { user, userProfile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user || !userProfile) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout><Dashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/guests"
        element={
          <ProtectedRoute>
            <Layout><GuestList /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/guests/new"
        element={
          <ProtectedRoute>
            <Layout><NewGuest /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/guests/:id"
        element={
          <ProtectedRoute>
            <Layout><GuestDetails /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rooms"
        element={
          <ProtectedRoute>
            <Layout><Rooms /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/forecast"
        element={
          <ProtectedRoute>
            <Layout><ReservationForecast /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/food-beverage"
        element={
          <ProtectedRoute>
            <Layout><FoodBeverage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute requireRole="manage_users">
            <Layout><UserManagement /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pool"
        element={
          <ProtectedRoute>
            <Layout><Pool /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/other-items"
        element={
          <ProtectedRoute>
            <Layout><OtherItems /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales"
        element={
          <ProtectedRoute requireRole="manage_users">
            <Layout><Sales /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/activity"
        element={
          <ProtectedRoute requireRole="manage_users">
            <Layout><UserActivity /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/system-settings"
        element={
          <ProtectedRoute requireRole="manage_system">
            <Layout><SystemSettings /></Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App