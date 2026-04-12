import { useState } from 'react'
import { LogIn, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import logo from '../Images/Untitled design (2).png'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/5 rounded-full blur-3xl" />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        {/* Glow effect behind card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-primary-600/20 via-cyan-500/20 to-primary-600/20 rounded-2xl blur-xl opacity-70" />
        
        <div className="relative bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header with gradient accent */}
          <div className="relative px-8 pt-10 pb-8">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-600 via-cyan-500 to-primary-600" />
            
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img src={logo} alt="Crystal Sand" className="w-48" />
            </div>

            {/* Welcome Text */}
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
              <p className="text-gray-400 text-sm">Sign in to access the management system</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start space-x-3 animate-in slide-in-from-top-2 duration-300">
                <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter your email"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 pr-12"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-primary-600/20 hover:shadow-primary-600/40 active:scale-[0.98] flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="px-8 py-4 bg-slate-800/50 border-t border-slate-800">
            <p className="text-center text-xs text-gray-500">
              Crystal Sand Hotel Management System
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
