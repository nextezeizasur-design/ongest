// RUTA: app/coordinator/teachers/page.tsx
// Comparativa entre docentes: promedio de grupo, alumnos en riesgo y tasa de aprobación.
// Reusa v_student_stats (misma vista que ya usa Director/Alumnos) — cero SQL nuevo.

export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import ScoreBar from '@/components/ui/ScoreBar'
import EmptyState from '@/components/ui/EmptyState'
import { formatScore, scoreColor } from '@/lib/utils'

export const metadata = { title: 'Comparativa de docentes' }

interface TeacherRow {
  id:            string
  name:          string
  coursesCount:  number
  studentsCount: number
  avgScore:      number | null
  atRiskCount:   number
  passRate:      number | null
}

export default async function CoordinatorTeachersPage() {
  const profile  = await requireRole(['director', 'coordinator'] as any)
  const orgId    = profile.organization_id
  const supabase = await createClient()
  const sb       = supabase as any

  // 1. Docentes activos de la org (role_id 5 = teacher)
  const { data: teachers } = await sb
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('organization_id', orgId)
    .eq('role_id', 5)
    .eq('is_active', true)
    .order('first_name')

  const teacherList = teachers ?? []

  if (teacherList.length === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Comparativa de docentes" subtitle="Promedio de grupo, riesgo y aprobación por docente" />
        <main className="flex-1 overflow-y-auto p-6">
          <EmptyState title="Sin docentes cargados" description="Todavía no hay docentes activos en el instituto." />
        </main>
      </div>
    )
  }

  const teacherNameById: Record<string, string> = {}
  for (const t of teacherList) teacherNameById[t.id] = `${t.first_name} ${t.last_name}`

  // 2. Cursos activos con su docente asignado
  const { data: courses } = await sb
    .from('courses')
    .select('id, teacher_id')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .not('teacher_id', 'is', null)

  const courseToTeacher: Record<string, string> = {}
  for (const c of courses ?? []) courseToTeacher[c.id] = c.teacher_id

  const courseIds = Object.keys(courseToTeacher)

  // 3. Stats de alumnos (misma vista que usa Director) filtrada a esos cursos
  const { data: studentStats } = courseIds.length > 0
    ? await sb
        .from('v_student_stats')
        .select('id, course_id, avg_score, total_attempts, passed_count')
        .eq('organization_id', orgId)
        .in('course_id', courseIds)
    : { data: [] }

  // 4. Agregar por docente
  const byTeacher: Record<string, {
    studentIds: Set<string>
    scores:     number[]
    atRisk:     number
    attempts:   number
    passed:     number
    courseIds:  Set<string>
  }> = {}

  for (const t of teacherList) {
    byTeacher[t.id] = {
      studentIds: new Set(),
      scores: [],
      atRisk: 0,
      attempts: 0,
      passed: 0,
      courseIds: new Set(),
    }
  }

  for (const s of studentStats ?? []) {
    const teacherId = courseToTeacher[s.course_id]
    if (!teacherId || !byTeacher[teacherId]) continue

    const bucket = byTeacher[teacherId]
    bucket.studentIds.add(s.id)
    bucket.courseIds.add(s.course_id)
    bucket.attempts += s.total_attempts ?? 0
    bucket.passed   += s.passed_count ?? 0
    if (s.avg_score != null) bucket.scores.push(s.avg_score)
    if ((s.avg_score ?? 100) < 60 && (s.total_attempts ?? 0) > 0) bucket.atRisk++
  }

  const rows: TeacherRow[] = teacherList.map((t: any) => {
    const b = byTeacher[t.id]
    return {
      id:            t.id,
      name:          teacherNameById[t.id],
      coursesCount:  b.courseIds.size,
      studentsCount: b.studentIds.size,
      avgScore:      b.scores.length > 0
        ? Math.round(b.scores.reduce((a, s) => a + s, 0) / b.scores.length)
        : null,
      atRiskCount:   b.atRisk,
      passRate:      b.attempts > 0 ? Math.round((b.passed / b.attempts) * 100) : null,
    }
  })

  // Ordenar por promedio descendente (los que necesitan más atención, al final)
  rows.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1))

  const orgAvg = rows.filter(r => r.avgScore != null).length > 0
    ? Math.round(
        rows.filter(r => r.avgScore != null).reduce((a, r) => a + (r.avgScore ?? 0), 0) /
        rows.filter(r => r.avgScore != null).length
      )
    : null

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Comparativa de docentes"
        subtitle={`${rows.length} docente${rows.length !== 1 ? 's' : ''} · Promedio institucional ${formatScore(orgAvg)}`}
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-4">

          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Docente</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Cursos</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Alumnos</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Promedio de grupo</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Aprobación</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">En riesgo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: '#642f8d' }}
                        >
                          {r.name[0]}
                        </div>
                        <p className="font-medium text-gray-900">{r.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{r.coursesCount}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{r.studentsCount}</td>
                    <td className="px-4 py-3">
                      {r.avgScore != null ? (
                        <ScoreBar score={r.avgScore} width="w-28" />
                      ) : (
                        <span className="text-gray-300">Sin datos</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.passRate != null ? (
                        <span className={`font-semibold ${scoreColor(r.passRate)}`}>{r.passRate}%</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {r.atRiskCount > 0 ? (
                        <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                          {r.atRiskCount}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 px-1">
            El promedio de grupo se calcula solo sobre intentos corregidos (excluye exámenes vencidos sin corregir).
            Ordenado de mayor a menor promedio.
          </p>

        </div>
      </main>
    </div>
  )
}
