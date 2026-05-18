'use client'

// components/coordinator/AssignCoursesClient.tsx
// Gestión de asignación de cursos a una evaluación
// Muestra todos los cursos activos y permite seleccionar/deseleccionar

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Course {
  id:         string
  name:       string
  cefr_levels?: { code: string; label: string } | null
}

interface Props {
  evaluationId:    string
  evaluationTitle: string
  courses:         Course[]
  initialAssigned: string[]
  backHref:        string
}

export default function AssignCoursesClient({
  evaluationId,
  evaluationTitle,
  courses,
  initialAssigned,
  backHref,
}: Props) {
  const supabase  = createClient()
  const router    = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set(initialAssigned))
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  function toggle(courseId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(courseId) ? next.delete(courseId) : next.add(courseId)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const sb = supabase as any

    // 1. Eliminar todas las asignaciones actuales
    await sb.from('evaluation_courses').delete().eq('evaluation_id', evaluationId)

    // 2. Insertar las nuevas
    if (selected.size > 0) {
      const { error: err } = await sb.from('evaluation_courses').insert(
        Array.from(selected).map(courseId => ({
          evaluation_id: evaluationId,
          course_id:     courseId,
        }))
      )
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    router.push(backHref)
    router.refresh()
  }

  const hasChanges = JSON.stringify([...selected].sort()) !==
                     JSON.stringify([...initialAssigned].sort())

  return (
    <div className="flex flex-1 flex-col overflow-hidden">

      {/* Header */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <a href={backHref} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5">
              <path d="M12 4L6 10l6 6"/>
            </svg>
          </a>
          <div>
            <h1 className="text-[15px] font-semibold text-gray-900">Asignar a cursos</h1>
            <p className="text-xs text-gray-400 mt-0.5">{evaluationTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium text-white"
              style={{ backgroundColor: '#642f8d' }}>
              {selected.size} curso{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-4 py-2 text-sm text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: '#642f8d' }}
          >
            {saving ? 'Guardando…' : 'Guardar asignación'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">

          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 text-sm text-purple-800">
            <p className="font-medium mb-1">¿Cómo funciona?</p>
            <p>Los alumnos inscriptos en los cursos seleccionados verán esta evaluación disponible en su panel.</p>
          </div>

          {courses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <div className="text-4xl mb-3">🏫</div>
              <p className="font-medium text-gray-700">Sin cursos activos</p>
              <p className="text-sm text-gray-400 mt-1">Creá un curso primero para poder asignar evaluaciones.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {courses.map(course => {
                const isSel = selected.has(course.id)
                return (
                  <button
                    key={course.id}
                    onClick={() => toggle(course.id)}
                    className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                      isSel
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        isSel ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                      }`}>
                        {isSel && (
                          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                            <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth={2} strokeLinecap="round"/>
                          </svg>
                        )}
                      </div>

                      {/* Info del curso */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium text-sm ${isSel ? 'text-purple-900' : 'text-gray-900'}`}>
                            {course.name}
                          </p>
                          {course.cefr_levels && (
                            <span className={`cefr-pill cefr-${course.cefr_levels.code}`}>
                              {course.cefr_levels.code}
                            </span>
                          )}
                        </div>
                        {course.cefr_levels && (
                          <p className="text-xs text-gray-400 mt-0.5">{course.cefr_levels.label}</p>
                        )}
                      </div>

                      {isSel && (
                        <span className="text-xs font-medium text-purple-700 flex-shrink-0">
                          ✓ Asignado
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Botón guardar al pie para mobile */}
          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="w-full py-3 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: '#642f8d' }}
            >
              {saving ? 'Guardando…' : hasChanges ? 'Guardar asignación' : 'Sin cambios'}
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}
