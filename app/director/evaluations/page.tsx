import { requireRole } from '@/lib/auth'
import { getEvaluationStats } from '@/services/evaluations'
import TopBar from '@/components/layout/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, formatScore, getEvalStatus, EVAL_STATUS_LABEL, EVAL_STATUS_BADGE, EVAL_TYPE_LABEL } from '@/lib/utils'
import QuestionDifficultyEditor from '@/components/shared/QuestionDifficultyEditor'


export const metadata = { title: 'Evaluaciones' }

export default async function DirectorEvaluations({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const profile = await requireRole('director')
  const sp = await searchParams
  const { data: all } = await getEvaluationStats(profile.organization_id)

  const filtered = sp.status
    ? all.filter(e => getEvalStatus({ status: e.status, available_until: e.available_until }) === sp.status)
    : all

  const statuses = ['active', 'upcoming', 'closed', 'draft'] as const

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Evaluaciones"
        subtitle={`${filtered.length} evaluaciones`}
        actions={
          <a href="/director/evaluations/new" className="btn-brand">+ Nueva evaluación</a>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Status filters */}
        <div className="flex flex-wrap gap-1.5">
          <a href="/director/evaluations"
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={!sp.status ? { background:'#642f8d',color:'#fff' } : { background:'#fff',border:'1px solid #e5e7eb',color:'#6b7280' }}>
            Todas ({all.length})
          </a>
          {statuses.map(st => {
            const count = all.filter(e => getEvalStatus({ status: e.status, available_until: e.available_until }) === st).length
            return (
              <a key={st} href={`/director/evaluations?status=${st}`}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={sp.status === st ? { background:'#642f8d',color:'#fff' } : { background:'#fff',border:'1px solid #e5e7eb',color:'#6b7280' }}>
                {EVAL_STATUS_LABEL[st]} ({count})
              </a>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No hay evaluaciones"
            description="Creá la primera evaluación para empezar."
            action={<a href="/director/evaluations/new" className="btn-brand">+ Nueva evaluación</a>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Nivel</th>
                  <th>Asignados</th>
                  <th>Completados</th>
                  <th>Promedio</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ev => {
                  const st = getEvalStatus({ status: ev.status, available_until: ev.available_until })
                  const completionPct = ev.unique_students > 0
                    ? Math.round((ev.completed_count / ev.unique_students) * 100)
                    : 0
                  return (
                    <tr key={ev.id}>
                      <td>
                        <div>
                          <p className="font-medium text-gray-900">{ev.title}</p>
                          {ev.created_by_name && (
                            <p className="text-xs text-gray-400">por {ev.created_by_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="text-gray-600">{EVAL_TYPE_LABEL[ev.eval_type]}</td>
                      <td>{ev.cefr_code ? <span className={`cefr-pill cefr-${ev.cefr_code}`}>{ev.cefr_code}</span> : '—'}</td>
                      <td className="text-gray-600">{ev.unique_students}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">{ev.completed_count}</span>
                          {ev.unique_students > 0 && (
                            <div className="score-bar-bg w-12">
                              <div className="score-bar bg-blue-400" style={{ width: `${completionPct}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {ev.avg_score != null
                          ? <span className={`font-semibold ${ev.avg_score >= 60 ? 'text-green-700' : 'text-red-600'}`}>
                              {formatScore(ev.avg_score)}
                            </span>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className="text-gray-600">{formatDate(ev.available_until)}</td>
                      <td><span className={`badge ${EVAL_STATUS_BADGE[st]}`}>{EVAL_STATUS_LABEL[st]}</span></td>
                      <td>
                        <div className="flex gap-2">
                          <a href={`/director/evaluations/${ev.id}`}
                            className="text-xs font-medium" style={{ color:'#642f8d' }}>
                            Ver
                          </a>
                          {ev.status === 'draft' && (
                            <a href={`/director/evaluations/${ev.id}/edit`}
                              className="text-xs font-medium text-amber-600 hover:text-amber-800">
                              ✏️ Editar
                            </a>
                          )}
                          <a href={`/director/evaluations/new`}
                            className="text-xs text-gray-500 hover:text-gray-700">
                            + Nueva
                          </a>
                        </div>
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
