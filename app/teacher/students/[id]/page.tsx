import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import StudentRadarCard from '@/components/shared/StudentRadarCard'
import ReportButton from '@/components/shared/ReportButton'
import RecommendationsList from '@/components/shared/RecommendationsList'
import { formatDate, formatScore } from '@/lib/utils'

export const metadata = { title: 'Detalle del alumno' }

export default async function TeacherStudentDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: studentId } = await params
  await requireRole(['director', 'coordinator', 'teacher'] as any)

  const supabase = await createClient()
  const sb       = supabase as any

  // Datos del alumno
  const { data: student } = await sb
    .from('profiles')
    .select(`
      id, first_name, last_name, email, is_active,
      enrollments(
        courses(id, name, cefr_levels(code, label), schedule_days, schedule_time)
      )
    `)
    .eq('id', studentId)
    .single()

  if (!student) redirect('/teacher')

  const course = student.enrollments?.[0]?.courses ?? null

  // Intentos del alumno
  const { data: attempts } = await sb
    .from('attempts')
    .select(`
      id, score, passed, status, submitted_at, started_at,
      evaluations(id, title, pass_score, eval_type)
    `)
    .eq('student_id', studentId)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(20)

  // Stats generales
  const completedAttempts = (attempts ?? []).filter((a: any) => a.submitted_at)
  const passedAttempts    = completedAttempts.filter((a: any) => a.passed)
  const avgScore          = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((s: number, a: any) => s + (a.score ?? 0), 0) / completedAttempts.length)
    : null

  // Último intento
  const lastAttempt = completedAttempts[0] ?? null

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title={`${student.first_name} ${student.last_name}`}
        subtitle={student.email}
        actions={
          <div className="flex items-center gap-2">
            <ReportButton studentId={studentId} size="sm" />
            <a href="/teacher" className="btn-outline text-xs py-1.5">← Volver</a>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* Header del alumno */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: '#642f8d' }}
                >
                  {student.first_name[0]}{student.last_name[0]}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {student.first_name} {student.last_name}
                  </h2>
                  <p className="text-sm text-gray-500">{student.email}</p>
                  {course && (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-gray-600 font-medium">{course.name}</span>
                      {course.cefr_levels && (
                        <span className={`cefr-pill cefr-${course.cefr_levels.code}`}>
                          {course.cefr_levels.code}
                        </span>
                      )}
                      {course.schedule_days && (
                        <span className="text-xs text-gray-400">📅 {course.schedule_days}</span>
                      )}
                      {course.schedule_time && (
                        <span className="text-xs text-gray-400">🕐 {course.schedule_time}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                student.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {student.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          {/* Métricas rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'Evaluaciones',
                value: completedAttempts.length,
                color: 'text-gray-900',
              },
              {
                label: 'Aprobadas',
                value: passedAttempts.length,
                color: 'text-green-600',
              },
              {
                label: 'Promedio',
                value: avgScore != null ? `${avgScore}%` : '—',
                color: avgScore != null ? (avgScore >= 60 ? 'text-green-600' : 'text-red-600') : 'text-gray-400',
              },
              {
                label: 'Último examen',
                value: lastAttempt ? formatDate(lastAttempt.submitted_at) : '—',
                color: 'text-gray-700',
                small: true,
              },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                <p className={`font-bold ${m.small ? 'text-base' : 'text-2xl'} ${m.color}`}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Grid principal: radar + recomendaciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Radar de habilidades */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Radar de habilidades</h3>
              <StudentRadarCard
                studentId={studentId}
                studentName={`${student.first_name} ${student.last_name}`}
                compact={true}
              />
            </div>

            {/* Recomendaciones activas */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Recomendaciones activas</h3>
              <RecommendationsList
                studentId={studentId}
                compact={true}
                maxItems={4}
              />
            </div>
          </div>

          {/* Historial de evaluaciones */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Historial de evaluaciones</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {completedAttempts.length} evaluaciones completadas
              </p>
            </div>

            {completedAttempts.length === 0 ? (
              <div className="p-10 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-gray-500 text-sm">Sin evaluaciones completadas aún</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-gray-700">Evaluación</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Fecha</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Score</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Mínimo</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {completedAttempts.map((a: any) => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">
                          {a.evaluations?.title ?? 'Evaluación'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatDate(a.submitted_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${
                          (a.score ?? 0) >= (a.evaluations?.pass_score ?? 60)
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {a.score != null ? `${Math.round(a.score)}%` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">
                        {a.evaluations?.pass_score ?? 60}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          a.passed
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {a.passed ? 'Aprobado' : 'Desaprobado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/teacher/results/${a.id}`}
                          className="text-xs font-medium hover:underline"
                          style={{ color: '#642f8d' }}
                        >
                          Ver corrección →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
