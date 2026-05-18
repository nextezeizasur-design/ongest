import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import RecommendationsList from '@/components/shared/RecommendationsList'

export const metadata = { title: 'Mis recomendaciones' }

export default async function RecommendationsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'student') redirect('/exam')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        role="student"
        name={`${profile.first_name} ${profile.last_name}`}
        email={profile.email}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          title="Mis recomendaciones"
          subtitle="Sugerencias personalizadas para mejorar tu inglés"
        />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-4">

            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
              <p className="text-sm text-purple-900 font-medium mb-1">
                ¿Cómo funcionan las recomendaciones?
              </p>
              <p className="text-sm text-purple-700">
                El sistema analiza tu rendimiento en cada habilidad después de cada examen
                y sugiere recursos para las áreas donde estuviste por debajo del 60%.
                Hacé click en una recomendación para marcarla como leída.
              </p>
            </div>

            <RecommendationsList studentId={profile.id} maxItems={20} />

          </div>
        </main>
      </div>
    </div>
  )
}
