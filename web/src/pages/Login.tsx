import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../services/auth'
import { Wrench, Cog, Hammer } from 'lucide-react'

// BuildMaster Logo Component
const BuildMasterLogo = () => (
  <div className="relative w-24 h-24 mx-auto mb-4">
    {/* Outer ring */}
    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 animate-pulse" style={{ animationDuration: '3s' }} />
    {/* Inner dark circle */}
    <div className="absolute inset-1 rounded-full bg-slate-900 flex items-center justify-center">
      {/* Icon stack */}
      <div className="relative">
        <Cog className="absolute -top-2 -left-2 text-amber-400 opacity-60" size={24} />
        <Wrench className="text-amber-400" size={40} />
        <Hammer className="absolute -bottom-1 -right-2 text-orange-400 opacity-80" size={20} />
      </div>
    </div>
    {/* Glow effect */}
    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500/20 to-rose-500/20 blur-xl" />
  </div>
)

export default function Login() {
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const result = await authService.requestOTP(email)
      if (result.success) {
        setMessage('OTP sent to your email. Please check your inbox.')
        setStep('otp')
      } else {
        setError(result.message || 'Failed to send OTP')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await authService.verifyOTP(email, otpCode)
      if (result.success && result.session_token) {
        navigate('/')
      } else {
        setError('Invalid OTP')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <BuildMasterLogo />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent mb-2">
            BuildMaster
          </h1>
          <p className="text-slate-400">Deployment System</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleRequestOTP} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                placeholder="johaswe@gmail.com"
              />
            </div>

            {error && (
              <div className="bg-rose-500/20 border border-rose-500/50 rounded-xl p-4 text-rose-200 text-sm">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 text-green-200 text-sm">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-slate-300 mb-2">
                Enter OTP Code
              </label>
              <input
                id="otp"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
                placeholder="000000"
              />
              <p className="mt-2 text-sm text-slate-400">
                Check your email for the 6-digit code
              </p>
            </div>

            {error && (
              <div className="bg-rose-500/20 border border-rose-500/50 rounded-xl p-4 text-rose-200 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setOtpCode('')
                  setError('')
                }}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="flex-1 py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

