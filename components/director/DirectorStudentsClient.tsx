'use client'

// components/director/DirectorStudentsClient.tsx
// Vista completa: estadísticas del director + acciones de secretaria (crear, editar, activar)

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { formatScore, scoreColor, scoreBarColor, CEFR_LEVELS } from '@/lib/utils'
import type { CefrCode } from '@/types'

interface Student {
  id:            string
  first_name:    string
  last_name:     string
  email:         string
  phone?:        string
  birth_date?:   string
  is_active:     boolean
  course_name?:  string
  course_id?:    string
  cefr_code?:    string
  total_attempts: number
  passed_count:   number
  avg_score?:     number | null
  first_login_at?: string | null
  last_seen_at?:   string | null
}

interface Course {
  id:           string
  name:         string
  cefr_levels?: { code: string }
}

function calcAge(birth_date?: string): number | null {
  if (!birth_date) return null
  const today = new Date()
  const dob   = new Date(birth_date)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  })
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

type FilterStatus = 'all' | 'risk' | 'pending'

export default function DirectorStudentsClient({ orgId }: { orgId: string }) {
  const sb = createClient() as any

  const [students,     setStudents]     = useState<Student[]>([])
  const [courses,      setCourses]      = useState<Course[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [cefrFilter,   setCefrFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')

  // Modal state
  const [modal,        setModal]        = useState<'new' | 'edit' | null>(null)
  const [editing,      setEditing]      = useState<Student | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [invited,      setInvited]      = useState(false)
  const [tempPassword, setTempPassword] = useState('')
  const [createdEmail, setCreatedEmail] = useState('')
  const [createdName,  setCreatedName]  = useState('')
  const [copied,       setCopied]       = useState(false)
  const [toast,        setToast]        = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [form,         setForm]         = useState({
    first_name: '', last_name: '', email: '', phone: '', birth_date: '', course_id: '',
  })

  async function load() {
    setLoading(true)
    const [{ data: s }, { data: c }] = await Promise.all([
      sb.from('v_student_stats').select('*').eq('organization_id', orgId).order('last_name'),
      sb.from('courses').select('id, name, cefr_levels(code)').eq('organization_id', orgId).eq('is_active', true),
    ])
    setStudents(s ?? [])
    setCourses(c ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function showToast(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 5000)
  }

  function openNew() {
    setForm({ first_name: '', last_name: '', email: '', phone: '', birth_date: '', course_id: '' })
    setInvited(false); setTempPassword(''); setCreatedEmail(''); setCreatedName(''); setCopied(false)
    setModal('new')
  }

  function openEdit(s: Student) {
    setEditing(s)
    setForm({ first_name: s.first_name, last_name: s.last_name, email: s.email,
      phone: s.phone ?? '', birth_date: s.birth_date ?? '', course_id: s.course_id ?? '' })
    setModal('edit')
  }

  function closeModal() { setModal(null); setEditing(null); setInvited(false) }

  async function handleCreate() {
    if (!form.first_name || !form.last_name || !form.email) {
      showToast('err', 'Nombre, apellido y email son obligatorios.')
      return
    }
    setSaving(true)
    const res  = await fetch('/api/students/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, organization_id: orgId }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { showToast('err', data.error ?? 'Error al crear el alumno.'); return }
    setTempPassword(data.temp_password ?? '')
    setCreatedEmail(data.email ?? form.email)
    setCreatedName(data.full_name ?? `${form.first_name} ${form.last_name}`)
    setInvited(true)
    await load()
  }

  async function handleEdit() {
    if (!editing) return
    setSaving(true)
    await sb.from('profiles').update({
      first_name: form.first_name.trim(),
      last_name:  form.last_name.trim(),
      phone:      form.phone.trim() || null,
      birth_date: form.birth_date || null,
    }).eq('id', editing.id)

    if (form.course_id !== (editing.course_id ?? '')) {
      if (editing.course_id) await sb.from('enrollments').delete().eq('student_id', editing.id)
      if (form.course_id)    await sb.from('enrollments').insert({ student_id: editing.id, course_id: form.course_id })
    }

    await load(); setSaving(false); showToast('ok', 'Alumno actualizado.'); closeModal()
  }

  async function toggleActive(s: Student) {
    await sb.from('profiles').update({ is_active: !s.is_active }).eq('id', s.id)
    await load()
  }

  // Filtros
  const filtered = students.filter(s => {
    if (search) {
      const q = search.toLowerCase()
      if (!`${s.first_name} ${s.last_name} ${s.email}`.toLowerCase().includes(q)) return false
    }
    if (cefrFilter && s.cefr_code !== cefrFilter) return false
    if (statusFilter === 'risk')    return (s.avg_score ?? 100) < 60 && s.total_attempts > 0
    if (statusFilter === 'pending') return s.total_attempts === 0
    return true
  })

  const atRisk  = students.filter(s => (s.avg_score ?? 100) < 60 && s.total_attempts > 0).length
  const pending = students.filter(s => s.total_attempts === 0).length

  // Stats de acceso
  const nuncaIngresaron = students.filter(s => !s.first_login_at).length

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm font-medium animate-fade-up ${
          toast.type === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{toast.type === 'ok' ? '✓' : '✕'}</span>{toast.msg}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total',           value: students.length,  active: statusFilter === 'all',     onClick: () => setStatusFilter('all') },
          { label: 'En riesgo',       value: atRisk,           active: statusFilter === 'risk',    onClick: () => setStatusFilter('risk'),    color: 'text-red-600' },
          { label: 'Sin rendir',      value: pending,          active: statusFilter === 'pending', onClick: () => setStatusFilter('pending'), color: 'text-amber-600' },
          { label: 'Nunca ingresaron', value: nuncaIngresaron, active: false,                      onClick: () => {},                         color: 'text-gray-400' },
        ].map(s => (
          <button
            key={s.label}
            onClick={s.onClick}
            className={`card-sm text-center hover:bg-gray-50 transition-colors ${s.active ? 'ring-2 ring-purple-400' : ''}`}
          >
            <p className={`text-2xl font-semibold ${s.color ?? 'text-gray-900'}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filtros + búsqueda + botón nuevo */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input max-w-xs"
          />
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={!cefrFilter} onClick={() => setCefrFilter('')}>Todos</FilterPill>
            {CEFR_LEVELS.map(level => (
              <FilterPill key={level} active={cefrFilter === level} onClick={() => setCefrFilter(level)}>
                {level}
              </FilterPill>
            ))}
          </div>
        </div>
        <button onClick={openNew} className="btn-brand flex-shrink-0">+ Nuevo alumno</button>
      </div>

      {/* Tabla */}
      <div className="table-wrap">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Sin alumnos. <button onClick={openNew} className="font-medium" style={{ color: '#642f8d' }}>Agregar →</button>
          </div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Nivel</th>
                <th>Curso</th>
                <th>Exámenes</th>
                <th>Aprobados</th>
                <th>Promedio</th>
                <th>Primer acceso</th>
                <th>Último acceso</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const st = s.total_attempts === 0
                  ? { label: 'Sin rendir', cls: 'badge-gray' }
                  : (s.avg_score ?? 100) < 60
                  ? { label: 'En riesgo',  cls: 'badge-red' }
                  : { label: 'Al día',     cls: 'badge-green' }

                const nuncaIngreso = !s.first_login_at

                return (
                  <tr key={s.id} className={!s.is_active ? 'opacity-50' : ''}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar firstName={s.first_name} lastName={s.last_name} />
                        <div>
                          <p className="font-medium text-gray-900">{s.first_name} {s.last_name}</p>
                          <p className="text-xs text-gray-400">{s.email}</p>
                          {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td>
                      {s.cefr_code
                        ? <span className={`cefr-pill cefr-${s.cefr_code}`}>{s.cefr_code}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="text-gray-600 max-w-[150px] truncate">
                      {s.course_name ?? <span className="text-amber-600 text-xs">Sin curso</span>}
                    </td>
                    <td className="text-gray-600">{s.total_attempts}</td>
                    <td className="text-gray-600">{s.passed_count} / {s.total_attempts}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${scoreColor(s.avg_score)}`}>
                          {formatScore(s.avg_score)}
                        </span>
                        <div className="score-bar-bg">
                          <div className={`score-bar ${scoreBarColor(s.avg_score)}`}
                            style={{ width: `${s.avg_score ?? 0}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      {nuncaIngreso
                        ? <span className="text-xs text-amber-600 font-medium">Nunca ingresó</span>
                        : <span className="text-xs text-gray-500">{formatDate(s.first_login_at)}</span>
                      }
                    </td>
                    <td>
                      {nuncaIngreso
                        ? <span className="text-gray-300 text-xs">—</span>
                        : <span className="text-xs text-gray-500">{formatDateTime(s.last_seen_at)}</span>
                      }
                    </td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td>
                      <div className="flex gap-3 items-center">
                        <button
                          onClick={() => openEdit(s)}
                          className="text-xs font-medium"
                          style={{ color: '#642f8d' }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleActive(s)}
                          className={`text-xs ${s.is_active ? 'text-red-500' : 'text-green-600'}`}
                        >
                          {s.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal crear / editar */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={closeModal}
        >
          <div className="card w-full max-w-lg shadow-2xl animate-fade-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">
                {modal === 'new' ? 'Nuevo alumno' : `Editar — ${editing?.first_name} ${editing?.last_name}`}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {/* Post-creación: contraseña temporal + WhatsApp */}
            {invited ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 space-y-3">
                  <p className="text-sm font-semibold text-green-800">✓ Alumno creado correctamente</p>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-medium text-gray-900">{createdEmail}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Contraseña temporal</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm font-mono font-semibold text-gray-900 tracking-wider">
                        {tempPassword}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(tempPassword)
                          setCopied(true)
                          setTimeout(() => setCopied(false), 2000)
                        }}
                        className="btn-outline text-xs px-3 py-2 flex-shrink-0"
                      >
                        {copied ? '✓ Copiada' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠️ Guardá esta contraseña — solo se muestra una vez.
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hola ${createdName}! 👋 Te enviamos tus datos de acceso a OnGest, la plataforma de evaluaciones de Next Ezeiza.\n\n` +
                      `🔗 Acceso: https://ongest.vercel.app/login?org=next-english\n` +
                      `📧 Usuario: ${createdEmail}\n` +
                      `🔑 Contraseña temporal: ${tempPassword}\n\n` +
                      `Al ingresar por primera vez, te recomendamos cambiar tu contraseña desde tu perfil.\n\n` +
                      `Ante cualquier consulta, escribinos por este medio.\n\n` +
                      `Next Ezeiza — Equipo Académico`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline flex-1 text-center text-sm flex items-center justify-center gap-2"
                    style={{ borderColor: '#25d366', color: '#25d366' }}
                  >
                    💬 Enviar por WhatsApp
                  </a>
                  <button onClick={closeModal} className="btn-brand flex-1 text-sm">Cerrar</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Nombre *</label>
                    <input type="text" value={form.first_name}
                      onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
                      placeholder="Juan" className="input" />
                  </div>
                  <div>
                    <label className="label">Apellido *</label>
                    <input type="text" value={form.last_name}
                      onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
                      placeholder="García" className="input" />
                  </div>
                </div>

                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="juan@email.com"
                    className="input"
                    disabled={modal === 'edit'}
                  />
                  {modal === 'edit' && (
                    <p className="text-xs text-gray-400 mt-1">El email no puede modificarse desde aquí.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Teléfono</label>
                    <input type="text" value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+54 11 1234-5678" className="input" />
                  </div>
                  <div>
                    <label className="label">
                      Fecha de nacimiento
                      {form.birth_date && (
                        <span className="ml-1 text-[10px] font-normal text-purple-600">
                          ({calcAge(form.birth_date)} años)
                        </span>
                      )}
                    </label>
                    <input type="date" value={form.birth_date}
                      onChange={e => setForm(p => ({ ...p, birth_date: e.target.value }))}
                      max={new Date().toISOString().split('T')[0]} className="input" />
                  </div>
                </div>

                <div>
                  <label className="label">Curso</label>
                  <select value={form.course_id}
                    onChange={e => setForm(p => ({ ...p, course_id: e.target.value }))}
                    className="select">
                    <option value="">Sin curso</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.cefr_levels ? ` (${c.cefr_levels.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={closeModal} className="btn-outline">Cancelar</button>
                  <button
                    onClick={modal === 'new' ? handleCreate : handleEdit}
                    disabled={saving}
                    className="btn-brand"
                  >
                    {saving ? 'Guardando…' : modal === 'new' ? 'Crear alumno' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FilterPill({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
      style={active
        ? { background: '#642f8d', color: '#fff' }
        : { background: '#fff', border: '1px solid #e5e7eb', color: '#6b7280' }
      }
    >
      {children}
    </button>
  )
}
