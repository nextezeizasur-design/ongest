import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import DirectorDashboardClient from '@/components/director/DirectorDashboardClient'

export const metadata = { title: 'Dashboard' }

export default async function DirectorDashboard() {
  const profile  = await requireRole('director')
  const supabase = await createClient()
  const sb       = supabase as any

  const orgId = profile.organization_id

  // ── Conteos base ────────────────────────────────────────────────
  const [
    { count: courseCount },
    { count: studentCount },
    { count: evalCount },
    { count: publishedCount },
  ] = await Promise.all([
    sb.from('courses').select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('is_active', true),
    sb.from('profiles').select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('role_id', 4),
    sb.from('evaluations').select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    sb.from('evaluations').select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('status', 'published'),
  ])

  const isNewOrg = (courseCount ?? 0) === 0 &&
                   (studentCount ?? 0) === 0 &&
                   (evalCount ?? 0) === 0

  // ── Stats de intentos ────────────────────────────────────────────
  const { data: evalIds } = await sb
    .from('evaluations')
    .select('id')
    .eq('organization_id', orgId)

  const ids = (evalIds ?? []).map((e: any) => e.id)

  let pendingCount    = 0
  let gradedCount     = 0
  let avgScore: number | null = null
  let recentAttempts: any[]   = []
  let criticalPending: any[]  = []

  if (ids.length > 0) {
    const [
      { count: pc },
      { count: gc },
      { data: gradedData },
      { data: recent },
      { data: critical },
    ] = await Promise.all([
      // Pendientes de corrección
      sb.from('attempts').select('id', { count: 'exact', head: true })
        .in('evaluation_id', ids).eq('status', 'submitted'),

      // Ya corregidos
      sb.from('attempts').select('id', { count: 'exact', head: true })
        .in('evaluation_id', ids).eq('status', 'graded'),

      // Scores para calcular promedio
      sb.from('attempts').select('score')
        .in('evaluation_id', ids).eq('status', 'graded')
        .not('score', 'is', null),

      // Últimos 5 intentos entregados
      sb.from('attempts')
        .select('id, status, score, passed, submitted_at, evaluations(title), profiles!attempts_student_id_fkey(first_name, last_name)')
        .in('evaluation_id', ids)
        .in('status', ['submitted', 'graded'])
        .order('submitted_at', { ascending: false })
        .limit(5),

      // Críticos: submitted hace más de 5 días
      sb.from('attempts')
        .select('id, submitted_at, evaluations(title), profiles!attempts_student_id_fkey(first_name, last_name)')
        .in('evaluation_id', ids)
        .eq('status', 'submitted')
        .lt('submitted_at', new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    pendingCount = pc ?? 0
    gradedCount  = gc ?? 0
    recentAttempts  = recent ?? []
    criticalPending = critical ?? []

    if ((gradedData ?? []).length > 0) {
      const total = gradedData.reduce((acc: number, a: any) => acc + (a.score ?? 0), 0)
      avgScore = Math.round(total / gradedData.length)
    }
  }

  // ── Nombre de la org ────────────────────────────────────────────
  const { data: org } = await sb
    .from('organizations').select('name').eq('id', orgId).single()

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Dashboard" subtitle={org?.name ?? 'Mi instituto'} />
      <DirectorDashboardClient
        profile={{
          id:              profile.id,
          first_name:      profile.first_name,
          last_name:       profile.last_name,
          organization_id: orgId,
        }}
        isNewOrg={isNewOrg}
        stats={{
          courseCount:    courseCount    ?? 0,
          studentCount:   studentCount   ?? 0,
          publishedCount: publishedCount ?? 0,
          pendingCount,
          gradedCount,
          avgScore,
        }}
        recentAttempts={recentAttempts}
        criticalPending={criticalPending}
      />
    </div>
  )
}
