'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

interface OrgInfo {
  name:         string
  primaryColor: string
  logoUrl:      string | null
  supportEmail: string | null
}

type View = 'login' | 'forgot' | 'forgot_sent'

export default function LoginPage() {
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [view,      setView]      = useState<View>('login')
  const [orgInfo,   setOrgInfo]   = useState<OrgInfo | null>(null)
  const [orgSlug,   setOrgSlug]   = useState<string | null>(null)

  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  // ── Cargar info de la org si viene ?org=slug ──────────────────
  useEffect(() => {
    const slug = searchParams.get('org')
    if (!slug) return
    setOrgSlug(slug)

    fetch(`/api/org?slug=${encodeURIComponent(slug)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setOrgInfo(data)
      })
      .catch(() => {})
  }, [searchParams])

  const brandColor   = orgInfo?.primaryColor ?? '#642f8d'
  const supportEmail = orgInfo?.supportEmail ?? 'soporte@ongest.app'

  // ── Login ─────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos. Verificá tus datos o contactá al director de tu instituto.')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  // ── Recuperar contraseña ──────────────────────────────────────
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError('Ingresá tu email primero.'); return }
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (error) {
      setError('No se pudo enviar el email. Verificá la dirección ingresada.')
    } else {
      setView('forgot_sent')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">

      {/* Gradiente sutil de fondo */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% -10%, ${brandColor}10 0%, transparent 70%)`,
        }}
      />

      <div className="relative w-full max-w-[380px]">

        {/* ── Header marca ── */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: brandColor }}
          >
            <svg viewBox="0 0 28 28" fill="none" className="h-7 w-7" stroke="white" strokeWidth={1.6}>
              <path d="M14 3L4 8.5l10 5.5 10-5.5L14 3z"/>
              <path d="M4 19l10 5.5 10-5.5"/>
              <path d="M4 13.5l10 5.5 10-5.5"/>
            </svg>
          </div>

          {/* Nombre producto */}
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: brandColor }}>
            OnGest
          </p>
          <h1 className="text-xl font-semibold text-gray-900">Plataforma de Evaluaciones</h1>

          {/* Pill nombre de la institución */}
          {orgInfo?.name && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: brandColor }} />
              <span className="text-xs text-gray-500 font-medium">{orgInfo.name}</span>
            </div>
          )}
        </div>

        {/* ── Vista: Login ── */}
        {view === 'login' && (
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
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Contraseña</label>
                  <button
                    type="button"
                    onClick={() => { setView('forgot'); setError(null) }}
                    className="text-xs hover:underline"
                    style={{ color: brandColor }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
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
                style={{ backgroundColor: brandColor, borderColor: brandColor }}
              >
                {loading
                  ? <><svg viewBox="0 0 20 20" className="h-4 w-4 spin" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="10" cy="10" r="8" strokeOpacity={.2}/><path d="M10 2a8 8 0 0 1 8 8"/></svg>Ingresando…</>
                  : 'Ingresar'
                }
              </button>
            </form>
          </div>
        )}

        {/* ── Vista: Recuperar contraseña ── */}
        {view === 'forgot' && (
          <div className="card shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Recuperar contraseña</h2>
              <p className="text-xs text-gray-500 mt-1">
                Ingresá tu email y te enviamos un link para resetear tu contraseña.
              </p>
            </div>

            <form onSubmit={handleForgot} className="space-y-4">
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

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-brand w-full justify-center py-2.5"
                style={{ backgroundColor: brandColor, borderColor: brandColor }}
              >
                {loading ? 'Enviando…' : 'Enviar link de recuperación'}
              </button>

              <button
                type="button"
                onClick={() => { setView('login'); setError(null) }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 text-center py-1"
              >
                ← Volver al login
              </button>
            </form>
          </div>
        )}

        {/* ── Vista: Email enviado ── */}
        {view === 'forgot_sent' && (
          <div className="card shadow-sm text-center py-6">
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: '#f0fdf4' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.5} className="h-6 w-6">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">¡Email enviado!</p>
            <p className="text-xs text-gray-500 leading-relaxed mb-5">
              Revisá tu bandeja de entrada en <strong>{email}</strong> y seguí el link para crear una nueva contraseña.
            </p>
            <button
              onClick={() => { setView('login'); setError(null) }}
              className="text-sm hover:underline"
              style={{ color: brandColor }}
            >
              ← Volver al login
            </button>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="mt-6 text-center space-y-3">
          <p className="text-xs text-gray-400">
            ¿Problemas para acceder?{' '}
            <a href={`mailto:${supportEmail}`} style={{ color: brandColor }}>
              Contactar soporte
            </a>
          </p>
          <p className="text-xs text-gray-300">
            Powered by{' '}
            <span className="font-medium" style={{ color: brandColor }}>OnGest</span>
          </p>
        </div>

      </div>
    </div>
  )
}
