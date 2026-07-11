export const dynamic = 'force-dynamic'
export const revalidate = 0

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import ScoreBar from '@/components/ui/ScoreBar'
import Badge from '@/components/ui/Badge'
import AlertBanner from '@/components/ui/AlertBanner'
import DeleteEvaluationButton from '@/components/coordinator/DeleteEvaluationButton'
import { formatDate, formatDateTime, formatDuration, getEvalStatus, EVAL_STATUS_LABEL, ATTEMPT_STATUS_LABEL, EVAL_TYPE_LABEL } from '@/lib/utils'

export const metadata = { title: 'Evaluación' }

// ── Etiqueta legible por tipo de pregunta ──────────────────────────────────
function qTypeLabel(type: string) {
  const map: Record<string, string> = {
    multiple_choice: 'Opción múltiple',
    true_false:      'Verdadero / Falso',
    short_answer:    'Respuesta abierta',
    essay:           'Respuesta abierta',
    speaking:        'Speaking',
    word_order:      'Ordenar palabras',
    match:           'Relacionar',
    fill_blank:      'Completar',
  }
  return map[type] ?? type
}

// ── Badge colorido por tipo ────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    multiple_choice: 'bg-blue-50 text-blue-700 border-blue-200',
    true_false:      'bg-indigo-50 text-indigo-700 border-indigo-200',
    short_answer:    'bg-amber-50 text-amber-700 border-amber-200',
    essay:           'bg-amber-50 text-amber-700 border-amber-200',
    speaking:        'bg-rose-50 text-rose-700 border-rose-200',
    word_order:      'bg-teal-50 text-teal-700 border-teal-200',
    match:           'bg-cyan-50 text-cyan-700 border-cyan-200',
    fill_blank:      'bg-orange-50 text-orange-700 border-orange-200',
  }
  const cls = styles[type] ?? 'bg-gray-50 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {qTypeLabel(type)}
    </span>
  )
}

// ── Renderiza el enunciado según el tipo ───────────────────────────────────
// Para word_order y match el body es "word / word / word", lo mostramos como chips
function QuestionBody({ body, type }: { body: string; type: string }) {
  if ((type === 'word_order' || type === 'match') && body.includes('/')) {
    const words = body.split('/').map(w => w.trim()).filter(Boolean)
    return (
      <div className="flex flex-wrap gap-1.5 mb-3">
        {words.map((w, i) => (
          <span key={i} className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-sm font-medium text-gray-700 border border-gray-200">
            {w}
          </span>
        ))}
      </div>
    )
  }
  return (
    <p className="text-sm font-medium text-gray-900 mb-3 leading-relaxed">{body}</p>
  )
}

export default async function TeacherEvaluationDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = await params
  const profile  = await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  const { data: ev } = await sb
    .from('evaluations')
    .select('*, cefr_levels(code, label)')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!ev) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-400 text-sm">Evaluación no encontrada.</p>
      </div>
    )
  }

  // Si es docente, sólo puede ver evaluaciones asignadas a cursos que él dicta.
  if (profile.role === 'teacher') {
    const { data: myCourses } = await sb
      .from('courses')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('teacher_id', profile.id)

    const myCourseIds = (myCourses ?? []).map((c: any) => c.id)

    let isAssignedToMe = false
    if (myCourseIds.length > 0) {
      const { data: ec } = await sb
        .from('evaluation_courses')
        .select('evaluation_id')
        .eq('evaluation_id', id)
        .in('course_id', myCourseIds)
      isAssignedToMe = (ec ?? []).length > 0
    }

    if (!isAssignedToMe) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-gray-400 text-sm">Evaluación no encontrada.</p>
        </div>
      )
    }
  }

  const [{ data: attempts }, { data: questions }, { data: assignedCourses }] = await Promise.all([
    sb.from('attempts')
      .select('*, profiles!attempts_student_id_fkey(first_name, last_name, email)')
      .eq('evaluation_id', id)
      .in('status', ['submitted', 'graded', 'in_progress', 'timed_out'])
      .order('submitted_at', { ascending: false }),
    sb.from('questions')
      .select('id, q_type, body, points, sort_order, explanation, options(id, body, is_correct, sort_order)')
      .eq('evaluation_id', id)
      .order('sort_order'),
    sb.from('evaluation_courses')
      .select('courses(id, name, cefr_levels(code))')
      .eq('evaluation_id', id),
  ])

  const sortedQuestions = (questions ?? [])
    .slice()
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((q: any) => ({
      ...q,
      options: (q.options ?? []).slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    }))

  const completedAtts = (attempts ?? []).filter((a: any) => ['submitted', 'graded'].includes(a.status))
  const pendingGrade  = completedAtts.filter((a: any) => a.status === 'submitted')
  const avgScore      = completedAtts.length
    ? Math.round(completedAtts.reduce((acc: number, a: any) => acc + (a.score ?? 0), 0) / completedAtts.length)
    : null
  const passCount = completedAtts.filter((a: any) => a.passed).length
  const hasOpenQs = (questions ?? []).some((q: any) => ['short_answer', 'essay'].includes(q.q_type))
  const st        = getEvalStatus({ status: ev.status, available_until: ev.available_until })

  const BADGE: Record<string, 'purple' | 'green' | 'amber' | 'gray' | 'blue'> = {
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
            <a href={`/teacher/evaluations/${id}/assets`} className="btn-outline text-sm">
              📎 Archivos
            </a>
            <DeleteEvaluationButton evalId={id} status={ev.status} title={ev.title} backHref="/teacher/evaluations" />
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
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Cursos asignados</h2>
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
                  <span key={course.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700">
                    {course.cefr_levels?.code && (
                      <span className={`cefr-pill cefr-${course.cefr_levels.code} text-[10px] py-0`}>
                        {course.cefr_levels.code}
                      </span>
                    )}
                    {course.name}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Vista previa del examen */}
        <details className="card p-0 overflow-hidden group">
          <summary className="cursor-pointer list-none px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Vista previa del examen</h2>
              <span className="text-xs text-gray-400">({sortedQuestions.length} pregunta{sortedQuestions.length !== 1 ? 's' : ''})</span>
            </div>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}
              className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180">
              <path d="M5 7.5L10 12.5L15 7.5" />
            </svg>
          </summary>

          <div className="p-5 space-y-4 bg-gray-50">
            {sortedQuestions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Esta evaluación todavía no tiene preguntas cargadas.</p>
            ) : (
              sortedQuestions.map((q: any, idx: number) => {
                const isObj = ['multiple_choice', 'true_false'].includes(q.q_type)
                return (
                  <div key={q.id} className="card bg-white">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white flex-shrink-0"
                          style={{ background: '#642f8d' }}
                        >
                          {idx + 1}
                        </span>
                        <TypeBadge type={q.q_type} />
                      </div>
                      <span className="text-xs font-medium text-gray-400">
                        {q.points} pt{q.points !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <QuestionBody body={q.body} type={q.q_type} />

                    {/* Opciones — objetiva */}
                    {isObj && q.options?.length > 0 && (
                      <div className="space-y-1.5">
                        {q.options.map((opt: any) => (
                          <div key={opt.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                            opt.is_correct ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'
                          }`}>
                            <span className={`text-xs font-medium ${opt.is_correct ? 'text-green-700' : 'text-gray-400'}`}>
                              {opt.is_correct ? '✓' : '·'}
                            </span>
                            <span className={opt.is_correct ? 'text-green-800' : 'text-gray-600'}>
                              {opt.body}
                            </span>
                            {opt.is_correct && (
                              <span className="ml-auto text-xs text-green-700">Correcta</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Respuesta abierta / speaking — sin respuesta modelo, solo aviso */}
                    {['short_answer', 'essay'].includes(q.q_type) && (
                      <p className="text-xs text-gray-400 italic">Requiere corrección manual del docente.</p>
                    )}
                    {q.q_type === 'speaking' && (
                      <p className="text-xs text-gray-400 italic">El alumno responde con grabación de audio.</p>
                    )}

                    {q.explanation && (
                      <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                        <p className="text-[10px] font-medium text-blue-500 uppercase tracking-wide mb-0.5">Explicación</p>
                        <p className="text-xs text-blue-700 leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </details>

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
                  <th>Corrección</th>
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
                            {`${student?.first_name?.[0] ?? ''}${student?.last_name?.[0] ?? ''}`.toUpperCase()}
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
                      <td>
                        {att.status === 'submitted' ? (
                          <a href={`/teacher/results/${att.id}`} className="text-xs font-medium" style={{ color: '#642f8d' }}>
                            Corregir →
                          </a>
                        ) : att.status === 'graded' ? (
                          <a href={`/teacher/results/${att.id}`} className="text-xs text-gray-400 hover:text-gray-600">
                            Ver detalle
                          </a>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
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
