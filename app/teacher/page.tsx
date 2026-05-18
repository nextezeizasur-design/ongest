export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import ScoreBar from '@/components/ui/ScoreBar'
import Badge from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Correcciones' }

// ── Indicador de urgencia según tiempo de espera ──
// < 24h  → gris   "Hace X horas"
// 1-2d   → amber  "Hace 1 día"    ← atención
// 3-5d   → naranja "Hace 3 días"  ← urgente
// > 5d   → rojo   "Hace X días"  ← crítico
function WaitingIndicator({ submittedAt }: { submittedAt: string }) {
  const submitted  = new Date(submittedAt)
  const now        = new Date()
  const diffMs     = now.getTime() - submitted.getTime()
  const diffHours  = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays   = Math.floor(diffHours / 24)

  let label: string
  let colorClass: string
  let dot: string

  if (diffHours < 1) {
    label      = 'Hace menos de 1h'
    colorClass = 'text-gray-400'
    dot        = 'bg-gray-300'
  } else if (diffHours < 24) {
    label      = `Hace ${diffHours}h`
    colorClass = 'text-gray-500'
    dot        = 'bg-gray-400'
  } else if (diffDays <= 2) {
    label      = diffDays === 1 ? 'Hace 1 día' : 'Hace 2 días'
    colorClass = 'text-amber-600 font-medium'
    dot        = 'bg-amber-400'
  } else if (diffDays <= 5) {
    label      = `Hace ${diffDays} días`
    colorClass = 'text-orange-600 font-semibold'
    dot        = 'bg-orange-500'
  } else {
    label      = `Hace ${diffDays} días`
    colorClass = 'text-red-600 font-semibold'
    dot        = 'bg-red-500'
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        <span className={`text-xs ${colorClass}`}>{label}</span>
      </div>
      <p className="text-xs text-gray-400 pl-3.5">{formatDateTime(submittedAt)}</p>
    </div>
  )
}

export default async function TeacherResults() {
  const profile  = await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

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

  // Pendientes ordenados por más antiguos primero → los más urgentes arriba
  const pending   = all
    .filter((a: any) => a.status === 'submitted')
    .sort((a: any, b: any) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())

  const completed = all.filter((a: any) => a.status === 'graded')

  // ── Calcular si hay correcciones críticas (> 5 días) para el subtitle ──
  const critical = pending.filter((a: any) => {
    const days = Math.floor((Date.now() - new Date(a.submitted_at).getTime()) / (1000 * 60 * 60 * 24))
    return days > 5
  })

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Correcciones"
        subtitle={
          critical.length > 0
            ? `${pending.length} pendiente${pending.length !== 1 ? 's' : ''} · ⚠️ ${critical.length} con más de 5 días`
            : `${pending.length} pendiente${pending.length !== 1 ? 's' : ''} · ${completed.length} corregido${completed.length !== 1 ? 's' : ''}`
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Pendientes ── */}
        {pending.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Pendientes</h2>
              <Badge variant="amber">{pending.length}</Badge>
              {critical.length > 0 && (
                <span className="ml-auto text-xs text-red-600 font-medium">
                  ⚠️ {critical.length} con más de 5 días sin corregir
                </span>
              )}
            </div>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Evaluación</th>
                  <th>Esperando</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((att: any) => {
                  const diffDays = Math.floor(
                    (Date.now() - new Date(att.submitted_at).getTime()) / (1000 * 60 * 60 * 24)
                  )
                  const rowHighlight = diffDays > 5
                    ? 'bg-red-50'
                    : diffDays >= 3
                      ? 'bg-orange-50'
                      : ''

                  return (
                    <tr key={att.id} className={rowHighlight}>
                      <td>
                        <p className="font-medium text-gray-900">
                          {att.profiles?.first_name} {att.profiles?.last_name}
                        </p>
                        <p className="text-xs text-gray-400">{att.profiles?.email}</p>
                      </td>
                      <td className="text-gray-700">{att.evaluations?.title}</td>
                      <td>
                        <WaitingIndicator submittedAt={att.submitted_at} />
                      </td>
                      <td>
                        <a
                          href={`/teacher/results/${att.id}`}
                          className="btn-brand text-xs py-1.5 px-3"
                        >
                          Corregir →
                        </a>
                      </td>
                    </tr>
                  )
                })}
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
