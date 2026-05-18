import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import DirectorAnalyticsClient from '@/components/director/DirectorAnalyticsClient'

export const metadata = { title: 'Analytics del instituto' }

export default async function DirectorAnalyticsPage() {
  const profile  = await requireRole('director')
  const supabase = await createClient()
  const sb       = supabase as any

  const [kpisRes, coursesRes, skillsRes, monthlyRes, funnelRes, riskRes] =
    await Promise.all([
      sb.rpc('get_director_kpis',        { p_organization_id: profile.organization_id, p_days: 90 }),
      sb.rpc('get_course_performance',   { p_organization_id: profile.organization_id, p_days: 90 }),
      sb.rpc('get_org_skill_performance',{ p_organization_id: profile.organization_id, p_days: 90 }),
      sb.rpc('get_monthly_activity',     { p_organization_id: profile.organization_id, p_months: 6 }),
      sb.rpc('get_retention_funnel',     { p_organization_id: profile.organization_id }),
      sb.rpc('get_at_risk_students',     { p_organization_id: profile.organization_id, p_limit: 8 }),
    ])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Analytics del instituto"
        subtitle="Métricas en tiempo real del rendimiento académico"
      />
      <DirectorAnalyticsClient
        organizationId={profile.organization_id}
        initialKpis={kpisRes.data?.[0] ?? null}
        initialCourses={coursesRes.data ?? []}
        initialSkills={skillsRes.data ?? []}
        initialMonthly={monthlyRes.data ?? []}
        initialFunnel={funnelRes.data ?? []}
        initialRisk={riskRes.data ?? []}
      />
    </div>
  )
}
