'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RoleName } from '@/types'

const ROLE_LABEL: Record<RoleName, string> = {
  director:    'Director',
  coordinator: 'Coordinación',
  secretary:   'Secretaría',
  teacher:     'Docente',
  student:     'Alumno',
}

interface Props {
  id:        string
  firstName: string
  lastName:  string
  email:     string
  role:      RoleName
}

type Tab = 'info' | 'password'

export default function ProfileClient({ id, firstName, lastName, email, role }: Props) {
  const supabase = createClient()

  const [tab, setTab]         = useState<Tab>('info')
  const initials              = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()

  /* ── Datos personales ── */
  const [infoForm, setInfoForm]   = useState({ first_name: firstName, last_name: lastName })
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoMsg, setInfoMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault()
    setSavingInfo(true)
    setInfoMsg(null)

    const { error } = await supabase
      .from('profiles')
      .update({ first_name: infoForm.first_name, last_name: infoForm.last_name })
      .eq('id', id)

    setSavingInfo(false)
    if (error) {
      setInfoMsg({ type: 'err', text: 'No se pudo guardar. Intentá de nuevo.' })
    } else {
      setInfoMsg({ type: 'ok', text: 'Datos actualizados correctamente.' })
      setTimeout(() => setInfoMsg(null), 3000)
    }
  }

  /* ── Cambio de contraseña ── */
  const [pwForm, setPwForm]   = useState({ current: '', next: '', confirm: '' })
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showPw, setShowPw]     = useState({ current: false, next: false, confirm: false })

  const pwStrength = (() => {
    const p = pwForm.next
    if (!p) return null
    let score = 0
    if (p.length >= 8)             score++
    if (/[A-Z]/.test(p))           score++
    if (/[0-9]/.test(p))           score++
    if (/[^A-Za-z0-9]/.test(p))    score++
    if (score <= 1) return { label: 'Débil',   color: '#ef4444', width: '25%'  }
    if (score === 2) return { label: 'Regular', color: '#f59e0b', width: '50%'  }
    if (score === 3) return { label: 'Buena',   color: '#3b82f6', width: '75%'  }
    return                { label: 'Fuerte',    color: '#22c55e', width: '100%' }
  })()

  async function handleSavePw(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)

    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ type: 'err', text: 'Las contraseñas nuevas no coinciden.' })
      return
    }
    if (pwForm.next.length < 8) {
      setPwMsg({ type: 'err', text: 'La contraseña debe tener al menos 8 caracteres.' })
      return
    }

    setSavingPw(true)

    // Supabase Auth — actualizar contraseña directamente
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })

    setSavingPw(false)
    if (error) {
      setPwMsg({ type: 'err', text: error.message ?? 'No se pudo cambiar la contraseña.' })
    } else {
      setPwMsg({ type: 'ok', text: '¡Contraseña actualizada! Ya podés usar la nueva.' })
      setPwForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwMsg(null), 4000)
    }
  }

  /* ── Render ── */
  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Header de perfil */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-5">
          <div
            className="h-16 w-16 flex-shrink-0 flex items-center justify-center rounded-2xl text-xl font-bold text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, #642f8d 0%, #4e2470 100%)' }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {firstName} {lastName}
            </h1>
            <p className="text-sm text-gray-500 truncate">{email}</p>
            <span
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ background: '#f5eefb', color: '#642f8d' }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#642f8d' }} />
              {ROLE_LABEL[role]}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1">
          {([
            { key: 'info',     label: 'Datos personales' },
            { key: 'password', label: 'Contraseña'       },
          ] as { key: Tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                tab === t.key
                  ? 'text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={tab === t.key ? { background: '#642f8d' } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Datos personales ── */}
        {tab === 'info' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Datos personales</h2>
            <form onSubmit={handleSaveInfo} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    required
                    value={infoForm.first_name}
                    onChange={e => setInfoForm(f => ({ ...f, first_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido
                  </label>
                  <input
                    type="text"
                    required
                    value={infoForm.last_name}
                    onChange={e => setInfoForm(f => ({ ...f, last_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Email — solo lectura */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                  <span className="ml-2 text-xs font-normal text-gray-400">(no editable)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>

              {infoMsg && (
                <div className={`rounded-lg px-4 py-3 text-sm ${
                  infoMsg.type === 'ok'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {infoMsg.type === 'ok' ? '✓ ' : '⚠ '}{infoMsg.text}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingInfo}
                  className="px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60"
                  style={{ backgroundColor: '#642f8d' }}
                >
                  {savingInfo ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Tab: Contraseña ── */}
        {tab === 'password' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Cambiar contraseña</h2>
            <p className="text-sm text-gray-500 mb-5">
              Usá una contraseña segura que no uses en otros sitios.
            </p>

            <form onSubmit={handleSavePw} className="space-y-4">
              {/* Nueva contraseña */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPw.next ? 'text' : 'password'}
                    required
                    value={pwForm.next}
                    onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => ({ ...s, next: !s.next }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPw.next ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.7}>
                        <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/>
                        <circle cx="10" cy="10" r="2.5"/>
                        <line x1="3" y1="3" x2="17" y2="17"/>
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.7}>
                        <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/>
                        <circle cx="10" cy="10" r="2.5"/>
                      </svg>
                    )}
                  </button>
                </div>

                {/* Indicador de fortaleza */}
                {pwStrength && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: pwStrength.width, background: pwStrength.color }}
                      />
                    </div>
                    <p className="mt-1 text-xs font-medium" style={{ color: pwStrength.color }}>
                      {pwStrength.label}
                    </p>
                  </div>
                )}

                {/* Requisitos */}
                <ul className="mt-2 space-y-1">
                  {[
                    { ok: pwForm.next.length >= 8,           label: 'Al menos 8 caracteres' },
                    { ok: /[A-Z]/.test(pwForm.next),         label: 'Una mayúscula'         },
                    { ok: /[0-9]/.test(pwForm.next),         label: 'Un número'             },
                  ].map(req => (
                    <li key={req.label} className={`flex items-center gap-1.5 text-xs ${
                      req.ok ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                        {req.ok
                          ? <polyline points="3,8 6,11 13,4" />
                          : <circle cx="8" cy="8" r="5" />
                        }
                      </svg>
                      {req.label}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Confirmar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmá la nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPw.confirm ? 'text' : 'password'}
                    required
                    value={pwForm.confirm}
                    onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      pwForm.confirm && pwForm.next !== pwForm.confirm
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    placeholder="Repetí la contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.7}>
                      <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/>
                      <circle cx="10" cy="10" r="2.5"/>
                    </svg>
                  </button>
                </div>
                {pwForm.confirm && pwForm.next !== pwForm.confirm && (
                  <p className="mt-1 text-xs text-red-500">Las contraseñas no coinciden</p>
                )}
              </div>

              {pwMsg && (
                <div className={`rounded-lg px-4 py-3 text-sm ${
                  pwMsg.type === 'ok'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {pwMsg.type === 'ok' ? '✓ ' : '⚠ '}{pwMsg.text}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingPw || pwForm.next !== pwForm.confirm || pwForm.next.length < 8}
                  className="px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#642f8d' }}
                >
                  {savingPw ? 'Actualizando…' : 'Actualizar contraseña'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </main>
  )
}
