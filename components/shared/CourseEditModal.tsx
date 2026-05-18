'use client'

// components/shared/CourseEditModal.tsx
// Modal de edición de curso — usado por director, coordinator y secretary

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Teacher {
  id:         string
  first_name: string
  last_name:  string
}

interface CefrLevel {
  id:   number
  code: string
  label: string
}

export interface CourseEditData {
  id:            string
  name:          string
  description?:  string | null
  schedule_days?: string | null
  schedule_time?: string | null
  bibliography?:  string | null
  cefr_level_id?: number | null
  teacher_id?:    string | null
  cefr_levels?:   CefrLevel | null
  profiles?:      { id: string; first_name: string; last_name: string; email: string } | null
}

interface Props {
  course:    CourseEditData
  teachers:  Teacher[]
  onClose:   () => void
  onSaved:   (updated: CourseEditData) => void
}

const CEFR_LEVELS = [
  { id: 1, code: 'A1', label: 'Beginner' },
  { id: 2, code: 'A2', label: 'Elementary' },
  { id: 3, code: 'B1', label: 'Pre-Intermediate' },
  { id: 4, code: 'B2', label: 'Intermediate' },
  { id: 5, code: 'C1', label: 'Upper-Intermediate' },
  { id: 6, code: 'C2', label: 'Advanced' },
]

export default function CourseEditModal({ course, teachers, onClose, onSaved }: Props) {
  const supabase = createClient()

  const [name,         setName]         = useState(course.name)
  const [cefrLevelId,  setCefrLevelId]  = useState<number | null>(course.cefr_level_id ?? null)
  const [teacherId,    setTeacherId]    = useState(course.teacher_id ?? '')
  const [scheduleDays, setScheduleDays] = useState(course.schedule_days ?? '')
  const [scheduleTime, setScheduleTime] = useState(course.schedule_time ?? '')
  const [bibliography, setBibliography] = useState(course.bibliography ?? '')
  const [description,  setDescription]  = useState(course.description ?? '')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)

    const { error: err } = await (supabase as any)
      .from('courses')
      .update({
        name:          name.trim(),
        cefr_level_id: cefrLevelId ?? null,
        teacher_id:    teacherId || null,
        schedule_days: scheduleDays.trim() || null,
        schedule_time: scheduleTime.trim() || null,
        bibliography:  bibliography.trim() || null,
        description:   description.trim() || null,
      })
      .eq('id', course.id)

    setSaving(false)
    if (err) { setError(err.message); return }

    const cefrObj = CEFR_LEVELS.find(l => l.id === cefrLevelId) ?? null
    const teacherObj = teachers.find(t => t.id === teacherId) ?? null

    onSaved({
      ...course,
      name:          name.trim(),
      cefr_level_id: cefrLevelId,
      teacher_id:    teacherId || null,
      schedule_days: scheduleDays.trim() || null,
      schedule_time: scheduleTime.trim() || null,
      bibliography:  bibliography.trim() || null,
      description:   description.trim() || null,
      cefr_levels:   cefrObj ? { id: cefrObj.id, code: cefrObj.code, label: cefrObj.label } : null,
      profiles:      teacherObj ? { id: teacherObj.id, first_name: teacherObj.first_name, last_name: teacherObj.last_name, email: '' } : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Editar curso</h2>
            <p className="text-xs text-gray-400 mt-0.5">{course.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5">
              <path d="M5 5l10 10M15 5L5 15"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="label">Nombre del curso *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="input" />
          </div>

          {/* Nivel CEFR */}
          <div>
            <label className="label">Nivel CEFR</label>
            <div className="flex gap-2 flex-wrap mt-1">
              <button onClick={() => setCefrLevelId(null)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  cefrLevelId === null ? 'bg-gray-800 text-white border-transparent' : 'border-gray-200 text-gray-500'
                }`}>
                Sin nivel
              </button>
              {CEFR_LEVELS.map(l => (
                <button key={l.id} onClick={() => setCefrLevelId(l.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                    cefrLevelId === l.id ? 'text-white border-transparent' : 'border-gray-200 text-gray-500'
                  }`}
                  style={cefrLevelId === l.id ? { backgroundColor: '#642f8d' } : {}}>
                  {l.code}
                </button>
              ))}
            </div>
            {cefrLevelId && (
              <p className="text-xs text-gray-400 mt-1">
                {CEFR_LEVELS.find(l => l.id === cefrLevelId)?.label}
              </p>
            )}
          </div>

          {/* Docente */}
          {teachers.length > 0 && (
            <div>
              <label className="label">Docente asignada</label>
              <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="input">
                <option value="">Sin docente</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Días y horario */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Días de clase</label>
              <input type="text" value={scheduleDays}
                onChange={e => setScheduleDays(e.target.value)}
                placeholder="ej: Lunes y Miércoles" className="input" />
            </div>
            <div>
              <label className="label">Horario</label>
              <input type="text" value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)}
                placeholder="ej: 18h a 20h" className="input" />
            </div>
          </div>

          {/* Bibliografía */}
          <div>
            <label className="label">Bibliografía</label>
            <textarea rows={3} value={bibliography}
              onChange={e => setBibliography(e.target.value)}
              placeholder="Ej: Macmillan Language Hub A2 — Student's Book"
              className="textarea" />
            <p className="text-xs text-gray-400 mt-1">Libros y materiales del curso.</p>
          </div>

          {/* Descripción */}
          <div>
            <label className="label">Descripción (opcional)</label>
            <textarea rows={2} value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Notas adicionales…" className="textarea" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-brand flex-1">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
