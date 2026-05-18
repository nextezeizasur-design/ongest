import { requireRole } from '@/lib/auth'
import TopBar from '@/components/layout/TopBar'
import StudentsClient from '@/components/secretary/StudentsClient'

export const metadata = { title: 'Alumnos' }

export default async function SecretaryStudents() {
  const profile = await requireRole(['director', 'coordinator', 'secretary'] as any)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Alumnos" subtitle="Gestión de inscripciones" />
      <main className="flex-1 overflow-y-auto p-6">
        <StudentsClient orgId={profile.organization_id} />
      </main>
    </div>
  )
}
