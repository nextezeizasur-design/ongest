'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos.')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(100,47,141,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-[380px] animate-fade-up">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm"
            style={{ background: 'linear-gradient(135deg, #642f8d 0%, #4e2470 100%)' }}
          >
            <svg viewBox="0 0 28 28" fill="none" className="h-7 w-7" stroke="white" strokeWidth={1.6}>
              <path d="M14 3L4 8.5l10 5.5 10-5.5L14 3z"/>
              <path d="M4 19l10 5.5 10-5.5"/>
              <path d="M4 13.5l10 5.5 10-5.5"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Next English Institute</h1>
          <p className="mt-1 text-sm text-gray-500">Plataforma de Evaluaciones</p>
        </div>

        <div className="card shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="input"
              />
            </div>

            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-brand w-full justify-center py-2.5"
            >
              {loading
                ? <><svg viewBox="0 0 20 20" className="h-4 w-4 spin" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="10" cy="10" r="8" strokeOpacity={.2}/><path d="M10 2a8 8 0 0 1 8 8"/></svg>Ingresando…</>
                : 'Ingresar'
              }
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          ¿Problemas para acceder?{' '}
          <a href="mailto:nextezeizasur@gmail.com" style={{ color: '#642f8d' }}>
            Contactar soporte
          </a>
        </p>
      </div>
    </div>
  )
}
