'use client'

// components/coordinator/AssignTeacherButton.tsx
// Botón + dropdown para asignar/cambiar el docente de un curso

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Teacher {
  id:         string
  first_name: string
  last_name:  string
  email:      string
}

interface Props {
  courseId:        string
  currentTeacherId: string | null
  teachers:        Teacher[]
}

export default function AssignTeacherButton({ courseId, currentTeacherId, teachers }: Props) {
  const supabase  = createClient()
  const router    = useRouter()
  const [open,    setOpen]    = useState(false)
  const [saving,  setSaving]  = useState(false)

  async function assign(teacherId: string | null) {
    setSaving(true)
    await (supabase as any)
      .from('courses')
      .update({ teacher_id: teacherId })
      .eq('id', courseId)
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        disabled={saving}
        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all font-medium text-gray-600 disabled:opacity-40"
      >
        {saving ? 'Guardando…' : currentTeacherId ? '✏️ Cambiar' : '+ Asignar docente'}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-64 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Seleccionar docente
              </p>
            </div>

            <div className="max-h-52 overflow-y-auto">
              {/* Opción: sin docente */}
              <button
                onClick={() => assign(null)}
                className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                  !currentTeacherId ? 'bg-purple-50' : ''
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                  —
                </div>
                <span className="text-sm text-gray-500 italic">Sin docente</span>
                {!currentTeacherId && <span className="ml-auto text-purple-600 text-xs">✓</span>}
              </button>

              {teachers.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-400">
                  No hay docentes en la organización.
                </div>
              ) : (
                teachers.map(t => (
                  <button
                    key={t.id}
                    onClick={() => assign(t.id)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                      currentTeacherId === t.id ? 'bg-purple-50' : ''
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                      style={{ background: '#642f8d' }}
                    >
                      {t.first_name[0]}{t.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {t.first_name} {t.last_name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{t.email}</p>
                    </div>
                    {currentTeacherId === t.id && (
                      <span className="text-purple-600 text-xs flex-shrink-0">✓</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
