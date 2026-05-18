// app/coordinator/question-bank/import/page.tsx
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import TopBar from '@/components/layout/TopBar'
import ImportUploadClient from '@/components/coordinator/ImportUploadClient'

export const metadata = { title: 'Importar preguntas desde PDF' }

export default async function ImportPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!['director', 'coordinator', 'teacher'].includes(profile.role)) redirect('/exam')

  const backHref = profile.role === 'director'
    ? '/director/question-bank'
    : profile.role === 'teacher'
    ? '/teacher/question-bank'
    : '/coordinator/question-bank'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="hidden md:block">
        <Sidebar
          role={profile.role}
          name={`${profile.first_name} ${profile.last_name}`}
          email={profile.email}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          title="Importar preguntas desde PDF"
          subtitle="Subí el PDF del libro o examen"
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <div className="max-w-2xl mx-auto">
            <ImportUploadClient
              orgId={profile.organization_id}
              backHref={backHref}
            />
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  )
}
