export const dynamic    = 'force-dynamic'
export const revalidate = 0

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'

export const metadata = { title: 'Actividad del sistema' }

const ACTION_LABEL: Record<string, { label: string; color: string }> = {
  INSERT: { label: 'Creación',    color: 'bg-green-100 text-green-800'  },
  UPDATE: { label: 'Modificación',color: 'bg-blue-100 text-blue-800'    },
  DELETE: { label: 'Eliminación', color: 'bg-red-100 text-red-800'      },
}

const TABLE_LABEL: Record<string, string> = {
  profiles:     'Usuarios',
  evaluations:  'Evaluaciones',
  courses:      'Cursos',
  enrollments:  'Inscripciones',
  certificates: 'Certificados',
}

export default async function AuditPage() {
  await requireRole('director' as any)
  const supabase = await createClient()
  const sb       = supabase as any

  const { data: logs } = await sb
    .from('audit_log_view')
    .select('*')
    .limit(100)

  const entries = logs ?? []

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Actividad del sistema"
        subtitle="Registro de acciones administrativas — últimas 100"
      />

      <main className="flex-1 overflow-y-auto p-6">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-gray-500 font-medium">Sin actividad registrada aún</p>
            <p className="text-gray-400 text-sm mt-1">
              Las acciones administrativas aparecerán aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="table-base w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 w-40">Fecha y hora</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Descripción</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Sección</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Realizado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((log: any) => {
                  const action  = ACTION_LABEL[log.action] ?? { label: log.action, color: 'bg-gray-100 text-gray-700' }
                  const section = TABLE_LABEL[log.table_name] ?? log.table_name
                  const fecha   = new Date(log.created_at).toLocaleString('es-AR', {
                    day:    '2-digit',
                    month:  '2-digit',
                    year:   'numeric',
                    hour:   '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                        {fecha}
                      </td>
                      <td className="px-4 py-3 text-gray-900 max-w-xs">
                        <p className="truncate">{log.description ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${action.color}`}>
                          {action.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{section}</td>
                      <td className="px-4 py-3">
                        {log.actor_name ? (
                          <div>
                            <p className="text-gray-900 font-medium text-xs">{log.actor_name}</p>
                            <p className="text-gray-400 text-xs">{log.actor_email}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Sistema</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
