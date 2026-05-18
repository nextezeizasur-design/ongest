'use client'

// components/director/DirectorDashboardClient.tsx
// Wrapper del dashboard del director con lógica de onboarding

import { useState, useEffect } from 'react'
import OnboardingWizard from '@/components/director/OnboardingWizard'

interface Profile {
  id:              string
  first_name:      string
  last_name:       string
  organization_id: string
}

interface Props {
  profile:  Profile
  isNewOrg: boolean
}

export default function DirectorDashboardClient({ profile, isNewOrg }: Props) {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!isNewOrg) return

    // Verificar si ya fue dismisseado antes
    const done = localStorage.getItem(`onboarding_${profile.organization_id}_done`)
    if (!done) {
      // Pequeño delay para que el dashboard cargue primero
      const t = setTimeout(() => setShowOnboarding(true), 600)
      return () => clearTimeout(t)
    }
  }, [isNewOrg, profile.organization_id])

  return (
    <>
      {showOnboarding && (
        <OnboardingWizard
          orgName={profile.organization_id}
          directorName={profile.first_name}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}

      {/* Métricas rápidas del dashboard */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* Banner de bienvenida si es nuevo */}
          {isNewOrg && (
            <div
              className="rounded-2xl p-6 text-white"
              style={{ background: 'linear-gradient(135deg, #642f8d 0%, #4e2470 100%)' }}
            >
              <h2 className="text-xl font-bold mb-1">
                ¡Bienvenido a Next English, {profile.first_name}!
              </h2>
              <p className="text-purple-200 text-sm mb-4">
                Tu plataforma está lista. Seguí estos pasos para empezar:
              </p>
              <div className="flex flex-wrap gap-3">
                <a href="/director/courses/new"
                  className="px-4 py-2 bg-white text-sm font-medium rounded-xl hover:bg-gray-100 transition-colors"
                  style={{ color: '#642f8d' }}>
                  🏫 Crear primer curso
                </a>
                <a href="/director/users"
                  className="px-4 py-2 bg-white/20 text-white text-sm font-medium rounded-xl hover:bg-white/30 transition-colors">
                  👨‍🎓 Agregar alumnos
                </a>
                <a href="/director/evaluations/new"
                  className="px-4 py-2 bg-white/20 text-white text-sm font-medium rounded-xl hover:bg-white/30 transition-colors">
                  📝 Crear evaluación
                </a>
              </div>
            </div>
          )}

          {/* Links rápidos siempre visibles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: '/director/analytics',        icon: '📊', label: 'Analytics'       },
              { href: '/director/courses',           icon: '🏫', label: 'Cursos'          },
              { href: '/director/students',          icon: '👨‍🎓', label: 'Alumnos'         },
              { href: '/coordinator/evaluations',    icon: '📝', label: 'Evaluaciones'    },
            ].map(item => (
              <a
                key={item.href}
                href={item.href}
                className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col items-center gap-2 hover:border-purple-300 hover:shadow-sm transition-all text-center"
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </a>
            ))}
          </div>

          {/* Botón para re-abrir el wizard si ya fue cerrado */}
          {isNewOrg && !showOnboarding && (
            <div className="text-center">
              <button
                onClick={() => setShowOnboarding(true)}
                className="text-sm font-medium hover:underline"
                style={{ color: '#642f8d' }}
              >
                Ver guía de inicio →
              </button>
            </div>
          )}

        </div>
      </main>
    </>
  )
}
