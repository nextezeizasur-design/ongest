'use client'

// components/director/DirectorDashboardClient.tsx

import { useState, useEffect } from 'react'
import OnboardingWizard from '@/components/director/OnboardingWizard'
import { formatDateTime } from '@/lib/utils'

interface Profile {
  id:              string
  first_name:      string
  last_name:       string
  organization_id: string
}

interface Stats {
  courseCount:    number
  studentCount:   number
  publishedCount: number
  pendingCount:   number
  gradedCount:    number
  avgScore:       number | null
}

interface Props {
  profile:         Profile
  isNewOrg:        boolean
  stats:           Stats
  recentAttempts:  any[]
  criticalPending: any[]
}

function scoreColor(score: number | null) {
  if (score === null) return 'text-gray-400'
  if (score >= 70) return 'text-green-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

export default function DirectorDashboardClient({
  profile,
  isNewOrg,
  stats,
  recentAttempts,
  criticalPending,
}: Props) {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!isNewOrg) return
    const done = localStorage.getItem(`onboarding_${profile.organization_id}_done`)
    if (!done) {
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

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* ── Banner bienvenida org nueva ── */}
          {isNewOrg && (
            <div
              className="rounded-2xl p-6 text-white"
              style={{ background: 'linear-gradient(135deg, #642f8d 0%, #4e2470 100%)' }}
            >
              <h2 className="text-xl font-bold mb-1">
                ¡Bienvenido, {profile.first_name}!
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
                <a href="/coordinator/evaluations/new"
                  className="px-4 py-2 bg-white/20 text-white text-sm font-medium rounded-xl hover:bg-white/30 transition-colors">
                  📝 Crear evaluación
                </a>
              </div>
            </div>
          )}

          {/* ── Alerta correcciones críticas ── */}
          {criticalPending.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800">
                  {criticalPending.length} examen{criticalPending.length !== 1 ? 'es' : ''} sin corregir hace más de 5 días
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {criticalPending.slice(0, 3).map((a: any) => (
                    <a
                      key={a.id}
                      href={`/teacher/results/${a.id}`}
                      className="text-xs text-red-700 underline hover:text-red-900"
                    >
                      {a.profiles?.first_name} {a.profiles?.last_name} — {a.evaluations?.title}
                    </a>
                  ))}
                  {criticalPending.length > 3 && (
                    <a href="/teacher/results" className="text-xs text-red-600 hover:underline">
                      +{criticalPending.length - 3} más →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Stats principales ── */}
          {!isNewOrg && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

              <div className="card text-center">
                <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats.studentCount}</p>
                <p className="text-xs text-gray-500 mt-1">Alumnos activos</p>
              </div>

              <div className="card text-center">
                <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats.publishedCount}</p>
                <p className="text-xs text-gray-500 mt-1">Evaluaciones publicadas</p>
              </div>

              <div className="card text-center col-span-2 md:col-span-1">
                <p className={`text-2xl md:text-3xl font-bold ${scoreColor(stats.avgScore)}`}>
                  {stats.avgScore !== null ? `${stats.avgScore}%` : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Promedio general</p>
              </div>

              <div className="card text-center">
                <p className={`text-2xl md:text-3xl font-bold ${stats.pendingCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                  {stats.pendingCount}
                </p>
                <p className="text-xs text-gray-500 mt-1">Pendientes de corrección</p>
                {stats.pendingCount > 0 && (
                  <a href="/teacher/results" className="text-xs text-purple-600 hover:underline mt-1 block">
                    Corregir →
                  </a>
                )}
              </div>

              <div className="card text-center">
                <p className="text-2xl md:text-3xl font-bold text-green-700">{stats.gradedCount}</p>
                <p className="text-xs text-gray-500 mt-1">Exámenes corregidos</p>
              </div>

              <div className="card text-center">
                <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats.courseCount}</p>
                <p className="text-xs text-gray-500 mt-1">Cursos activos</p>
              </div>
            </div>
          )}

          {/* ── Links rápidos ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: '/director/analytics',     icon: '📊', label: 'Analytics'    },
              { href: '/director/courses',        icon: '🏫', label: 'Cursos'       },
              { href: '/director/students',       icon: '👨‍🎓', label: 'Alumnos'      },
              { href: '/coordinator/evaluations', icon: '📝', label: 'Evaluaciones' },
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

          {/* ── Actividad reciente ── */}
          {recentAttempts.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Actividad reciente</h2>
                <a href="/teacher/results" className="text-xs text-purple-600 hover:underline">
                  Ver todas →
                </a>
              </div>
              <div className="divide-y divide-gray-50">
                {recentAttempts.map((att: any) => {
                  const isPending = att.status === 'submitted'
                  return (
                    <a
                      key={att.id}
                      href={`/teacher/results/${att.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group"
                    >
                      {/* Ícono estado */}
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white text-sm"
                        style={{
                          background: isPending
                            ? '#d97706'
                            : att.passed ? '#16a34a' : '#dc2626'
                        }}
                      >
                        {isPending ? '⏳' : att.passed ? '✓' : '✕'}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {att.profiles?.first_name} {att.profiles?.last_name}
                          <span className="text-gray-400 font-normal"> · {att.evaluations?.title}</span>
                        </p>
                        <p className="text-xs text-gray-400">{formatDateTime(att.submitted_at)}</p>
                      </div>

                      {/* Score o badge */}
                      <div className="flex-shrink-0 text-right">
                        {isPending ? (
                          <span className="text-xs font-medium text-amber-600">Pendiente</span>
                        ) : (
                          <span className={`text-sm font-semibold ${scoreColor(att.score)}`}>
                            {att.score != null ? `${Math.round(att.score)}%` : '—'}
                          </span>
                        )}
                      </div>
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Estado vacío — org con datos pero sin actividad aún */}
          {!isNewOrg && recentAttempts.length === 0 && stats.studentCount > 0 && (
            <div className="card text-center py-8">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-sm font-semibold text-gray-700">Sin actividad todavía</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">
                Tenés {stats.studentCount} alumno{stats.studentCount !== 1 ? 's' : ''} y {stats.publishedCount} evaluación{stats.publishedCount !== 1 ? 'es' : ''} publicada{stats.publishedCount !== 1 ? 's' : ''}. Cuando los alumnos rindan, verás los resultados aquí.
              </p>
            </div>
          )}

          {/* Re-abrir wizard */}
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
