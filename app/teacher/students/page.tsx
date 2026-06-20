// app/teacher/students/page.tsx
// Lista de alumnos del docente, agrupados por curso, con acceso al reporte PDF

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import Link from 'next/link'

export const dynamic   = 'force-dynamic'
export const revalidate = 0
export const metadata  = { title: 'Reporte de alumnos' }

export default async function TeacherStudentsPage() {
  const profile  = await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  // Cursos del docente
  const { data: courses } = await sb
    .from('courses')
    .select('id, name, cefr_levels(code, label), schedule_days, schedule_time')
    .eq('teacher_id', profile.id)
    .eq('is_active', true)
    .order('name')

  const courseIds = (courses ?? []).map((c: any) => c.id)

  // Alumnos inscriptos en esos cursos (2-step: fetch IDs first, then filter)
  const { data: enrollments } = courseIds.length > 0
    ? await sb
        .from('enrollments')
        .select(`
          course_id,
          profiles!enrollments_student_id_fkey(
            id, first_name, last_name, email, is_active
          )
        `)
        .in('course_id', courseIds)
    : { data: [] }

  // Intentos completados de esos alumnos para mostrar stats rápidas
  const studentIds = [...new Set((enrollments ?? []).map((e: any) => e.profiles?.id).filter(Boolean))]

  const { data: attempts } = studentIds.length > 0
    ? await sb
        .from('attempts')
        .select('student_id, score, passed, submitted_at')
        .in('student_id', studentIds)
        .not('submitted_at', 'is', null)
    : { data: [] }

  // Calcular stats por alumno
  const statsByStudent: Record<string, { total: number; passed: number; avg: number | null }> = {}
  for (const a of attempts ?? []) {
    if (!statsByStudent[a.student_id]) {
      statsByStudent[a.student_id] = { total: 0, passed: 0, avg: null }
    }
    statsByStudent[a.student_id].total++
    if (a.passed) statsByStudent[a.student_id].passed++
  }
  for (const sid of Object.keys(statsByStudent)) {
    const studentAttempts = (attempts ?? []).filter((a: any) => a.student_id === sid)
    const scores = studentAttempts.map((a: any) => a.score).filter((s: any) => s != null)
    statsByStudent[sid].avg = scores.length > 0
      ? Math.round(scores.reduce((acc: number, s: number) => acc + s, 0) / scores.length)
      : null
  }

  // Agrupar alumnos por curso
  const studentsByCourse: Record<string, any[]> = {}
  for (const e of enrollments ?? []) {
    if (!e.profiles) continue
    if (!studentsByCourse[e.course_id]) studentsByCourse[e.course_id] = []
    studentsByCourse[e.course_id].push(e.profiles)
  }

  const courseList = courses ?? []
  const totalStudents = studentIds.length

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Reporte de alumnos"
        subtitle={`${totalStudents} alumno${totalStudents !== 1 ? 's' : ''} en ${courseList.length} curso${courseList.length !== 1 ? 's' : ''}`}
      />

      <main className="flex-1 overflow-y-auto p-6">
        {courseList.length === 0 ? (
          <EmptyState
            title="Sin cursos asignados"
            description="El director o coordinación te asignará cursos próximamente."
          />
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {courseList.map((course: any) => {
              const students = studentsByCourse[course.id] ?? []
              return (
                <div key={course.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

                  {/* Header del curso */}
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📚</span>
                      <div>
                        <h2 className="font-bold text-gray-900">{course.name}</h2>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 flex-shrink-0">
                      {students.length} alumno{students.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Lista de alumnos */}
                  {students.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-sm text-gray-400">Sin alumnos inscriptos en este curso.</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Alumno</th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Exámenes</th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Aprobados</th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Promedio</th>
                          <th className="text-right px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {students.map((student: any) => {
                          const stats = statsByStudent[student.id] ?? { total: 0, passed: 0, avg: null }
                          return (
                            <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                    style={{ backgroundColor: '#642f8d' }}
                                  >
                                    {student.first_name?.[0]}{student.last_name?.[0]}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {student.first_name} {student.last_name}
                                    </p>
                                    <p className="text-xs text-gray-400">{student.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="font-semibold text-gray-700">{stats.total}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-semibold ${stats.passed > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                  {stats.passed}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {stats.avg != null ? (
                                  <span className={`font-bold ${stats.avg >= 60 ? 'text-green-600' : 'text-red-500'}`}>
                                    {stats.avg}%
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <Link
                                  href={`/teacher/students/${student.id}`}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-80"
                                  style={{ backgroundColor: '#642f8d' }}
                                >
                                  Ver reporte →
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
