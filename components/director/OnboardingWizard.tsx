'use client'

// components/director/OnboardingWizard.tsx
// Wizard de primer uso para el director
// Se muestra cuando la org no tiene cursos, alumnos ni evaluaciones

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Step {
  id:          number
  icon:        string
  title:       string
  description: string
  action:      string
  href:        string
  optional?:   boolean
}

const STEPS: Step[] = [
  {
    id:          1,
    icon:        '🏫',
    title:       'Creá tu primer curso',
    description: 'Los cursos agrupan alumnos por nivel. Ej: "Beginner A", "Intermediate B2". Asignale un nivel CEFR y un horario.',
    action:      'Crear curso',
    href:        '/director/courses/new',
  },
  {
    id:          2,
    icon:        '👨‍🎓',
    title:       'Agregá alumnos',
    description: 'Cargá los alumnos desde el panel de usuarios. Cada alumno recibe un email de bienvenida con sus credenciales de acceso.',
    action:      'Agregar alumnos',
    href:        '/director/users',
  },
  {
    id:          3,
    icon:        '📝',
    title:       'Creá tu primera evaluación',
    description: 'Podés crear preguntas de opción múltiple, verdadero/falso, respuesta corta, essay y speaking. También podés importar desde el banco de preguntas.',
    action:      'Crear evaluación',
    href:        '/director/evaluations/new',
  },
]

interface Props {
  orgName:        string
  directorName:   string
  onDismiss:      () => void
}

export default function OnboardingWizard({ orgName, directorName, onDismiss }: Props) {
  const router        = useRouter()
  const [step, setStep] = useState(0)   // 0 = bienvenida, 1-3 = pasos

  const currentStep = STEPS[step - 1] ?? null

  function handleAction(href: string) {
    // Guardar progreso en localStorage para no mostrar de nuevo
    localStorage.setItem(`onboarding_${orgName}_step`, String(step + 1))
    router.push(href)
  }

  function handleSkip() {
    if (step < STEPS.length) {
      setStep(s => s + 1)
    } else {
      handleDismiss()
    }
  }

  function handleDismiss() {
    localStorage.setItem(`onboarding_${orgName}_done`, 'true')
    onDismiss()
  }

  // ── Pantalla de bienvenida ──
  if (step === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">

          {/* Header con gradiente */}
          <div
            className="px-8 pt-8 pb-6 text-white text-center"
            style={{ background: 'linear-gradient(135deg, #642f8d 0%, #4e2470 100%)' }}
          >
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold mb-2">¡Bienvenido, {directorName}!</h1>
            <p className="text-purple-200 text-sm">
              Tu plataforma de evaluaciones está lista. Te guiamos en 3 pasos simples para empezar.
            </p>
          </div>

          <div className="p-8">
            {/* Preview de pasos */}
            <div className="space-y-3 mb-8">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: '#f5eefb' }}
                  >
                    {s.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {i + 1}. {s.title}
                    </p>
                    <p className="text-xs text-gray-400">{s.description.split('.')[0]}.</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 border border-gray-300 rounded-xl py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Lo hago después
              </button>
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 text-sm text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#642f8d' }}
              >
                Empezar →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Paso actual ──
  if (currentStep) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">

          {/* Progreso */}
          <div className="px-6 pt-5 pb-0">
            <div className="flex items-center gap-2 mb-4">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 flex-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      i + 1 < step
                        ? 'text-white'
                        : i + 1 === step
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                    style={
                      i + 1 <= step
                        ? { backgroundColor: '#642f8d' }
                        : {}
                    }
                  >
                    {i + 1 < step ? '✓' : i + 1}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className="flex-1 h-0.5 rounded-full transition-all"
                      style={{ backgroundColor: i + 1 < step ? '#642f8d' : '#e5e7eb' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 pb-6">
            {/* Icono y título */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4"
              style={{ backgroundColor: '#f5eefb' }}
            >
              {currentStep.icon}
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Paso {step} de {STEPS.length} — {currentStep.title}
            </h2>

            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              {currentStep.description}
            </p>

            {/* Tips contextual por paso */}
            <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 mb-6 text-xs text-purple-800">
              {step === 1 && '💡 Podés crear varios cursos. Empezá con uno y agregá más después.'}
              {step === 2 && '💡 Los alumnos reciben un email con su usuario y contraseña temporaria.'}
              {step === 3 && '💡 Las evaluaciones pueden ser de opción múltiple, essay o speaking. También podés importar desde un PDF de Macmillan u Oxford.'}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                {step < STEPS.length ? 'Omitir este paso' : 'Terminar'}
              </button>
              <button
                onClick={() => handleAction(currentStep.href)}
                className="flex-1 py-2.5 text-sm text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#642f8d' }}
              >
                {currentStep.action} →
              </button>
            </div>

            {step < STEPS.length && (
              <button
                onClick={handleDismiss}
                className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
              >
                Cerrar y continuar más tarde
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
