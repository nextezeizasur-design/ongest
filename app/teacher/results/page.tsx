export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import ScoreBar from '@/components/ui/ScoreBar'
import Badge from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Correcciones' }

export default async function TeacherResults() {
  const profile  = await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  // Traer evaluaciones de la organización
  const { data: evalIds } = await sb
    .from('evaluations')
    .select('id')
    .eq('organization_id', profile.organization_id)

  const ids = (evalIds ?? []).map((e: any) => e.id)

  let all: any[] = []
  if (ids.length > 0) {
    const { data: attempts } = await sb
      .from('attempts')
      .select('*, evaluations(id, title, pass_score), profiles!attempts_student_id_fkey(first_name, last_name, email)')
      .in('status', ['submitted', 'graded'])
      .in('evaluation_id', ids)
      .order('submitted_at', { ascending: false })
    all = attempts ?? []
  }

  const pending   = all.filter((a: any) => a.status === 'submitted')
  const completed = all.filter((a: any) => a.status === 'graded')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Correcciones"
        subtitle={`${pending.length} pendiente${pending.length !== 1 ? 's' : ''} · ${completed.length} corregido${completed.length !== 1 ? 's' : ''}`}
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Pendientes ── */}
        {pending.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Pendientes</h2>
              <Badge variant="amber">{pending.length}</Badge>
            </div>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Evaluación</th>
                  <th>Entregado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((att: any) => (
                  <tr key={att.id}>
                    <td>
                      <p className="font-medium text-gray-900">
                        {att.profiles?.first_name} {att.profiles?.last_name}
                      </p>
                      <p className="text-xs text-gray-400">{att.profiles?.email}</p>
                    </td>
                    <td className="text-gray-700">{att.evaluations?.title}</td>
                    <td className="text-xs text-gray-500">{formatDateTime(att.submitted_at)}</td>
                    <td>
                      <a
                        href={`/teacher/results/${att.id}`}
                        className="btn-brand text-xs py-1.5 px-3"
                      >
                        Corregir →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card text-center py-8">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-green-700 font-medium">Sin correcciones pendientes</p>
            <p className="text-sm text-gray-400 mt-1">Todos los exámenes han sido corregidos.</p>
          </div>
        )}

        {/* ── Historial de corregidos ── */}
        {completed.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Historial de corregidos</h2>
              <Badge variant="green">{completed.length}</Badge>
            </div>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Evaluación</th>
                  <th>Corregido</th>
                  <th>Score</th>
                  <th>Resultado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((att: any) => (
                  <tr key={att.id}>
                    <td>
                      <p className="font-medium text-gray-900">
                        {att.profiles?.first_name} {att.profiles?.last_name}
                      </p>
                      <p className="text-xs text-gray-400">{att.profiles?.email}</p>
                    </td>
                    <td className="text-gray-700">{att.evaluations?.title}</td>
                    <td className="text-xs text-gray-500">{formatDateTime(att.graded_at ?? att.submitted_at)}</td>
                    <td><ScoreBar score={att.score ?? 0} /></td>
                    <td>
                      <Badge variant={att.passed ? 'green' : 'red'}>
                        {att.passed ? 'Aprobado' : 'Desaprobado'}
                      </Badge>
                    </td>
                    <td>
                      <a
                        href={`/teacher/results/${att.id}`}
                        className="text-xs text-purple-600 hover:underline"
                      >
                        Ver →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {completed.length === 0 && pending.length > 0 && (
          <div className="card text-center py-6">
            <p className="text-sm text-gray-400">Aún no hay exámenes corregidos.</p>
          </div>
        )}

      </main>
    </div>
  )
}
