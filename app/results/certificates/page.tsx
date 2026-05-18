// app/results/certificates/page.tsx
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import TopBar from '@/components/layout/TopBar'
import CertificateCard from '@/components/shared/CertificateCard'

export const metadata = { title: 'Mis certificados' }

export default async function CertificatesPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'student') redirect('/exam')

  const supabase = await createClient()

  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('name')
    .eq('id', profile.organization_id)
    .single()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* Sidebar — solo desktop */}
      <div className="hidden md:block">
        <Sidebar
          role="student"
          name={`${profile.first_name} ${profile.last_name}`}
          email={profile.email}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          title="Mis certificados"
          subtitle="Certificados digitales verificables"
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <div className="max-w-2xl mx-auto space-y-4">

            {/* ✅ Texto corregido — el sistema emite constancias también para desaprobados */}
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 text-sm text-purple-800">
              <p className="font-medium mb-1">¿Cómo funcionan?</p>
              <p>
                Cada vez que completás una evaluación, se genera automáticamente un
                <strong> certificado de logro</strong> (si aprobaste) o una{' '}
                <strong>constancia de evaluación</strong> (si no alcanzaste el puntaje mínimo).
                Podés descargarlo en PDF y compartir el link de verificación para demostrar su autenticidad.
              </p>
            </div>

            <CertificateCard
              studentId={profile.id}
              orgName={org?.name ?? 'Next English Institute'}
            />

          </div>
        </main>
      </div>

      {/* ✅ MobileNav — navegación inferior en mobile */}
      <MobileNav />
    </div>
  )
}
