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
import ReopenAttemptButton from '@/components/coordinator/ReopenAttemptButton'
import ExtendAvailabilityButton from '@/components/coordinator/ExtendAvailabilityButton'
import PublishResultsButton from '@/components/coordinator/PublishResultsButton'
import MaxAttemptsEditor from '@/components/coordinator/MaxAttemptsEditor'

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
      .select('*, results_published_at, profiles!attempts_student_id_fkey(first_name, last_name, email)')
      .eq('evaluation_id', id)
      // 'flagged' = entregado automáticamente por el anti-trampa (3 cambios de
      // pestaña). Faltaba en este filtro y por eso esos intentos desaparecían
      // por completo de esta pantalla, aunque siguieran existiendo en la base.
      .in('status', ['submitted', 'graded', 'in_progress', 'timed_out', 'flagged'])
      .order('submitted_at', { ascending: false }),
    sb.from('questions').select('id, q_type, body, points, sort_order, options(id, body, is_correct)').eq('evaluation_id', id).order('sort_order'),
    sb.from('evaluation_courses')
      .select('courses(id, name, cefr_levels(code))')
      .eq('evaluation_id', id),
  ])

  if (!ev) return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-gray-400">Evaluación no encontrada.</p>
    </div>
  )

  const now            = new Date()
  const availFrom      = ev.available_from ? new Date(ev.available_from) : null
  const notStartedYet  = availFrom ? availFrom > now : false
  const attemptCount   = (attempts ?? []).filter((a: any) => ['submitted','graded','in_progress','flagged'].includes(a.status)).length
  const canEdit        = ev.status === 'draft' || (ev.status === 'published' && notStartedYet && attemptCount === 0)
  const st             = getEvalStatus({ status: ev.status, available_from: ev.available_from, available_until: ev.available_until })
  const completedAtts  = (attempts ?? []).filter((a: any) => ['submitted','graded'].includes(a.status))
  const pendingGrade   = completedAtts.filter((a: any) => a.status === 'submitted')
  const pendingPublish = completedAtts.filter((a: any) => a.status === 'graded' && !a.results_published_at)
  const avgScore       = completedAtts.length
    ? Math.round(completedAtts.reduce((acc: number, a: any) => acc + (a.score ?? 0), 0) / completedAtts.length)
    : null
  const passCount      = completedAtts.filter((a: any) => a.passed).length
  const hasOpenQs      = (questions ?? []).some((q: any) => ['short_answer','essay'].includes(q.q_type))

  const BADGE: Record<string, 'purple'|'green'|'amber'|'gray'|'blue'> = {
    active: 'purple', upcoming: 'amber', closed: 'green', draft: 'gray', published: 'blue',
  }

  const Q_TYPE_LABEL: Record<string, string> = {
    multiple_choice: 'Opción múltiple', true_false: 'Verdadero/Falso',
    short_answer: 'Respuesta corta', essay: 'Desarrollo', speaking: 'Speaking',
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title={ev.title}
        subtitle={`${EVAL_TYPE_LABEL[ev.eval_type]} · ${ev.cefr_levels?.code ?? 'Sin nivel'}`}
        actions={
          <div className="flex gap-2">
            <Badge variant={BADGE[st] ?? 'gray'}>{EVAL_STATUS_LABEL[st]}</Badge>
            {canEdit && (
              <a
                href={`/coordinator/evaluations/${id}/edit`}
                className="btn-outline text-sm"
              >
                ✏️ Editar
              </a>
            )}
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
              { label: 'Vence',         value: formatDate(ev.available_until), extend: true },
              { label: 'Preguntas',     value: (questions ?? []).length },
              { label: 'Max intentos',  value: ev.max_attempts, editable: true },
            ].map(({ label, value, editable, extend }: any) => (
              <div key={label} className={extend ? 'col-span-2' : ''}>
                <p className="text-xs text-gray-400">{label}</p>
                {editable
                  ? <MaxAttemptsEditor evalId={id} value={value} />
                  : <p className="font-medium text-gray-900">{String(value)}</p>
                }
                {extend && (
                  <div className="mt-1.5">
                    <ExtendAvailabilityButton evalId={id} currentUntil={ev.available_until} isClosed={st === 'closed'} />
                  </div>
                )}
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

        {pendingPublish.length > 0 && (
          <AlertBanner type="warn">
            <strong>{pendingPublish.length} resultado{pendingPublish.length > 1 ? 's' : ''}</strong> ya corregido{pendingPublish.length > 1 ? 's' : ''} esperando publicación — el alumno no los ve hasta que los publiques.
          </AlertBanner>
        )}

        {/* Contenido del examen — antes esta pantalla solo mostraba el conteo
            de preguntas ("Preguntas: 40") pero nunca el armado en sí. Para
            verlo había que entrar a "Editar", que en evaluaciones publicadas
            con intentos ya rendidos queda bloqueado y rebota de nuevo acá,
            sin explicación. Esta vista es de solo lectura, disponible siempre,
            sea borrador o publicada. */}
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Contenido del examen ({(questions ?? []).length} pregunta{(questions ?? []).length !== 1 ? 's' : ''})
          </h2>
          {(!questions || questions.length === 0) ? (
            <p className="text-sm text-gray-400">Esta evaluación todavía no tiene preguntas cargadas.</p>
          ) : (
            <div className="space-y-4">
              {questions.map((q: any, i: number) => (
                <div key={q.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-semibold text-gray-400 mt-0.5">{i + 1}.</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="badge badge-gray text-[10px]">
                          {Q_TYPE_LABEL[q.q_type] ?? q.q_type}
                        </span>
                        <span className="text-xs text-gray-400">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                      </div>
                      <p className="text-sm text-gray-900">{q.body}</p>
                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {q.options.map((o: any) => (
                            <li
                              key={o.id}
                              className={`text-xs pl-3 ${o.is_correct ? 'text-green-700 font-medium' : 'text-gray-500'}`}
                            >
                              {o.is_correct ? '✓ ' : '· '}{o.body}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
                  <th>Acciones</th>
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
                          att.status === 'in_progress' ? 'blue'  :
                          att.status === 'flagged'     ? 'red'   : 'gray'
                        }>
                          {att.status === 'flagged' ? '🚩 ' : ''}{ATTEMPT_STATUS_LABEL[att.status as keyof typeof ATTEMPT_STATUS_LABEL] ?? att.status}
                        </Badge>
                        {att.status === 'graded' && !att.results_published_at && (
                          <span className="block mt-1 text-[10px] font-medium text-amber-600">⏳ Sin publicar</span>
                        )}
                      </td>
                      {hasOpenQs && (
                        <td>
                          {/* 'timed_out' y 'flagged' también quedan con respuestas
                              guardadas y pueden necesitar corrección manual — antes
                              solo 'submitted'/'graded' mostraban el link. */}
                          {['submitted','timed_out','flagged'].includes(att.status) ? (
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
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          {att.status === 'graded' && !att.results_published_at && (
                            <PublishResultsButton
                              attemptId={att.id}
                              studentName={`${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim()}
                            />
                          )}
                          {att.status !== 'in_progress' && (
                            <ReopenAttemptButton attemptId={att.id} studentName={`${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim()} />
                          )}
                        </div>
                      </td>
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
