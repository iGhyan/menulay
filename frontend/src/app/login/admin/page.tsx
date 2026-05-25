// src/app/login/admin/page.tsx
'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

type Step = 'login' | 'new_password' | 'forgot' | 'reset_confirm' | 'register' | 'verify'

function AdminLoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const reason       = searchParams.get('reason')
  const { login, handleNewPassword, sendResetCode, resetPassword, register, verifyEmail, loading, error } = useAuth()

  const [step,        setStep]        = useState<Step>('login')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [code,        setCode]        = useState('')
  const [restaurant,  setRestaurant]  = useState('')
  const [session,     setSession]     = useState('')
  const [message,     setMessage]     = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const result = await login(email, password)
    if (result.success && result.redirect) {
      router.push(result.redirect)
    } else if (result.challenge === 'NEW_PASSWORD_REQUIRED') {
      setSession(result.session ?? '')
      setStep('new_password')
    }
  }

  async function handleNewPass(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPass) { setMessage('Passwords do not match'); return }
    const result = await handleNewPassword(email, newPassword, session)
    if (result.success && result.redirect) router.push(result.redirect)
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    const result = await sendResetCode(email)
    if (result.success) { setMessage('Check your email for a reset code'); setStep('reset_confirm') }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPass) { setMessage('Passwords do not match'); return }
    const result = await resetPassword(email, code, newPassword)
    if (result.success) { setMessage('Password reset! You can now login.'); setStep('login') }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    const result = await register(email, password, restaurant)
    if (result.success) { setMessage('Check your email for a verification code'); setStep('verify') }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const result = await verifyEmail(email, code)
    if (result.success) { setMessage('Email verified! You can now login.'); setStep('login') }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Menu<span className="text-orange-500">Lay</span>
          </h1>
          <p className="text-gray-400 mt-1 text-sm">Restaurant Management Platform</p>
        </div>

        {reason === 'expired' && (
          <div className="mb-4 p-3 bg-yellow-900/40 border border-yellow-700 rounded-lg text-yellow-300 text-sm">
            Your session expired. Please login again.
          </div>
        )}
        {reason === 'unauthorized' && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            You do not have permission to access that page.
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 bg-blue-900/40 border border-blue-700 rounded-lg text-blue-300 text-sm">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">

          {step === 'login' && (
            <>
              <h2 className="text-xl font-semibold text-white mb-6">Sign in</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition"
                    placeholder="you@restaurant.com" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition"
                    placeholder="••••••••" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition">
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
              <div className="mt-4 flex justify-between text-sm">
                <button onClick={() => setStep('forgot')} className="text-gray-400 hover:text-orange-400 transition">Forgot password?</button>
                <button onClick={() => setStep('register')} className="text-gray-400 hover:text-orange-400 transition">Register restaurant</button>
              </div>
            </>
          )}

          {step === 'new_password' && (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Set New Password</h2>
              <p className="text-gray-400 text-sm mb-6">First login — please set a permanent password.</p>
              <form onSubmit={handleNewPass} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">New Password</label>
                  <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    placeholder="Min 8 chars, uppercase, number" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
                  <input type="password" required value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    placeholder="••••••••" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition">
                  {loading ? 'Setting password...' : 'Set Password & Sign in'}
                </button>
              </form>
            </>
          )}

          {step === 'forgot' && (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Reset Password</h2>
              <p className="text-gray-400 text-sm mb-6">Enter your email to receive a reset code.</p>
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    placeholder="you@restaurant.com" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition">
                  {loading ? 'Sending...' : 'Send Reset Code'}
                </button>
              </form>
              <button onClick={() => setStep('login')} className="mt-4 text-sm text-gray-400 hover:text-orange-400 transition">← Back to login</button>
            </>
          )}

          {step === 'reset_confirm' && (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Enter Reset Code</h2>
              <p className="text-gray-400 text-sm mb-6">Check your email for the 6-digit code.</p>
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Reset Code</label>
                  <input type="text" required value={code} onChange={e => setCode(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    placeholder="123456" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">New Password</label>
                  <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    placeholder="Min 8 chars, uppercase, number" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
                  <input type="password" required value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    placeholder="••••••••" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition">
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          {step === 'register' && (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Register Restaurant</h2>
              <p className="text-gray-400 text-sm mb-6">Create your MenuLay account.</p>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Restaurant Name</label>
                  <input type="text" required value={restaurant} onChange={e => setRestaurant(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    placeholder="Burger House" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    placeholder="you@restaurant.com" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    placeholder="Min 8 chars, uppercase, number" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition">
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
              <button onClick={() => setStep('login')} className="mt-4 text-sm text-gray-400 hover:text-orange-400 transition">← Already have an account?</button>
            </>
          )}

          {step === 'verify' && (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Verify Email</h2>
              <p className="text-gray-400 text-sm mb-6">Enter the 6-digit code sent to {email}</p>
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Verification Code</label>
                  <input type="text" required value={code} onChange={e => setCode(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    placeholder="123456" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition">
                  {loading ? 'Verifying...' : 'Verify Email'}
                </button>
              </form>
            </>
          )}

        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          © {new Date().getFullYear()} MenuLay. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            Menu<span className="text-orange-500">Lay</span>
          </h1>
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mt-4" />
        </div>
      </div>
    }>
      <AdminLoginContent />
    </Suspense>
  )
}