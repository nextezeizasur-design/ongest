'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserProfile {
  id:         string
  first_name: string
  last_name:  string
  email:      string
  role_id:    number
  is_active:  boolean
  created_at: string
}

const ROLE_LABELS: Record<number, string> = {
  1: 'Director',
  2: 'Coordinadora',
  3: 'Secretaria',
  4: 'Alumno',
  5: 'Docente',
}

const STAFF_ROLES = [
  { value: 'coordinator', label: 'Coordinadora' },
  { value: 'secretary',   label: 'Secretaria'   },
  { value: 'teacher',     label: 'Docente'       },
  { value: 'director',    label: 'Director'      },
]

interface UsersClientProps {
  orgId: string
}

export default function UsersClient({ orgId }: UsersClientProps) {
  const supabase = createClient()

  const [users, setUsers]           = useState<UserProfile[]>([])
  const [loading, setLoading]       = useState(true)
  const [filterRole, setFilterRole] = useState<string>('all')
  const [search, setSearch]         = useState('')

  // Modal crear usuario
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating]     = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm]             = useState({
    first_name: '',
    last_name:  '',
    email:      '',
    role:       'teacher',
  })

  // Modal confirmación post-creación
  const [showSuccess, setShowSuccess] = useState(false)
  const [lastEmail, setLastEmail]     = useState('')
  const [lastRole, setLastRole]       = useState('')

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role_id, is_active, created_at')
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

      setLastEmail(form.email)
      setLastRole(ROLE_LABELS[{ director: 1, coordinator: 2, secretary: 3, student: 4, teacher: 5 }[form.role] ?? 5] ?? form.role)
      setShowCreate(false)
      setShowSuccess(true)
      setForm({ first_name: '', last_name: '', email: '', role: 'teacher' })
      fetchUsers()
    } finally {
      setCreating(false)
    }
  }

  const filtered = users.filter(u => {
    const matchRole   = filterRole === 'all' || u.role_id === Number(filterRole)
    const matchSearch = search === '' ||
      `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
    return matchRole && matchSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Filtros */}
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

      {/* Tabla */}
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
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                filtered.map(user => (
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
                    <td className="px-4 py-3 text-right">
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
                    </td>
                  </tr>
                ))
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
              <h2 className="text-lg font-semibold text-gray-900">Nuevo usuario staff</h2>
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
                  Rol <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {STAFF_ROLES.map(r => (
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
              {/* Check icon */}
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                ¡Usuario creado!
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                Se envió un email de bienvenida a<br />
                <span className="font-medium text-gray-800">{lastEmail}</span>
              </p>

              <div className="bg-gray-50 rounded-xl p-4 text-left mb-5 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Rol asignado</span>
                  <span className="font-medium text-gray-900">{lastRole}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Acceso</span>
                  <span className="text-green-700 font-medium">✓ Link de invitación enviado</span>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-5">
                El usuario deberá activar su cuenta desde el email recibido.
              </p>

              <button
                onClick={() => setShowSuccess(false)}
                className="w-full px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#642f8d' }}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
