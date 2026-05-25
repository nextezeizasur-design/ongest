// RUTA: app/coordinator/page.tsx
// Dashboard del coordinador — agrega heatmap de cohorte debajo de las stats existentes.

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard Coordinación' }

import { requireRole }     from '@/lib/auth'
import { createClient }    from '@/lib/supabase/server'
import { getEvaluationStats } from '@/services/evaluations'
import { getStudentStats }    from '@/services/students'
import TopBar     from '@/components/layout/TopBar'
import StatCard   from '@/components/ui/StatCard'
import CohortHeatmap from '@/components/coordinator/CohortHeatmap'
import { formatScore, formatDate, getEvalStatus, EVAL_STATUS_BADGE, EVAL_STATUS_LABEL, scoreColor } from '@/lib/utils'

export default async function CoordinatorDashboard() {
  const profile  = await requireRole(['director', 'coordinator'] as any)
  const orgId    = profile.organization_id
  const supabase = await createClient()
  const sb       = supabase as any

  const [{ data: evals }, { data: students }] = await Promise.all([
    getEvaluationStats(orgId),
    getStudentStats(orgId),
  ])

  const active    = evals.filter(e => getEvalStatus({ status: e.status, available_until: e.available_until }) === 'active').length
  const pending   = evals.filter(e => e.in_progress_count > 0).reduce((a, e) => a + e.in_progress_count, 0)
  const atRisk    = students.filter(s => (s.avg_score ?? 100) < 60 && s.total_attempts > 0).length
  const recentEvals = evals.slice(0, 6)

  // ── Datos para el heatmap ────────────────────────────────────────────────

  // 1. Alumnos con su curso
  const { data: enrollmentsRaw } = await sb
    .from('enrollments')
    .select(`
      student_id,
      courses ( id, name )
    `)

  // Filtrar perfiles de esta org
  const { data: profilesRaw } = await sb
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('organization_id', orgId)

  const profileMap = new Map((profilesRaw ?? []).map((p: any) => [p.id, p]))

  const heatmapStudents = (enrollmentsRaw ?? [])
    .filter((e: any) => profileMap.has(e.student_id) && e.courses)
    .map((e: any) => ({
      id:          e.student_id,
      first_name:  profileMap.get(e.student_id)?.first_name ?? '',
      last_name:   profileMap.get(e.student_id)?.last_name  ?? '',
      course_id:   e.courses.id,
      course_name: e.courses.name,
    }))

  // 2. Evaluaciones publicadas con sus cursos asignados
  const { data: evalIds } = await sb
    .from('evaluations')
    .select('id')
    .eq('organization_id', orgId)
    .eq('status', 'published')

  const publishedIds = (evalIds ?? []).map((e: any) => e.id)

  let heatmapEvals: any[] = []
  if (publishedIds.length > 0) {
    const { data: evalsWithCourses } = await sb
      .from('evaluations')
      .select(`
        id, title, pass_score,
        evaluation_courses ( course_id )
      `)
      .in('id', publishedIds)

    heatmapEvals = (evalsWithCourses ?? []).map((ev: any) => ({
      id:         ev.id,
      title:      ev.title,
      pass_score: ev.pass_score ?? 60,
      course_ids: (ev.evaluation_courses ?? []).map((ec: any) => ec.course_id),
    }))
  }

  // 3. Intentos de estos alumnos en estas evaluaciones
  const studentIds = heatmapStudents.map((s: any) => s.id)
  let heatmapAttempts: any[] = []

  if (studentIds.length > 0 && publishedIds.length > 0) {
    const { data: attemptsRaw } = await sb
      .from('attempts')
      .select('student_id, evaluation_id, score, passed, status')
      .in('student_id', studentIds)
      .in('evaluation_id', publishedIds)
      .in('status', ['submitted', 'graded', 'in_progress', 'timed_out', 'flagged'])

    heatmapAttempts = attemptsRaw ?? []
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Coordinación"
        subtitle="Gestión de evaluaciones"
        actions={
          <a href="/coordinator/evaluations/new" className="btn-brand">+ Nueva evaluación</a>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Evaluaciones activas" value={active}          delay={0} />
          <StatCard label="En progreso ahora"    value={pending}         delay={1} />
          <StatCard label="Total alumnos"        value={students.length} delay={2} />
          <StatCard
            label="En riesgo"
            value={atRisk}
            subColor={atRisk > 0 ? 'red' : 'green'}
            sub={atRisk > 0 ? 'Necesitan seguimiento' : '✓ Sin riesgo'}
            delay={3}
          />
        </div>

        {/* ── Heatmap de cohorte ────────────────────────────────────────── */}
        <CohortHeatmap
          students={heatmapStudents}
          evals={heatmapEvals}
          attempts={heatmapAttempts}
        />

        {/* ── Evaluaciones recientes ────────────────────────────────────── */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Evaluaciones</h2>
            <a href="/coordinator/evaluations" className="text-xs font-medium" style={{ color: '#642f8d' }}>
              Ver todas →
            </a>
          </div>
          <div className="space-y-3">
            {recentEvals.map(ev => {
              const st = getEvalStatus({ status: ev.status, available_until: ev.available_until })
              return (
                <div key={ev.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{ev.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ev.completed_count}/{ev.unique_students} completados
                      {ev.avg_score != null && (
                        <> · Promedio <span className={scoreColor(ev.avg_score)}>{formatScore(ev.avg_score)}</span></>
                      )}
                      {ev.available_until && ` · Vence ${formatDate(ev.available_until)}`}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {ev.cefr_code && (
                      <span className={`cefr-pill cefr-${ev.cefr_code}`}>{ev.cefr_code}</span>
                    )}
                    <span className={`badge ${EVAL_STATUS_BADGE[st]}`}>{EVAL_STATUS_LABEL[st]}</span>
                    <a
                      href={`/coordinator/evaluations/${ev.id}`}
                      className="text-xs font-medium"
                      style={{ color: '#642f8d' }}
                    >
                      Ver →
                    </a>
                  </div>
                </div>
              )
            })}
            {recentEvals.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">
                No hay evaluaciones.{' '}
                <a href="/coordinator/evaluations/new" style={{ color: '#642f8d' }}>Crear una →</a>
              </p>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
