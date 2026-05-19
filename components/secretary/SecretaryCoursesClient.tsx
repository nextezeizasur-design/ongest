'use client'

// components/secretary/SecretaryCoursesClient.tsx

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import CefrPill from '@/components/ui/CefrPill'

interface CefrLevel {
  id:    number
  code:  string
  label: string
}

interface Teacher {
  id:         string
  first_name: string
  last_name:  string
}

interface CourseItem {
  id:             string
  name:           string
  is_active:      boolean
  description?:   string | null
  schedule_days?: string | null
  schedule_time?: string | null
  bibliography?:  string | null
  cefr_level_id?: number | null
  teacher_id?:    string | null
  cefr_levels?:   CefrLevel | null
  profiles?:      { first_name: string; last_name: string } | null
}

interface Props {
  courses:    CourseItem[]
  counts:     Record<string, number>
  recCounts?: Record<string, number>
  teachers?:  Teacher[]
}

const CEFR_LEVELS = [
  { id: 1, code: 'A1', label: 'Beginner'          },
  { id: 2, code: 'A2', label: 'Elementary'         },
  { id: 3, code: 'B1', label: 'Pre-Intermediate'   },
  { id: 4, code: 'B2', label: 'Intermediate'        },
  { id: 5, code: 'C1', label: 'Upper-Intermediate' },
  { id: 6, code: 'C2', label: 'Advanced'           },
]

export default function SecretaryCoursesClient({
  courses: initialCourses,
  counts,
  recCounts = {},
  teachers = [],
}: Props) {
  const supabase = createClient()

  const [courses,      setCourses]      = useState<CourseItem[]>(initialCourses)
  const [editing,      setEditing]      = useState<CourseItem | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Campos del form
  const [name,         setName]         = useState('')
  const [teacherId,    setTeacherId]    = useState('')
  const [scheduleDays, setScheduleDays] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [description,  setDescription]  = useState('')
  const [bibliography, setBibliography] = useState('')
  const [cefrLevelId,  setCefrLevelId]  = useState<number | null>(null)

  function openEdit(course: CourseItem) {
    setEditing(course)
    setName(course.name)
    setTeacherId(course.teacher_id ?? '')
    setScheduleDays(course.schedule_days ?? '')
    setScheduleTime(course.schedule_time ?? '')
    setDescription(course.description ?? '')
    setBibliography(course.bibliography ?? '')
    setCefrLevelId(course.cefr_level_id ?? null)
    setError(null)
  }

  function closeEdit() { setEditing(null); setError(null) }

  async function handleSave() {
    if (!editing) return
    if (!name.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)

    const { error: err } = await (supabase as any)
      .from('courses')
      .update({
        name:          name.trim(),
        teacher_id:    teacherId || null,
        schedule_days: scheduleDays.trim() || null,
        schedule_time: scheduleTime.trim() || null,
        description:   description.trim() || null,
        bibliography:  bibliography.trim() || null,
        cefr_level_id: cefrLevelId ?? null,
      })
      .eq('id', editing.id)

    setSaving(false)
    if (err) { setError(err.message); return }

    const cefrObj = CEFR_LEVELS.find(l => l.id === cefrLevelId) ?? null
    setCourses(prev => prev.map(c => c.id !== editing.id ? c : {
      ...c,
      name:          name.trim(),
      teacher_id:    teacherId || null,
      schedule_days: scheduleDays.trim() || null,
      schedule_time: scheduleTime.trim() || null,
      description:   description.trim() || null,
      bibliography:  bibliography.trim() || null,
      cefr_level_id: cefrLevelId,
      cefr_levels:   cefrObj ? { id: cefrObj.id, code: cefrObj.code, label: cefrObj.label } : null,
    }))
    closeEdit()
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map(course => {
          const cefr    = course.cefr_levels
          const teacher = course.profiles
          const alumnos = counts[course.id]    ?? 0
          const grabs   = recCounts[course.id] ?? 0

          return (
            <div key={course.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">

              {/* Contenido principal */}
              <div className="p-5 flex-1">
                {/* Header: nombre + nivel */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-gray-900 text-base leading-snug">{course.name}</h3>
                  {cefr && <CefrPill code={cefr.code as any} />}
                </div>

                {/* Docente */}
                <div className="flex items-center gap-2 mb-3">
                  {teacher ? (
                    <>
                      <div className="h-6 w-6 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                        style={{ background: '#642f8d' }}>
                        {teacher.first_name[0]}{teacher.last_name[0]}
                      </div>
                      <span className="text-xs text-gray-600">{teacher.first_name} {teacher.last_name}</span>
                    </>
                  ) : (
                    <span className="text-xs text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                      ⚠ Sin docente asignado
                    </span>
                  )}
                </div>

                {/* Horario */}
                <div className="space-y-1 mb-4">
                  {course.schedule_days && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>📅</span><span>{course.schedule_days}</span>
                    </div>
                  )}
                  {course.schedule_time && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>🕐</span><span>{course.schedule_time}</span>
                    </div>
                  )}
                  {course.bibliography && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>📚</span>
                      <span className="truncate text-xs text-gray-500">{course.bibliography}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.7}>
                      <circle cx="8" cy="6" r="3"/>
                      <path d="M2 18c0-4 2.7-6 6-6s6 2 6 6"/>
                      <path d="M14 9a2.5 2.5 0 0 0 0-5M18 18c0-3-1.5-4.5-4-5.5"/>
                    </svg>
                    <span><strong className="text-gray-900">{alumnos}</strong> alumno{alumnos !== 1 ? 's' : ''}</span>
                  </div>
                  {grabs > 0 && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <span>📹</span>
                      <span><strong className="text-gray-900">{grabs}</strong> grabación{grabs !== 1 ? 'es' : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pie: Editar (la secretaria no sube grabaciones/material) */}
              <div className="border-t border-gray-100 flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => openEdit(course)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-amber-700 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.7}>
                    <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z"/>
                  </svg>
                  Editar datos
                </button>
                <span className="text-xs text-gray-300">|</span>
                <Link
                  href={`/secretary/courses/${course.id}`}
                  className="text-xs text-gray-400 hover:text-purple-700 transition-colors"
                >
                  Ver alumnos →
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Modal de edición ── */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) closeEdit() }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Editar curso</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editing.name}</p>
              </div>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600 p-1">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5">
                  <path d="M5 5l10 10M15 5L5 15"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              <div>
                <label className="label">Nombre del curso *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" />
              </div>

              <div>
                <label className="label">Nivel CEFR</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  <button onClick={() => setCefrLevelId(null)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${cefrLevelId === null ? 'bg-gray-800 text-white border-transparent' : 'border-gray-200 text-gray-500'}`}>
                    Sin nivel
                  </button>
                  {CEFR_LEVELS.map(l => (
                    <button key={l.id} onClick={() => setCefrLevelId(l.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${cefrLevelId === l.id ? 'text-white border-transparent' : 'border-gray-200 text-gray-500'}`}
                      style={cefrLevelId === l.id ? { backgroundColor: '#642f8d' } : {}}>
                      {l.code}
                    </button>
                  ))}
                </div>
                {cefrLevelId && (
                  <p className="text-xs text-gray-400 mt-1">{CEFR_LEVELS.find(l => l.id === cefrLevelId)?.label}</p>
                )}
              </div>

              {teachers.length > 0 && (
                <div>
                  <label className="label">Docente asignado</label>
                  <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="input">
                    <option value="">Sin docente</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Días de clase</label>
                  <input type="text" value={scheduleDays} onChange={e => setScheduleDays(e.target.value)}
                    placeholder="ej: Lunes y Miércoles" className="input" />
                </div>
                <div>
                  <label className="label">Horario</label>
                  <input type="text" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                    placeholder="ej: 18h a 20h" className="input" />
                </div>
              </div>

              <div>
                <label className="label">Bibliografía</label>
                <textarea rows={3} value={bibliography} onChange={e => setBibliography(e.target.value)}
                  placeholder="Ej: Macmillan Language Hub A2 — Student's Book" className="textarea" />
              </div>

              <div>
                <label className="label">Descripción (opcional)</label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Notas adicionales…" className="textarea" />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeEdit} className="btn-outline flex-1">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-brand flex-1">
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
