import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import DirectorDashboardClient from '@/components/director/DirectorDashboardClient'

export const metadata = { title: 'Dashboard' }

export default async function DirectorDashboard() {
  const profile  = await requireRole('director')
  const supabase = await createClient()
  const sb       = supabase as any

  // Verificar si la org está vacía para mostrar onboarding
  const [{ count: courseCount }, { count: studentCount }, { count: evalCount }] =
    await Promise.all([
      sb.from('courses').select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id),
      sb.from('profiles').select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('role_id', 4),
      sb.from('evaluations').select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id),
    ])

  const isNewOrg = (courseCount ?? 0) === 0 &&
                   (studentCount ?? 0) === 0 &&
                   (evalCount ?? 0) === 0

  // Obtener nombre de la organización
  const { data: org } = await sb
    .from('organizations')
    .select('name')
    .eq('id', profile.organization_id)
    .single()

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Dashboard"
        subtitle={org?.name ?? 'Mi instituto'}
      />
      <DirectorDashboardClient
        profile={{
          id:              profile.id,
          first_name:      profile.first_name,
          last_name:       profile.last_name,
          organization_id: profile.organization_id,
        }}
        isNewOrg={isNewOrg}
      />
    </div>
  )
}
