import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import TopBar from '@/components/layout/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, daysUntil, EVAL_TYPE_LABEL } from '@/lib/utils'
import type { Attempt } from '@/types'

export const metadata = { title: 'Mis exámenes' }

export default async function ExamListPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!['student'].includes(profile.role)) {
    const home: Record<string, string> = {
      director:    '/director',
      coordinator: '/coordinator',
      secretary:   '/secretary',
      teacher:     '/teacher',
    }
    redirect(home[profile.role] ?? '/teacher')
  }
  const supabase = await createClient()

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('courses(id, name, cefr_levels(code, label), schedule_days, schedule_time)')
    .eq('student_id', profile.id)
    .maybeSingle()

  const studentCourse = (enrollment as any)?.courses ?? null

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('student_id', profile.id)

  const courseIds = (enrollments ?? []).map(e => e.course_id)

  let evaluations: any[] = []
  if (courseIds.length > 0) {
    const { data } = await supabase
      .from('evaluation_courses')
      .select('evaluation_id, evaluations!inner(*, cefr_levels(code, label))')
      .in('course_id', courseIds)
      .eq('evaluations.status', 'published')
    evaluations = (data ?? []).map(r => r.evaluations)
  }

  const { data: attemptsData } = await supabase
    .from('attempts')
    .select('*')
    .eq('student_id', profile.id)

  const byEval: Record<string, Attempt[]> = {}
  ;(attemptsData ?? []).forEach((a: any) => {
    if (!byEval[a.evaluation_id]) byEval[a.evaluation_id] = []
    byEval[a.evaluation_id].push(a)
  })

  const now = new Date()

  // ── FILTRAR evaluaciones que ya están corregidas (graded) ──
  // Si todos los intentos completados tienen status 'graded', el examen ya fue
  // corregido → no aparece en "Mis exámenes", solo en "Mis notas"
  const pendingEvaluations = evaluations.filter((ev: any) => {
    const attempts   = byEval[ev.id] ?? []
    const completed  = attempts.filter(a =>
      ['submitted', 'graded', 'timed_out', 'flagged'].includes(a.status)
    )
    const inProgress = attempts.find(a => a.status === 'in_progress')

    // Si hay un intento en curso → siempre mostrar
    if (inProgress) return true

    // Si no hay intentos → mostrar (para que pueda comenzar)
    if (completed.length === 0) return true

    // Si TODOS los intentos completados están graded → ocultar (ya corregido)
    const allGraded = completed.every(a => a.status === 'graded')
    if (allGraded) return false

    // Si hay alguno submitted (pendiente de corrección) → mostrar con badge "Pendiente"
    return true
  })

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      <div className="hidden md:block">
        <Sidebar role="student" name={`${profile.first_name} ${profile.last_name}`} email={profile.email} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          title="Mis exámenes"
          subtitle={`${pendingEvaluations.length} disponible${pendingEvaluations.length !== 1 ? 's' : ''}`}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 space-y-4">

          {/* Curso asignado */}
          {studentCourse && (
            <div className="card flex items-center gap-3 md:gap-4">
              <div className="flex h-10 w-10 md:h-12 md:w-12 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: '#f5eefb' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#642f8d" strokeWidth={1.5} className="h-5 w-5 md:h-6 md:w-6">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm md:text-base">{studentCourse.name}</p>
                  {studentCourse.cefr_levels && (
                    <span className={`cefr-pill cefr-${studentCourse.cefr_levels.code}`}>
                      {studentCourse.cefr_levels.code}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {studentCourse.schedule_days && (
                    <span className="text-xs text-gray-500">📅 {studentCourse.schedule_days}</span>
                  )}
                  {studentCourse.schedule_time && (
                    <span className="text-xs text-gray-500">🕐 {studentCourse.schedule_time}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {pendingEvaluations.length === 0 ? (
            <EmptyState
              title="No hay exámenes pendientes"
              description="Todos tus exámenes fueron corregidos. Revisá tus notas en 'Mis notas'."
            />
          ) : (
            <div className="space-y-3 md:max-w-2xl md:mx-auto">
              {pendingEvaluations.map((ev: any) => {
                const attempts   = byEval[ev.id] ?? []
                const completed  = attempts.filter(a => ['submitted','graded','timed_out','flagged'].includes(a.status))
                const inProgress = attempts.find(a => a.status === 'in_progress')
                const best       = completed.sort((a,b) => (b.score??0)-(a.score??0))[0]
                const isExpired  = ev.available_until && new Date(ev.available_until) < now
                const days       = daysUntil(ev.available_until)

                const maxAttempts  = ev.max_attempts ?? null
                const attemptsUsed = completed.length
                const limitReached = maxAttempts !== null && attemptsUsed >= maxAttempts
                const hasSubmitted = completed.length > 0
                const pendingGrade = completed.some(a => a.status === 'submitted' && a.score === null)
                const hasOpenQuestions = ['open','mixed','speaking','listening'].includes(ev.eval_type)

                function StatusBadge({ mobile = false }: { mobile?: boolean }) {
                  if (isExpired) return <span className="badge badge-gray">Cerrado</span>
                  if (inProgress) return null
                  if (limitReached) {
                    if (pendingGrade || (hasOpenQuestions && best?.score === null)) return (
                      <span className="badge badge-amber">📬 Entregado · Pendiente</span>
                    )
                    const score = best?.score ?? 0
                    return (
                      <span className={`badge ${score >= ev.pass_score ? 'badge-green' : 'badge-red'}`}>
                        {score >= ev.pass_score ? '✓ Aprobado' : '✗ Desaprobado'} · {Math.round(score)}%
                      </span>
                    )
                  }
                  return null
                }

                return (
                  <div
                    key={ev.id}
                    className={`card transition-shadow hover:shadow-sm ${isExpired ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-3 md:items-center md:gap-4">

                      {/* Icono */}
                      <div
                        className="flex h-10 w-10 md:h-12 md:w-12 flex-shrink-0 items-center justify-center rounded-xl text-white"
                        style={{
                          background: completed.length > 0 && (best?.score??0) >= ev.pass_score
                            ? '#16a34a'
                            : isExpired ? '#9ca3af' : '#642f8d'
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5 md:h-6 md:w-6">
                          <rect x="4" y="2" width="16" height="20" rx="2"/>
                          <path d="M9 7h6M9 11h4M9 15h3"/>
                        </svg>
                      </div>

                      {/* Contenido */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                          <h3 className="text-sm md:text-base font-semibold text-gray-900 w-full md:w-auto">
                            {ev.title}
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
                            {ev.cefr_levels && (
                              <span className={`cefr-pill cefr-${ev.cefr_levels.code}`}>{ev.cefr_levels.code}</span>
                            )}
                            <span className="badge badge-gray text-xs">{EVAL_TYPE_LABEL[ev.eval_type]}</span>
                            {ev.is_adaptive && (
                              <span className="badge text-xs" style={{ backgroundColor: '#f5eefb', color: '#642f8d' }}>
                                🧠 Adaptativo
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Métricas */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                          {ev.time_limit_min && <span>⏱ {ev.time_limit_min} min</span>}
                          {!isExpired && days !== null && (
                            <span className={days <= 2 ? 'font-semibold text-red-600' : ''}>
                              {days === 0 ? '⚠ Vence hoy' : `Vence en ${days}d`}
                            </span>
                          )}
                          {isExpired && <span>Cerrado · {formatDate(ev.available_until)}</span>}
                          {best && (
                            <span className={`font-medium ${(best.score??0) >= ev.pass_score ? 'text-green-600' : 'text-red-600'}`}>
                              Mejor nota: {Math.round(best.score ?? 0)}%
                            </span>
                          )}
                          {attempts.length > 0 && (
                            <span>{attempts.length} intento{attempts.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>

                        {/* Botón mobile */}
                        <div className="mt-3 md:hidden">
                          {(isExpired || limitReached) && !inProgress ? (
                            <StatusBadge mobile />
                          ) : (
                            <a
                              href={ev.is_adaptive ? `/exam/adaptive/${ev.id}` : `/exam/${ev.id}`}
                              className="inline-flex items-center justify-center w-full py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: '#642f8d' }}
                            >
                              {inProgress ? 'Continuar →' : hasSubmitted ? 'Reintentar →' : 'Comenzar →'}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Botón desktop */}
                      <div className="hidden md:block flex-shrink-0">
                        {(isExpired || limitReached) && !inProgress ? (
                          <StatusBadge />
                        ) : (
                          <a
                            href={ev.is_adaptive ? `/exam/adaptive/${ev.id}` : `/exam/${ev.id}`}
                            className="btn-brand"
                          >
                            {inProgress ? 'Continuar →' : hasSubmitted ? 'Reintentar →' : 'Comenzar →'}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Enlace a Mis notas si hay exámenes ya corregidos */}
          {evaluations.length > pendingEvaluations.length && (
            <div className="md:max-w-2xl md:mx-auto">
              <a
                href="/results"
                className="flex items-center justify-between w-full card hover:shadow-sm transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: '#f5eefb' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#642f8d" strokeWidth={1.5} className="h-5 w-5">
                      <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {evaluations.length - pendingEvaluations.length} examen{evaluations.length - pendingEvaluations.length !== 1 ? 'es' : ''} corregido{evaluations.length - pendingEvaluations.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-400">Ver notas y feedback del docente</p>
                  </div>
                </div>
                <span className="text-purple-600 text-sm group-hover:translate-x-1 transition-transform">
                  Ver notas →
                </span>
              </a>
            </div>
          )}

        </main>
      </div>

      <MobileNav />
    </div>
  )
}
