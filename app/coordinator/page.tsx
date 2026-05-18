import { requireRole } from '@/lib/auth'
import { getEvaluationStats } from '@/services/evaluations'
import { getStudentStats } from '@/services/students'
import TopBar from '@/components/layout/TopBar'
import StatCard from '@/components/ui/StatCard'
import { formatScore, formatDate, getEvalStatus, EVAL_STATUS_BADGE, EVAL_STATUS_LABEL, scoreColor } from '@/lib/utils'

export const metadata = { title: 'Dashboard Coordinación' }

export default async function CoordinatorDashboard() {
  const profile = await requireRole(['director', 'coordinator'] as any)
  const orgId   = profile.organization_id

  const [{ data: evals }, { data: students }] = await Promise.all([
    getEvaluationStats(orgId),
    getStudentStats(orgId),
  ])

  const active    = evals.filter(e => getEvalStatus({ status: e.status, available_until: e.available_until }) === 'active').length
  const pending   = evals.filter(e => e.in_progress_count > 0).reduce((a,e) => a + e.in_progress_count, 0)
  const atRisk    = students.filter(s => (s.avg_score ?? 100) < 60 && s.total_attempts > 0).length
  const recentEvals = evals.slice(0, 6)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Coordinación" subtitle="Gestión de evaluaciones" actions={
        <a href="/coordinator/evaluations/new" className="btn-brand">+ Nueva evaluación</a>
      }/>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Evaluaciones activas" value={active}   delay={0} />
          <StatCard label="En progreso ahora"    value={pending}  delay={1} />
          <StatCard label="Total alumnos"        value={students.length} delay={2} />
          <StatCard label="En riesgo"            value={atRisk}   subColor={atRisk > 0 ? 'red' : 'green'}
            sub={atRisk > 0 ? 'Necesitan seguimiento' : '✓ Sin riesgo'} delay={3} />
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Evaluaciones</h2>
            <a href="/coordinator/evaluations" className="text-xs font-medium" style={{ color:'#642f8d' }}>Ver todas →</a>
          </div>
          <div className="space-y-3">
            {recentEvals.map(ev => {
              const st = getEvalStatus({ status: ev.status, available_until: ev.available_until })
              return (
                <div key={ev.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{ev.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ev.completed_count}/{ev.unique_students} completados
                      {ev.avg_score != null && <> · Promedio <span className={scoreColor(ev.avg_score)}>{formatScore(ev.avg_score)}</span></>}
                      {ev.available_until && ` · Vence ${formatDate(ev.available_until)}`}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {ev.cefr_code && <span className={`cefr-pill cefr-${ev.cefr_code}`}>{ev.cefr_code}</span>}
                    <span className={`badge ${EVAL_STATUS_BADGE[st]}`}>{EVAL_STATUS_LABEL[st]}</span>
                    <a href={`/coordinator/evaluations/${ev.id}`}
                      className="text-xs font-medium" style={{ color:'#642f8d' }}>
                      Ver →
                    </a>
                  </div>
                </div>
              )
            })}
            {recentEvals.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">
                No hay evaluaciones. <a href="/coordinator/evaluations/new" style={{ color:'#642f8d' }}>Crear una →</a>
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
