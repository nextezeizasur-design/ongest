import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import ScoreBar from '@/components/ui/ScoreBar'
import Badge from '@/components/ui/Badge'
import CefrPill from '@/components/ui/CefrPill'
import AlertBanner from '@/components/ui/AlertBanner'
import { formatDate, formatDateTime, formatScore, formatDuration, getEvalStatus, EVAL_STATUS_LABEL, ATTEMPT_STATUS_LABEL, EVAL_TYPE_LABEL } from '@/lib/utils'
import GradeClient from '@/components/coordinator/GradeClient'
import PublishButton from '@/components/coordinator/PublishButton'
import DeleteEvaluationButton from '@/components/coordinator/DeleteEvaluationButton'

export const metadata = { title: 'Evaluación' }

export default async function EvaluationDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = await params
  const profile  = await requireRole(['director', 'coordinator'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  const [{ data: ev }, { data: attempts }, { data: questions }, { data: assignedCourses }] = await Promise.all([
    sb.from('evaluations').select('*, cefr_levels(code, label)').eq('id', id).single(),
    sb.from('attempts')
      .select('*, profiles!attempts_student_id_fkey(first_name, last_name, email)')
      .eq('evaluation_id', id)
      .in('status', ['submitted', 'graded', 'in_progress', 'timed_out'])
      .order('submitted_at', { ascending: false }),
    sb.from('questions').select('id, q_type, body, points, sort_order').eq('evaluation_id', id).order('sort_order'),
    sb.from('evaluation_courses')
      .select('courses(id, name, cefr_levels(code))')
      .eq('evaluation_id', id),
  ])

  if (!ev) return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-gray-400">Evaluación no encontrada.</p>
    </div>
  )

  const st             = getEvalStatus({ status: ev.status, available_until: ev.available_until })
  const completedAtts  = (attempts ?? []).filter((a: any) => ['submitted','graded'].includes(a.status))
  const pendingGrade   = completedAtts.filter((a: any) => a.status === 'submitted')
  const avgScore       = completedAtts.length
    ? Math.round(completedAtts.reduce((acc: number, a: any) => acc + (a.score ?? 0), 0) / completedAtts.length)
    : null
  const passCount      = completedAtts.filter((a: any) => a.passed).length
  const hasOpenQs      = (questions ?? []).some((q: any) => ['short_answer','essay'].includes(q.q_type))

  const BADGE: Record<string, 'purple'|'green'|'amber'|'gray'|'blue'> = {
    active: 'purple', upcoming: 'amber', closed: 'green', draft: 'gray', published: 'blue',
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title={ev.title}
        subtitle={`${EVAL_TYPE_LABEL[ev.eval_type]} · ${ev.cefr_levels?.code ?? 'Sin nivel'}`}
        actions={
          <div className="flex gap-2">
            <Badge variant={BADGE[st] ?? 'gray'}>{EVAL_STATUS_LABEL[st]}</Badge>
            {ev.status === 'draft' && (
              <PublishButton evalId={id} />
            )}
            <DeleteEvaluationButton evalId={id} status={ev.status} title={ev.title} backHref="/coordinator/evaluations" />
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card-sm text-center">
            <p className="text-2xl font-semibold text-gray-900">{(attempts ?? []).length}</p>
            <p className="text-xs text-gray-500">Intentos totales</p>
          </div>
          <div className="card-sm text-center">
            <p className="text-2xl font-semibold text-gray-900">{completedAtts.length}</p>
            <p className="text-xs text-gray-500">Completados</p>
          </div>
          <div className="card-sm text-center">
            <p className={`text-2xl font-semibold ${avgScore !== null && avgScore >= 60 ? 'text-green-700' : 'text-red-600'}`}>
              {avgScore !== null ? `${avgScore}%` : '—'}
            </p>
            <p className="text-xs text-gray-500">Promedio</p>
          </div>
          <div className="card-sm text-center">
            <p className="text-2xl font-semibold text-green-700">{passCount}</p>
            <p className="text-xs text-gray-500">Aprobados</p>
          </div>
        </div>

        {/* Info card */}
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Configuración</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            {[
              { label: 'Tipo',          value: EVAL_TYPE_LABEL[ev.eval_type] },
              { label: 'Nivel',         value: ev.cefr_levels?.code ?? '—' },
              { label: 'Tiempo límite', value: ev.time_limit_min ? `${ev.time_limit_min} min` : 'Sin límite' },
              { label: 'Aprobación',    value: `${ev.pass_score}%` },
              { label: 'Disponible',    value: formatDate(ev.available_from) },
              { label: 'Vence',         value: formatDate(ev.available_until) },
              { label: 'Preguntas',     value: (questions ?? []).length },
              { label: 'Max intentos',  value: ev.max_attempts },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="font-medium text-gray-900">{String(value)}</p>
              </div>
            ))}
          </div>
          {ev.instructions && (
            <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5">
              <p className="text-xs text-blue-700 leading-relaxed">{ev.instructions}</p>
            </div>
          )}
        </div>

        {/* Pending grading alert */}
        {hasOpenQs && pendingGrade.length > 0 && (
          <AlertBanner type="warn">
            <strong>{pendingGrade.length} intento{pendingGrade.length > 1 ? 's' : ''}</strong> con respuestas abiertas pendientes de corrección manual.
          </AlertBanner>
        )}

        {/* Cursos asignados */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Cursos asignados</h2>
            <a href={`/coordinator/evaluations/${id}/assign`} className="text-xs font-medium" style={{ color: '#642f8d' }}>
              Editar asignación →
            </a>
          </div>
          {!assignedCourses || assignedCourses.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <span>⚠️</span>
              <span>Esta evaluación no está asignada a ningún curso. Los alumnos no pueden verla.</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(assignedCourses ?? []).map((ec: any) => {
                const course = ec.courses
                if (!course) return null
                return (
                  <a key={course.id} href={`/coordinator/courses/${course.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-sm font-medium text-gray-700">
                    {course.cefr_levels?.code && (
                      <span className={`cefr-pill cefr-${course.cefr_levels.code} text-[10px] py-0`}>
                        {course.cefr_levels.code}
                      </span>
                    )}
                    {course.name}
                  </a>
                )
              })}
            </div>
          )}
        </div>

        {/* Attempts table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Intentos de alumnos</h2>
          </div>
          {(attempts ?? []).length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">Ningún alumno ha rendido esta evaluación aún.</div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Inicio</th>
                  <th>Duración</th>
                  <th>Score</th>
                  <th>Estado</th>
                  {hasOpenQs && <th>Corrección</th>}
                </tr>
              </thead>
              <tbody>
                {(attempts ?? []).map((att: any) => {
                  const student = att.profiles
                  return (
                    <tr key={att.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: '#642f8d' }}>
                            {`${student?.first_name?.[0]}${student?.last_name?.[0]}`.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{student?.first_name} {student?.last_name}</p>
                            <p className="text-xs text-gray-400">{student?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-gray-600 text-xs">{formatDateTime(att.started_at)}</td>
                      <td className="text-gray-600">{formatDuration(att.time_taken_sec)}</td>
                      <td>
                        {att.score != null
                          ? <ScoreBar score={att.score} />
                          : <span className="text-gray-400 text-sm">—</span>
                        }
                      </td>
                      <td>
                        <Badge variant={
                          att.status === 'graded'      ? 'green' :
                          att.status === 'submitted'   ? 'amber' :
                          att.status === 'in_progress' ? 'blue'  : 'gray'
                        }>
                          {ATTEMPT_STATUS_LABEL[att.status as keyof typeof ATTEMPT_STATUS_LABEL] ?? att.status}
                        </Badge>
                      </td>
                      {hasOpenQs && (
                        <td>
                          {att.status === 'submitted' ? (
                            <a href={`/coordinator/results/${att.id}`} className="text-xs font-medium" style={{ color: '#642f8d' }}>
                              Corregir →
                            </a>
                          ) : att.status === 'graded' ? (
                            <a href={`/coordinator/results/${att.id}`} className="text-xs text-gray-400 hover:text-gray-600">
                              Ver detalle
                            </a>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  )
}
