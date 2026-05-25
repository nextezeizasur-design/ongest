// RUTA: app/results/page.tsx
// Dashboard del alumno con tabs: Resumen | Historial
// Reemplaza la página actual de /results

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mis notas' }

import { redirect }       from 'next/navigation'
import { getProfile }     from '@/lib/auth'
import { createClient }   from '@/lib/supabase/server'
import Sidebar            from '@/components/layout/Sidebar'
import MobileNav          from '@/components/layout/MobileNav'
import TopBar             from '@/components/layout/TopBar'
import ResultsDashboard   from '@/components/student/ResultsDashboard'

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = tab === 'historial' ? 'historial' : 'resumen'

  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'student') {
    const home: Record<string, string> = {
      director:    '/director',
      coordinator: '/coordinator',
      secretary:   '/secretary',
      teacher:     '/teacher',
    }
    redirect(home[profile.role] ?? '/teacher')
  }

  const supabase = await createClient()
  const sb       = supabase as any

  // ── Intentos completados (historial + stats) ─────────────────────────────
  const { data: attemptsRaw } = await sb
    .from('attempts')
    .select(`
      id, score, passed, status, submitted_at, started_at,
      evaluations ( id, title, eval_type, pass_score, cefr_levels(code, label) )
    `)
    .eq('student_id', profile.id)
    .in('status', ['submitted', 'graded', 'timed_out', 'flagged'])
    .order('submitted_at', { ascending: false })

  const attempts = attemptsRaw ?? []

  // ── Radar de habilidades ─────────────────────────────────────────────────
  const { data: radarData } = await sb.rpc('get_student_radar', {
    p_student_id: profile.id,
  })
  const skills = radarData ?? []

  // ── Stats resumen ────────────────────────────────────────────────────────
  const total    = attempts.length
  const approved = attempts.filter((a: any) => a.passed).length
  const gradedAttempts = attempts.filter(
    (a: any) => a.score !== null && a.status === 'graded'
  )
  const avgScore =
    gradedAttempts.length > 0
      ? Math.round(
          gradedAttempts.reduce((acc: number, a: any) => acc + (a.score ?? 0), 0) /
          gradedAttempts.length
        )
      : null

  // Mejor score
  const bestScore =
    gradedAttempts.length > 0
      ? Math.round(Math.max(...gradedAttempts.map((a: any) => a.score ?? 0)))
      : null

  // ── Evolución de puntaje (últimos 10 intentos graded, cronológico) ───────
  const scoreHistory = [...gradedAttempts]
    .sort(
      (a: any, b: any) =>
        new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    )
    .slice(-10)
    .map((a: any) => ({
      title:       a.evaluations?.title ?? '',
      score:       Math.round(a.score ?? 0),
      passed:      a.passed ?? false,
      submittedAt: a.submitted_at,
    }))

  // ── Skill más fuerte y más débil ─────────────────────────────────────────
  const skillsWithData = skills.filter((s: any) => s.score_pct > 0)
  const strongest = skillsWithData.length > 0
    ? skillsWithData.reduce((a: any, b: any) => a.score_pct > b.score_pct ? a : b)
    : null
  const weakest = skillsWithData.length > 0
    ? skillsWithData.reduce((a: any, b: any) => a.score_pct < b.score_pct ? a : b)
    : null

  // ── Streak de actividad (días únicos con intento en los últimos 30 días) ──
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recentDays = new Set(
    attempts
      .filter((a: any) => a.submitted_at && new Date(a.submitted_at) > thirtyDaysAgo)
      .map((a: any) => new Date(a.submitted_at).toDateString())
  )
  const streak = recentDays.size

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
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
          subtitle={total > 0 ? `${total} evaluación${total !== 1 ? 'es' : ''} completada${total !== 1 ? 's' : ''}` : 'Sin evaluaciones aún'}
        />

        <ResultsDashboard
          activeTab={activeTab}
          attempts={attempts}
          skills={skills}
          stats={{ total, approved, avgScore, bestScore, streak }}
          scoreHistory={scoreHistory}
          strongest={strongest}
          weakest={weakest}
        />
      </div>

      <MobileNav />
    </div>
  )
}
