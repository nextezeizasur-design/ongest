import { requireRole } from '@/lib/auth'
import TopBar from '@/components/layout/TopBar'
import UsersClient from '@/components/director/UsersClient'

export const metadata = { title: 'Usuarios' }

export default async function DirectorUsers() {
  const profile = await requireRole('director')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Usuarios"
        subtitle="Gestión de accesos y roles del sistema"
      />
      <main className="flex-1 overflow-y-auto p-6">
        <UsersClient orgId={profile.organization_id} />
      </main>
    </div>
  )
}
