'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  role_id: number
  is_active: boolean
  created_at: string
}

interface CredentialRecord {
  email: string
  temp_password: string
  role: string
  created_at: string
}

const ROLE_LABELS: Record<number, string> = {
  1: 'Director',
  2: 'Coordinadora',
  3: 'Secretaria',
  4: 'Alumno',
  5: 'Docente',
}

const ROLE_IDS: Record<string, number> = {
  director:    1,
  coordinator: 2,
  secretary:   3,
  student:     4,
  teacher:     5,
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

const STORAGE_KEY = 'nei_staff_credentials'

function loadCredentials(): CredentialRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveCredential(record: CredentialRecord) {
  const existing = loadCredentials()
  localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...existing].slice(0, 50)))
}

export default function UsersClient({ orgId }: UsersClientProps) {
  const supabase = createClient()

  const [users, setUsers]               = useState<UserProfile[]>([])
  const [loading, setLoading]           = useState(true)
  const [filterRole, setFilterRole]     = useState<string>('all')
  const [search, setSearch]             = useState('')

  // Modal crear usuario
  const [showCreate, setShowCreate]     = useState(false)
  const [creating, setCreating]         = useState(false)
  const [createError, setCreateError]   = useState('')
  const [form, setForm]                 = useState({
    first_name: '',
    last_name:  '',
    email:      '',
    role:       'teacher',
  })

  // Modal credenciales
  const [showCreds, setShowCreds]       = useState(false)
  const [newCred, setNewCred]           = useState<CredentialRecord | null>(null)
  const [credsHistory, setCredsHistory] = useState<CredentialRecord[]>([])
  const [showHistory, setShowHistory]   = useState(false)

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

      const record: CredentialRecord = {
        email:         form.email,
        temp_password: json.temp_password,
        role:          ROLE_LABELS[ROLE_IDS[form.role]] ?? form.role,
        created_at:    new Date().toISOString(),
      }
      saveCredential(record)
      setNewCred(record)
      setShowCreate(false)
      setShowCreds(true)
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
        <div className="flex gap-3">
          <button
            onClick={() => { setCredsHistory(loadCredentials()); setShowHistory(true) }}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            🔑 Credenciales
          </button>
          <button
            onClick={() => { setShowCreate(true); setCreateError('') }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-colors"
            style={{ backgroundColor: '#642f8d' }}
          >
            + Nuevo usuario
          </button>
        </div>
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

      {/* ── Modal: Credenciales nuevas ── */}
      {showCreds && newCred && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="text-4xl mb-3">✅</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Usuario creado
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                Compartí estas credenciales con {newCred.email}
              </p>

              <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3 mb-5">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Email</span>
                  <p className="font-mono text-sm text-gray-900 mt-0.5">{newCred.email}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Contraseña temporal</span>
                  <p className="font-mono text-lg font-bold text-purple-700 mt-0.5 tracking-widest">
                    {newCred.temp_password}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Rol</span>
                  <p className="text-sm text-gray-900 mt-0.5">{newCred.role}</p>
                </div>
              </div>

              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-5">
                ⚠️ Guardá esta contraseña — no se puede recuperar después.
                Se guarda en el historial local de este dispositivo.
              </p>

              <button
                onClick={() => { setShowCreds(false); setNewCred(null) }}
                className="w-full px-4 py-2 text-sm text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#642f8d' }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Historial de credenciales ── */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Historial de credenciales</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {credsHistory.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No hay credenciales guardadas</p>
              ) : (
                <div className="space-y-3">
                  {credsHistory.map((c, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm text-gray-900">{c.email}</p>
                          <p className="text-xs text-gray-500">{c.role}</p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString('es-AR', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 font-mono text-sm font-bold text-purple-700 tracking-widest">
                        {c.temp_password}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200">
              <p className="text-xs text-gray-400 text-center">
                Guardado localmente en este dispositivo (últimos 50 registros)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
