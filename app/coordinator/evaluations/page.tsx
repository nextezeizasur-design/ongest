import { requireRole } from '@/lib/auth'
import { getEvaluationStats } from '@/services/evaluations'
import TopBar from '@/components/layout/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, formatScore, getEvalStatus, EVAL_STATUS_BADGE, EVAL_STATUS_LABEL, EVAL_TYPE_LABEL } from '@/lib/utils'

export const metadata = { title: 'Evaluaciones' }

export default async function CoordinatorEvaluations() {
  const profile = await requireRole(['director', 'coordinator'] as any)
  const { data: evals } = await getEvaluationStats(profile.organization_id)

  const base = profile.role === 'director' ? '/director' : '/coordinator'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Evaluaciones"
        subtitle={`${evals.length} en total`}
        actions={<a href={`${base}/evaluations/new`} className="btn-brand">+ Nueva evaluación</a>}
      />

      <main className="flex-1 overflow-y-auto p-6">
        {evals.length === 0 ? (
          <EmptyState
            title="Sin evaluaciones"
            description="Creá la primera evaluación para asignarla a los alumnos."
            action={<a href={`${base}/evaluations/new`} className="btn-brand">+ Nueva evaluación</a>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Título</th><th>Tipo</th><th>Nivel</th>
                  <th>Completados</th><th>Promedio</th>
                  <th>Vencimiento</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {evals.map(ev => {
                  const st = getEvalStatus({ status: ev.status, available_until: ev.available_until })
                  return (
                    <tr key={ev.id}>
                      <td><p className="font-medium text-gray-900">{ev.title}</p></td>
                      <td className="text-gray-600">{EVAL_TYPE_LABEL[ev.eval_type]}</td>
                      <td>{ev.cefr_code ? <span className={`cefr-pill cefr-${ev.cefr_code}`}>{ev.cefr_code}</span> : '—'}</td>
                      <td className="text-gray-600">{ev.completed_count} / {ev.unique_students}</td>
                      <td>{ev.avg_score != null
                        ? <span className={`font-semibold ${ev.avg_score >= 60 ? 'text-green-700' : 'text-red-600'}`}>{formatScore(ev.avg_score)}</span>
                        : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="text-gray-600">{formatDate(ev.available_until)}</td>
                      <td><span className={`badge ${EVAL_STATUS_BADGE[st]}`}>{EVAL_STATUS_LABEL[st]}</span></td>
                      <td>
                        <div className="flex gap-2">
                          <a href={`${base}/evaluations/${ev.id}`}
                            className="text-xs font-medium" style={{ color: '#642f8d' }}>
                            Ver
                          </a>
                          {ev.status === 'draft' && (
                            <a href={`${base}/evaluations/${ev.id}/edit`}
                              className="text-xs font-medium text-amber-600 hover:text-amber-800">
                              ✏️ Editar
                            </a>
                          )}
                          <a href={`${base}/results?eval=${ev.id}`}
                            className="text-xs text-gray-500 hover:text-gray-700">
                            Resultados
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
