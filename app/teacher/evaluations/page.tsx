export const dynamic = 'force-dynamic'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, formatScore, getEvalStatus, EVAL_STATUS_BADGE, EVAL_STATUS_LABEL, EVAL_TYPE_LABEL } from '@/lib/utils'
import DeleteEvaluationButton from '@/components/coordinator/DeleteEvaluationButton'

export const metadata = { title: 'Evaluaciones' }

export default async function TeacherEvaluations() {
  const profile  = await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  const { data: evals } = await sb
    .from('v_evaluation_stats')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('available_until', { ascending: false })

  // Teacher ve solo las suyas; director/coordinator ven todas
  const filtered = profile.role === 'teacher'
    ? (evals ?? []).filter((e: any) => e.created_by === profile.id || true) // por ahora ve todas de la org
    : (evals ?? [])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Evaluaciones"
        subtitle={`${filtered.length} evaluaciones`}
        actions={
          <a href="/teacher/evaluations/new" className="btn-brand">+ Nueva evaluación</a>
        }
      />

      <main className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <EmptyState
            title="Sin evaluaciones"
            description="Creá la primera evaluación para tus alumnos."
            action={<a href="/teacher/evaluations/new" className="btn-brand">+ Nueva evaluación</a>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr><th>Título</th><th>Tipo</th><th>Nivel</th><th>Completados</th><th>Promedio</th><th>Vencimiento</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {filtered.map((ev: any) => {
                  const st = getEvalStatus({ status: ev.status, available_until: ev.available_until })
                  return (
                    <tr key={ev.id}>
                      <td>
                        <a href={`/teacher/evaluations/${ev.id}`} className="font-medium text-gray-900 hover:underline">
                          {ev.title}
                        </a>
                      </td>
                      <td className="text-gray-600">{EVAL_TYPE_LABEL[ev.eval_type]}</td>
                      <td>{ev.cefr_code ? <span className={`cefr-pill cefr-${ev.cefr_code}`}>{ev.cefr_code}</span> : '—'}</td>
                      <td className="text-gray-600">{ev.completed_count} / {ev.unique_students}</td>
                      <td>{ev.avg_score != null
                        ? <span className={ev.avg_score >= 60 ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>{formatScore(ev.avg_score)}</span>
                        : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="text-gray-600">{formatDate(ev.available_until)}</td>
                      <td><span className={`badge ${EVAL_STATUS_BADGE[st]}`}>{EVAL_STATUS_LABEL[st]}</span></td>
                      <td>
                        <div className="flex gap-2">
                          <a href={`/teacher/evaluations/${ev.id}`}
                            className="text-xs font-medium" style={{ color:'#642f8d' }}>
                            Ver
                          </a>
                          <a href={`/teacher/evaluations/${ev.id}/assets`}
                            className="text-xs text-gray-500 hover:text-gray-700"
                            title="Subir PDF y audio">
                            📎 Archivos
                          </a>
                          <DeleteEvaluationButton
                            evalId={ev.id}
                            status={ev.status}
                            title={ev.title}
                            backHref="/teacher/evaluations"
                          />
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
