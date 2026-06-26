import { requireRole } from '@/lib/auth'
import TopBar from '@/components/layout/TopBar'
import DirectorStudentsClient from '@/components/director/DirectorStudentsClient'

export const metadata = { title: 'Alumnos' }

export default async function DirectorStudents() {
  const profile = await requireRole('director')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Alumnos" subtitle="Gestión de alumnos del instituto" />
      <main className="flex-1 overflow-y-auto p-6">
        <DirectorStudentsClient orgId={profile.organization_id} />
      </main>
    </div>
  )
}
