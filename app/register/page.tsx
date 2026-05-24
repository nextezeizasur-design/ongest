'use client'

import { useState } from 'react'
import Link from 'next/link'

type Step = 'form' | 'success'

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('form')

  // Campos del formulario
  const [instituteName,      setInstituteName]      = useState('')
  const [directorFirstName,  setDirectorFirstName]  = useState('')
  const [directorLastName,   setDirectorLastName]   = useState('')
  const [directorEmail,      setDirectorEmail]      = useState('')

  // Estado
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [loginUrl, setLoginUrl] = useState('')
  const [slug,     setSlug]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institute_name:       instituteName.trim(),
          director_first_name:  directorFirstName.trim(),
          director_last_name:   directorLastName.trim(),
          director_email:       directorEmail.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Ocurrió un error. Intentá de nuevo.')
        return
      }

      setLoginUrl(data.login_url)
      setSlug(data.slug)
      setStep('success')

    } catch {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, #642f8d 0%, #4e2470 100%)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.7} className="h-5 w-5">
            <path d="M12 2L3 7l9 5 9-5-9-5z"/>
            <path d="M3 17l9 5 9-5"/>
            <path d="M3 12l9 5 9-5"/>
          </svg>
        </div>
        <span className="text-2xl font-bold text-gray-900">OnGest</span>
      </div>

      <div className="w-full max-w-md">

        {/* ── Paso 1: Formulario ── */}
        {step === 'form' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900">Registrá tu instituto</h1>
              <p className="text-sm text-gray-500 mt-1">
                Creá tu cuenta en minutos. Vas a recibir un email para activarla.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Instituto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del instituto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={instituteName}
                  onChange={e => setInstituteName(e.target.value)}
                  placeholder="ej: Next English Institute"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Separador */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs text-gray-400">Datos del director</span>
                </div>
              </div>

              {/* Nombre y apellido */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={directorFirstName}
                    onChange={e => setDirectorFirstName(e.target.value)}
                    placeholder="María"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={directorLastName}
                    onChange={e => setDirectorLastName(e.target.value)}
                    placeholder="González"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email del director <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={directorEmail}
                  onChange={e => setDirectorEmail(e.target.value)}
                  placeholder="director@miinstituto.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Recibirás un email para activar tu cuenta y elegir tu contraseña.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60"
                style={{ backgroundColor: loading ? '#9b6cbe' : '#642f8d' }}
              >
                {loading ? 'Creando instituto…' : 'Crear instituto'}
              </button>

            </form>

            <p className="text-center text-xs text-gray-400 mt-5">
              ¿Ya tenés cuenta?{' '}
              <Link href="/login" className="font-medium" style={{ color: '#642f8d' }}>
                Iniciá sesión
              </Link>
            </p>
          </div>
        )}

        {/* ── Paso 2: Éxito ── */}
        {step === 'success' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">

            {/* Check */}
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: '#f0fdf4' }}>
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">¡Instituto creado!</h2>
            <p className="text-sm text-gray-500 mb-6">
              Revisá tu bandeja de entrada. Te enviamos un email con el link para activar tu cuenta y elegir tu contraseña.
            </p>

            {/* Info de acceso */}
            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3 mb-6">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Tu URL de acceso</p>
                <p className="text-sm font-mono font-medium text-gray-900 break-all">
                  ongest.vercel.app{loginUrl}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Identificador del instituto</p>
                <p className="text-sm font-mono font-medium" style={{ color: '#642f8d' }}>
                  {slug}
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left mb-6">
              <p className="text-xs text-amber-700 leading-relaxed">
                <strong>Importante:</strong> guardá tu URL de acceso. Cada instituto tiene su propia URL con el identificador único.
              </p>
            </div>

            <a
              href={loginUrl}
              className="block w-full py-2.5 text-sm font-medium text-white rounded-lg text-center transition-colors"
              style={{ backgroundColor: '#642f8d' }}
            >
              Ir al login del instituto →
            </a>

          </div>
        )}

      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-gray-400">
        OnGest · Plataforma de evaluaciones para institutos de inglés
      </p>

    </div>
  )
}
