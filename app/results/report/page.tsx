import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import ReportButton from '@/components/shared/ReportButton'

export const metadata = { title: 'Mi reporte' }

export default async function StudentReportPage() {
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
          title="Mi reporte"
          subtitle="Descargá tu reporte de evaluaciones en PDF"
        />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl mx-auto space-y-6">

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-4 mb-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: '#f5eefb' }}
                >
                  📊
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">
                    Reporte personal de evaluaciones
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {profile.first_name} {profile.last_name}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2 text-sm text-gray-600">
                <p className="font-medium text-gray-800 text-xs uppercase tracking-wide mb-2">
                  El reporte incluye:
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Todas tus evaluaciones completadas
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Score y estado por evaluación
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Radar de habilidades (Grammar, Listening, etc.)
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Recomendaciones personalizadas
                </div>
              </div>

              <ReportButton
                studentId={profile.id}
                studentName={`${profile.first_name} ${profile.last_name}`}
              />

              <p className="text-xs text-gray-400 mt-3">
                El PDF se genera y descarga directamente en tu dispositivo.
              </p>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
