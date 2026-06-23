// RUTA: app/join/page.tsx
'use client'

import { useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

type Step = 'code' | 'register' | 'success'

export default function JoinPage() {
  const router = useRouter()
  const isSubmitting = useRef(false)

  const [step, setStep] = useState<Step>('code')
  const [code, setCode] = useState('')
  const [courseName, setCourseName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleValidateCode() {
    if (!code.trim()) { setError('Ingresá el código de curso'); return }
    setLoading(true)
    setError('')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error: dbError } = await supabase
      .from('courses')
      .select('name, is_active')
      .eq('join_code', code.toUpperCase().trim())
      .single()

    setLoading(false)

    if (dbError || !data) { setError('Código inválido. Verificá que esté bien escrito.'); return }
    if (!data.is_active) { setError('Este curso ya no está activo. Consultá a tu instituto.'); return }

    setCourseName(data.name)
    setStep('register')
  }

  async function handleRegister() {
    if (isSubmitting.current) return
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('Completá todos los campos')
      return
    }

    isSubmitting.current = true
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase().trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al crear la cuenta')
        return
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      await supabase.auth.signInWithPassword({ email: email.trim(), password })
      setStep('success')
      setTimeout(() => router.push('/exam'), 1500)

    } finally {
      setLoading(false)
      isSubmitting.current = false
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ backgroundColor: '#642f8d' }}>
          <span className="text-white text-2xl font-bold">O</span>
        </div>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">ONGEST</p>
        <h1 className="text-xl font-bold text-gray-800 mt-1">Plataforma de Evaluaciones</h1>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

        {step === 'code' && (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800">Ingresá a tu curso</h2>
              <p className="text-sm text-gray-500 mt-1">Tu docente o secretaría te compartió un código de 6 caracteres.</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de curso</label>
              <input
                type="text"
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleValidateCode()}
                placeholder="Ej: INGB2A"
                maxLength={8}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-xl font-mono font-bold tracking-widest uppercase focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#642f8d' } as React.CSSProperties}
              />
            </div>
            {error && <p className="text-sm text-red-600 mb-4 flex items-center gap-1"><span>⚠</span> {error}</p>}
            <button
              onClick={handleValidateCode}
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#642f8d' }}
            >
              {loading ? 'Verificando...' : 'Continuar →'}
            </button>
            <p className="text-center text-sm text-gray-400 mt-6">
              ¿Ya tenés cuenta?{' '}
              <a href="/login" className="font-medium" style={{ color: '#642f8d' }}>Iniciar sesión</a>
            </p>
          </>
        )}

        {step === 'register' && (
          <>
            <div className="mb-6">
              <button onClick={() => { setStep('code'); setError('') }}
                className="text-sm text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1">
                ← Cambiar código
              </button>
              <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 mb-4">
                <span className="text-lg">📚</span>
                <div>
                  <p className="text-xs text-purple-500 font-medium">Curso encontrado</p>
                  <p className="text-sm font-bold text-purple-900">{courseName}</p>
                </div>
              </div>
              <h2 className="text-lg font-bold text-gray-800">Creá tu cuenta</h2>
              <p className="text-sm text-gray-500 mt-1">Completá tus datos para registrarte.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input type="text" value={firstName}
                    onChange={e => { setFirstName(e.target.value); setError('') }}
                    placeholder="Juan"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#642f8d' } as React.CSSProperties} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                  <input type="text" value={lastName}
                    onChange={e => { setLastName(e.target.value); setError('') }}
                    placeholder="García"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#642f8d' } as React.CSSProperties} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="tu@email.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#642f8d' } as React.CSSProperties} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleRegister()}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent pr-10"
                    style={{ '--tw-ring-color': '#642f8d' } as React.CSSProperties}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 mt-4 flex items-center gap-1"><span>⚠</span> {error}</p>}

            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-semibold text-sm mt-6 transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#642f8d' }}
            >
              {loading ? 'Creando cuenta...' : 'Registrarme'}
            </button>
          </>
        )}

        {step === 'success' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">¡Cuenta creada!</h2>
            <p className="text-sm text-gray-500 mb-2">Estás inscripto en <strong>{courseName}</strong>.</p>
            <p className="text-xs text-gray-400">Redirigiendo a tu panel...</p>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-300 mt-6">Powered by OnGest</p>
    </main>
  )
}
