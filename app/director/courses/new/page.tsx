'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CEFR_LEVELS } from '@/lib/utils'

const CEFR_IDS: Record<string, number> = {
  A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
}

const DAYS_OPTIONS = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
  'Lunes y Miércoles', 'Martes y Jueves', 'Lunes, Miércoles y Viernes',
  'Martes y Jueves', 'Sábados',
]

export default function DirectorNewCoursePage() {
  const router = useRouter()
  const sb     = createClient() as any

  const [name,         setName]         = useState('')
  const [description,  setDescription]  = useState('')
  const [cefrLevel,    setCefrLevel]    = useState('')
  const [teacherId,    setTeacherId]    = useState('')
  const [scheduleDays, setScheduleDays] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [notes,        setNotes]        = useState('')
  const [teachers,     setTeachers]     = useState<any[]>([])
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => {
    // Cargar docentes (role_id 1=director, 2=coordinator, 5=teacher)
    sb.from('profiles')
      .select('id, first_name, last_name, role_id')
      .in('role_id', [1, 2, 5])
      .order('last_name')
      .then(({ data }: any) => setTeachers(data ?? []))
  }, [])

  async function handleSave() {
    if (!name.trim()) { setError('El nombre del curso es obligatorio.'); return }
    setSaving(true)
    setError(null)

    const { data: { user } } = await sb.auth.getUser()
    const { data: profile }  = await sb.from('profiles').select('organization_id').eq('id', user?.id).single()

    const { error: err } = await sb.from('courses').insert({
      organization_id: profile?.organization_id,
      name:            name.trim(),
      description:     description.trim() || null,
      cefr_level_id:   cefrLevel ? CEFR_IDS[cefrLevel] : null,
      teacher_id:      teacherId || null,
      schedule_days:   scheduleDays.trim() || null,
      schedule_time:   scheduleTime.trim() || null,
      notes:           notes.trim() || null,
      is_active:       true,
    })

    setSaving(false)
    if (err) { setError('Error al guardar: ' + err.message); return }
    router.push('/director/courses')
    router.refresh()
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5">
              <path d="M12 4L6 10l6 6"/>
            </svg>
          </button>
          <h1 className="text-[15px] font-semibold text-gray-900">Nuevo curso</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.back()} className="btn-outline">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-brand">
            {saving ? 'Guardando…' : 'Crear curso'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-lg space-y-5">

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Datos del curso</h2>

            <div>
              <label className="label">Nombre del curso *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="ej: Intermediate C — Turno noche" className="input" autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nivel CEFR</label>
                <select value={cefrLevel} onChange={e => setCefrLevel(e.target.value)} className="select">
                  <option value="">Sin nivel</option>
                  {CEFR_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Docente a cargo</label>
                <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="select">
                  <option value="">Sin asignar</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Horario</h2>

            <div>
              <label className="label">Días</label>
              <select value={scheduleDays} onChange={e => setScheduleDays(e.target.value)} className="select">
                <option value="">Sin especificar</option>
                {DAYS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                <option value="custom">Otro (escribir abajo)</option>
              </select>
              {scheduleDays === 'custom' && (
                <input type="text" value={scheduleDays === 'custom' ? '' : scheduleDays}
                  onChange={e => setScheduleDays(e.target.value)}
                  placeholder="ej: Lunes, Miércoles y Viernes" className="input mt-2" />
              )}
            </div>

            <div>
              <label className="label">Horario</label>
              <input type="text" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                placeholder="ej: 18:00 - 20:00 hs" className="input" />
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Información adicional</h2>

            <div>
              <label className="label">Descripción</label>
              <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Descripción general del curso…" className="textarea" />
            </div>

            <div>
              <label className="label">Notas internas</label>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Notas administrativas, observaciones, requisitos previos…" className="textarea" />
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
