// src/app/login/kds/page.tsx
'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

function KdsLoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const reason       = searchParams.get('reason')
  const { login, handleNewPassword, loading, error } = useAuth()

  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [session,     setSession]     = useState('')
  const [step,        setStep]        = useState<'login' | 'new_password'>('login')
  const [localError,  setLocalError]  = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const result = await login(email, password)
    if (result.success) {
      router.push('/kds')
    } else if (result.challenge === 'NEW_PASSWORD_REQUIRED') {
      setSession(result.session ?? '')
      setStep('new_password')
    }
  }

  async function handleNewPass(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPass) { setLocalError('Passwords do not match'); return }
    const result = await handleNewPassword(email, newPassword, session)
    if (result.success) router.push('/kds')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="text-4xl mb-3">👨‍🍳</div>
          <h1 className="text-2xl font-bold text-white">Kitchen Display</h1>
          <p className="text-gray-400 text-sm mt-1">MenuLay KDS</p>
        </div>

        {reason === 'expired' && (
          <div className="mb-4 p-3 bg-yellow-900/40 border border-yellow-700 rounded-lg text-yellow-300 text-sm">
            Session expired. Please login again.
          </div>
        )}
        {(error || localError) && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            {error || localError}
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          {step === 'login' ? (
            <>
              <h2 className="text-lg font-semibold text-white mb-6">Sign in</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    placeholder="kitchen@restaurant.com" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
                    placeholder="••••••••" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition">
                  {loading ? 'Signing in...' : 'Enter Kitchen'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white mb-2">Set New Password</h2>
              <p className="text-gray-400 text-sm mb-6">First login — set a permanent password.</p>
              <form onSubmit={handleNewPass} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">New Password</label>
                  <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
                  <input type="password" required value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition">
                  {loading ? 'Setting...' : 'Set Password & Enter'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function KdsLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">👨‍🍳</div>
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    }>
      <KdsLoginContent />
    </Suspense>
  )
}