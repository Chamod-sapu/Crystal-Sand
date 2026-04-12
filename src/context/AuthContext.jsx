import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [isSystemActive, setIsSystemActive] = useState(true)
  const [loading, setLoading] = useState(true)
  const isLoginInProgress = useRef(false)

  useEffect(() => {
    let isMounted = true

    // Step 1: Initialize auth from existing session (runs OUTSIDE onAuthStateChange to avoid deadlock)
    async function initializeAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user && isMounted) {
          setUser(session.user)
          // These DB queries run outside onAuthStateChange, so no deadlock
          await loadUserProfile(session.user.id)
          await loadSystemSettings()
        }
      } catch (error) {
        console.error('Auth: Init error:', error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    // Step 2: Listen for future auth changes (ONLY handle sign-out and token refresh here)
    // IMPORTANT: Do NOT make Supabase DB queries inside this callback — it causes deadlock
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (isLoginInProgress.current) return // login() handles its own flow

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setUserProfile(null)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
        }
        // INITIAL_SESSION and SIGNED_IN are handled by initializeAuth() and login() respectively
      }
    )

    initializeAuth()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function loadUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('system_users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Auth: Profile load error:', error.message)
        setUserProfile(null)
        return null
      }
      setUserProfile(data)
      return data
    } catch (error) {
      console.error('Auth: Profile load exception:', error)
      setUserProfile(null)
      return null
    }
  }

  async function loadSystemSettings() {
    try {
      const { data, error } = await supabase
        .from('system_activation')
        .select('*')
        .eq('id', 1)
        .single()

      if (error) {
        console.warn('Auth: System activation table error:', error.message)
        setIsSystemActive(true)
        return
      }
      setIsSystemActive(data?.is_system_active ?? true)
    } catch (error) {
      console.error('Auth: System settings exception:', error)
      setIsSystemActive(true)
    }
  }

  async function login(email, password) {
    isLoginInProgress.current = true

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      // Fetch profile from system_users
      const { data: profile, error: profileError } = await supabase
        .from('system_users')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileError || !profile) {
        await supabase.auth.signOut()
        throw new Error('User account not found in system. Please add the user to the system_users table.')
      }

      if (!profile.is_active) {
        await supabase.auth.signOut()
        throw new Error('Your account has been deactivated. Contact your administrator.')
      }

      // Check system status
      const { data: settings, error: settingsError } = await supabase
        .from('system_activation')
        .select('is_system_active')
        .eq('id', 1)
        .single()

      if (settingsError) {
        console.warn('Auth: Could not check system status:', settingsError.message)
      }

      if (settings && !settings.is_system_active && profile.role !== 'super_admin') {
        await supabase.auth.signOut()
        throw new Error('System is currently deactivated. Please contact the Super Admin.')
      }

      // Set all state together
      setUser(data.user)
      setUserProfile(profile)
      setIsSystemActive(settings?.is_system_active ?? true)

      return { user: data.user, profile }
    } catch (err) {
      throw err
    } finally {
      isLoginInProgress.current = false
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
    setUserProfile(null)
  }

  async function refreshSystemSettings() {
    await loadSystemSettings()
  }

  async function refreshUserProfile() {
    if (user) {
      await loadUserProfile(user.id)
    }
  }

  // Role check helpers
  const isSuperAdmin = () => userProfile?.role === 'super_admin'
  const isAdmin = () => userProfile?.role === 'admin'
  const isUser = () => userProfile?.role === 'user'
  const canManageUsers = () => isSuperAdmin() || isAdmin()
  const canManageSystem = () => isSuperAdmin()
  const canManageRooms = () => isSuperAdmin() || isAdmin()
  const canManageFBItems = () => isSuperAdmin() || isAdmin()

  const value = {
    user,
    userProfile,
    isSystemActive,
    loading,
    login,
    logout,
    isSuperAdmin,
    isAdmin,
    isUser,
    canManageUsers,
    canManageSystem,
    canManageRooms,
    canManageFBItems,
    refreshSystemSettings,
    refreshUserProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
