'use client'

// RUTA: components/director/UsersClient.tsx

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserProfile {
  id:              string
  first_name:      string
  last_name:       string
  email:           string
  phone:           string | null
  role_id:         number
  is_active:       boolean
  created_at:      string
  first_login_at?: string | null
  last_seen_at?:   string | null
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

const ROLE_LABELS: Record<number, string> = {
  1: 'Director',
  2: 'Coordinador/a',
  3: 'Secretaria',
  4: 'Alumno',
  5: 'Docente',
}

const ROLE_WS_LABEL: Record<string, string> = {
  director:    'Director/a',
  coordinator: 'Coordinador/a',
  secretary:   'Secretaria',
  student:     'Alumno/a',
  teacher:     'Docente',
}

const ALL_ROLES = [
  { value: 'coordinator', label: 'Coordinador/a' },
  { value: 'secretary',   label: 'Secretaria'    },
  { value: 'teacher',     label: 'Docente'        },
  { value: 'student',     label: 'Alumno'         },
  { value: 'director',    label: 'Director'       },
]

interface UsersClientProps {
  orgId:     string
  orgName?:  string
}

function normalizarTel(tel: string): string {
  if (!tel) return ''
  let t = tel.replace(/\D/g, '')
  if (t.startsWith('0')) t = t.slice(1)
  if (t.startsWith('54')) t = t.slice(2)
  if (t.startsWith('9') && t.length > 10) t = t.slice(1)
  return '549' + t
}

function abrirWS(tel: string, msg: string) {
  const num = normalizarTel(tel)
  if (!num || num.length < 12) {
    alert('No hay teléfono cargado para este usuario.')
    return
  }
  const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
  window.open(url, '_blank')
}

export default function UsersClient({ orgId, orgName = 'OnGest' }: UsersClientProps) {
  const supabase = createClient()

  const [users, setUsers]           = useState<UserProfile[]>([])
  const [loading, setLoading]       = useState(true)
  const [filterRole, setFilterRole] = useState<string>('all')
  const [search, setSearch]         = useState('')

  const [showCreate, setShowCreate]     = useState(false)
  const [creating, setCreating]         = useState(false)
  const [createError, setCreateError]   = useState('')
  const [form, setForm]                 = useState({
    first_name: '',
    last_name:  '',
    email:      '',
    phone:      '',
    role:       'teacher',
  })

  const [showSuccess, setShowSuccess]   = useState(false)
  const [lastUser, setLastUser]         = useState({
    first_name: '', last_name: '', email: '', phone: '', role: ''
  })
  const [lastTempPass, setLastTempPass] = useState('')
  const [copiedPass, setCopiedPass]     = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)
  const [deleting, setDeleting]         = useState(false)
  const [deleteError, setDeleteError]   = useState('')

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, phone, role_id, is_active, created_at, first_login_at, last_seen_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }

  async function toggleActive(user: UserProfile) {
    await supabase
      .from('profiles')
      .update({ is_active: !user.is_active })
      .eq('id', user.id)
    setUsers(prev =>
      prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u)
    )
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')

    try {
      const res = await fetch('/api/users/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, organization_id: orgId }),
      })
      const json = await res.json()

      if (!res.ok) {
        setCreateError(json.error ?? 'Error al crear usuario.')
        return
      }

      setLastUser({
        first_name: form.first_name,
        last_name:  form.last_name,
        email:      form.email,
        phone:      form.phone,
        role:       form.role,
      })
      setLastTempPass(json.temp_password ?? '')
      setCopiedPass(false)
      setShowCreate(false)
      setShowSuccess(true)
      setForm({ first_name: '', last_name: '', email: '', phone: '', role: 'teacher' })
      fetchUsers()
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')

    try {
      const res = await fetch('/api/users/delete', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: deleteTarget.id }),
      })
      const json = await res.json()

      if (!res.ok) {
        setDeleteError(json.error ?? 'Error al eliminar.')
        return
      }

      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  function buildWSMessage(user: typeof lastUser, tempPass: string): string {
    return `Hola ${user.first_name} 👋

Ya tenés acceso a *OnGest*, la plataforma de evaluaciones de *${orgName}*.

🔗 Plataforma: ongest.vercel.app/login
📧 Email: ${user.email}
🔑 Contraseña temporal: ${tempPass}

Ingresá con estos datos. Una vez adentro podés cambiar tu contraseña desde tu perfil.

Cualquier consulta estamos a disposición 😊`
  }

  const filtered = users.filter(u => {
    const matchRole   = filterRole === 'all' || u.role_id === Number(filterRole)
    const matchSearch = search === '' ||
      `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
    return matchRole && matchSearch
  })

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">
            {users.length} usuario{users.length !== 1 ? 's' : ''} en total
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateError('') }}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-colors"
          style={{ backgroundColor: '#642f8d' }}
        >
          + Nuevo usuario
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Buscar por nombre o email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">Todos los roles</option>
          {Object.entries(ROLE_LABELS).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Rol</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Primer acceso</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Último acceso</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                filtered.map(user => {
                  const nuncaIngreso = !user.first_login_at
                  return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {ROLE_LABELS[user.role_id] ?? 'Desconocido'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {nuncaIngreso
                        ? <span className="text-xs text-amber-600 font-medium">Nunca ingresó</span>
                        : <span className="text-xs text-gray-500">{formatDate(user.first_login_at)}</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {nuncaIngreso
                        ? <span className="text-gray-300 text-xs">—</span>
                        : <span className="text-xs text-gray-500">{formatDateTime(user.last_seen_at)}</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleActive(user)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                            user.is_active
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-green-200 text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {user.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => { setDeleteTarget(user); setDeleteError('') }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
                        >
                          🗑 Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Crear usuario ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Nuevo usuario</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Juan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Pérez"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="usuario@nextenglish.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="11 1234-5678"
                />
                <p className="text-xs text-gray-400 mt-1">Opcional — para enviar accesos por WhatsApp</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {ALL_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {createError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-60"
                  style={{ backgroundColor: '#642f8d' }}
                >
                  {creating ? 'Creando…' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmación post-creación ── */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <h2 className="text-lg font-semibold text-gray-900 mb-1">¡Usuario creado!</h2>
              <p className="text-sm text-gray-500 mb-4">
                Compartí estos datos de acceso con<br />
                <span className="font-medium text-gray-800">{lastUser.first_name} {lastUser.last_name}</span>
              </p>

              <div className="bg-gray-50 rounded-xl p-4 text-left mb-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Rol</span>
                  <span className="font-medium text-gray-900">{ROLE_WS_LABEL[lastUser.role]}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium text-gray-900 text-xs break-all">{lastUser.email}</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Contraseña temporal</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg tracking-widest" style={{ color: '#642f8d' }}>
                      {lastTempPass}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(lastTempPass)
                        setCopiedPass(true)
                        setTimeout(() => setCopiedPass(false), 2000)
                      }}
                      className="ml-auto text-xs px-2 py-1 rounded font-medium transition-colors flex-shrink-0"
                      style={{ backgroundColor: copiedPass ? '#16a34a' : '#642f8d', color: 'white' }}
                    >
                      {copiedPass ? '✓' : 'Copiar'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left mb-4">
                <p className="text-xs text-amber-700">
                  <strong>⚠ Guardá esta contraseña.</strong> Solo se muestra una vez. El usuario puede cambiarla desde su perfil.
                </p>
              </div>

              {lastUser.phone && (
                <button
                  onClick={() => abrirWS(lastUser.phone, buildWSMessage(lastUser, lastTempPass))}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors mb-3"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.126 1.526 5.862L.055 23.454a.5.5 0 0 0 .608.608l5.592-1.471A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.7-.504-5.253-1.386l-.374-.222-3.878 1.019 1.019-3.878-.222-.374A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                  Enviar accesos por WhatsApp
                </button>
              )}

              <button
                onClick={() => setShowSuccess(false)}
                className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar eliminación ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center mb-5">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <span className="text-2xl">🗑</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">¿Eliminar usuario?</h2>
              <p className="text-sm text-gray-500">
                Vas a eliminar permanentemente a<br />
                <strong className="text-gray-800">{deleteTarget.first_name} {deleteTarget.last_name}</strong><br />
                <span className="text-xs text-gray-400">{deleteTarget.email}</span>
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
              <p className="text-xs text-red-700">
                <strong>Esta acción no se puede deshacer.</strong> Se borrarán todos sus datos, intentos de exámenes e inscripciones.
              </p>
            </div>

            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError('') }}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#dc2626' }}
              >
                {deleting ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
