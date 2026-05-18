// app/results/page.tsx
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { getStudentAttempts } from '@/services/attempts'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import TopBar from '@/components/layout/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { formatDateTime, formatScore, scoreColor, formatDuration } from '@/lib/utils'

export const metadata = { title: 'Mis notas' }

export default async function ResultsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'student') redirect('/')

  const { data: attempts } = await getStudentAttempts(profile.id)

  // ✅ timed_out se muestra al alumno pero NO entra en el promedio
  // El promedio solo considera intentos con score real (submitted/graded)
  const done      = attempts.filter(a => ['submitted', 'graded'].includes(a.status))
  const timedOut  = attempts.filter(a => a.status === 'timed_out')
  const allShown  = [...done, ...timedOut]
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

  const avgScore = done.filter(a => a.score != null).length
    ? Math.round(
        done
          .filter(a => a.score != null)
          .reduce((acc, b) => acc + (b.score ?? 0), 0) /
        done.filter(a => a.score != null).length
      )
    : null

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* Sidebar — solo desktop */}
      <div className="hidden md:block">
        <Sidebar
          role="student"
          name={`${profile.first_name} ${profile.last_name}`}
          email={profile.email}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          title="Mis notas"
          subtitle={`${done.length} evaluación${done.length !== 1 ? 'es' : ''} completada${done.length !== 1 ? 's' : ''}`}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 space-y-4 md:space-y-5 max-w-3xl mx-auto w-full">

          {/* ── Stats rápidas ── */}
          {done.length > 0 && (
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              <div className="card-sm text-center">
                <p className="text-xl md:text-2xl font-semibold text-gray-900">{done.length}</p>
                <p className="text-xs text-gray-500">Completadas</p>
              </div>
              <div className="card-sm text-center">
                <p className={`text-xl md:text-2xl font-semibold ${scoreColor(avgScore)}`}>
                  {formatScore(avgScore)}
                </p>
                <p className="text-xs text-gray-500">Promedio</p>
              </div>
              <div className="card-sm text-center">
                <p className="text-xl md:text-2xl font-semibold text-green-700">
                  {done.filter(a => a.passed).length}
                </p>
                <p className="text-xs text-gray-500">Aprobadas</p>
              </div>
            </div>
          )}

          {/* ── Lista de intentos ── */}
          {allShown.length === 0 ? (
            <EmptyState
              title="Sin resultados aún"
              description="Completá tu primer examen para ver tus notas aquí."
            />
          ) : (
            <div className="space-y-3">
              {allShown.map(attempt => {
                const ev = (attempt as any).evaluations
                const isPending   = attempt.status === 'submitted'
                const isTimedOut  = attempt.status === 'timed_out'

                return (
                  // ✅ Card clickeable → detalle de respuestas y feedback
                  <a
                    key={attempt.id}
                    href={`/exam/results/${attempt.id}`}
                    className="card flex items-center gap-3 md:gap-4 hover:shadow-md transition-shadow group"
                  >
                    {/* Ícono resultado */}
                    <div
                      className="flex h-11 w-11 md:h-12 md:w-12 flex-shrink-0 items-center justify-center rounded-xl text-white font-bold text-lg"
                      style={{
                        background: isTimedOut
                          ? '#6b7280'
                          : isPending
                            ? '#d97706'
                            : attempt.passed ? '#16a34a' : '#dc2626'
                      }}
                    >
                      {isTimedOut ? '⏰' : isPending ? '⏳' : attempt.passed ? '✓' : '✕'}
                    </div>

                    {/* Contenido */}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 truncate text-sm md:text-base">
                        {ev?.title ?? 'Evaluación'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1 text-xs text-gray-400">
                        <span>{formatDateTime(attempt.submitted_at)}</span>
                        {attempt.time_taken_sec && (
                          <span>⏱ {formatDuration(attempt.time_taken_sec)}</span>
                        )}
                        {!isPending && !isTimedOut && (
                          <span className={`font-medium ${scoreColor(attempt.score)}`}>
                            {formatScore(attempt.score)}
                          </span>
                        )}
                      </div>
                      {/* Feedback del docente — preview */}
                      {attempt.teacher_feedback && (
                        <p className="mt-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1 truncate">
                          💬 {attempt.teacher_feedback}
                        </p>
                      )}
                      {isPending && (
                        <p className="mt-1 text-xs text-amber-600">
                          ⏳ Pendiente de corrección por el docente
                        </p>
                      )}
                      {isTimedOut && (
                        <p className="mt-1 text-xs text-gray-500">
                          ⏰ El tiempo se agotó antes de completar el examen
                        </p>
                      )}
                    </div>

                    {/* Badge + flecha */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`badge ${
                        isTimedOut
                          ? 'badge-gray'
                          : isPending
                            ? 'badge-amber'
                            : attempt.passed ? 'badge-green' : 'badge-red'
                      }`}>
                        {isTimedOut ? 'Tiempo agotado' : isPending ? 'Pendiente' : attempt.passed ? 'Aprobado' : 'Desaprobado'}
                      </span>
                      <span className="text-xs text-gray-400 group-hover:text-purple-600 transition-colors">
                        Ver detalle →
                      </span>
                    </div>
                  </a>
                )
              })}
            </div>
          )}

        </main>
      </div>

      {/* ✅ MobileNav — navegación inferior en mobile */}
      <MobileNav />
    </div>
  )
}
