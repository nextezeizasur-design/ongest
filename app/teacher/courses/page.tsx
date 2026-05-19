import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import CefrPill from '@/components/ui/CefrPill'
import EmptyState from '@/components/ui/EmptyState'
import Link from 'next/link'

export const metadata = { title: 'Mis cursos' }

export default async function TeacherCourses() {
  const profile  = await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  const { data: courses } = await sb
    .from('courses')
    .select('*, cefr_levels(code, label)')
    .eq('teacher_id', profile.id)
    .eq('is_active', true)
    .order('name')

  // Para cada curso, traer cantidad de alumnos y grabaciones
  const courseIds = (courses ?? []).map((c: any) => c.id)

  const [{ data: enrollCounts }, { data: recCounts }] = await Promise.all([
    courseIds.length > 0
      ? sb.from('enrollments').select('course_id').in('course_id', courseIds)
      : { data: [] },
    courseIds.length > 0
      ? sb.from('class_recordings').select('course_id').in('course_id', courseIds).eq('is_visible', true)
      : { data: [] },
  ])

  // Mapas para lookup rápido
  const alumnosPorCurso: Record<string, number> = {}
  const grabsPorCurso:   Record<string, number> = {}

  for (const e of enrollCounts ?? []) {
    alumnosPorCurso[e.course_id] = (alumnosPorCurso[e.course_id] ?? 0) + 1
  }
  for (const r of recCounts ?? []) {
    grabsPorCurso[r.course_id] = (grabsPorCurso[r.course_id] ?? 0) + 1
  }

  const list = courses ?? []

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Mis cursos" subtitle={`${list.length} curso${list.length !== 1 ? 's' : ''} asignado${list.length !== 1 ? 's' : ''}`} />

      <main className="flex-1 overflow-y-auto p-6">
        {list.length === 0 ? (
          <EmptyState
            title="Sin cursos asignados"
            description="El director o coordinación te asignará cursos próximamente."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c: any) => {
              const alumnos = alumnosPorCurso[c.id] ?? 0
              const grabs   = grabsPorCurso[c.id]   ?? 0

              return (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">

                  {/* Header de la card */}
                  <div className="p-5 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-semibold text-gray-900 text-base leading-snug">{c.name}</h3>
                      {c.cefr_levels && <CefrPill code={c.cefr_levels.code} />}
                    </div>

                    {/* Info del horario */}
                    <div className="space-y-1.5 mb-4">
                      {c.schedule_days && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="text-base">📅</span>
                          <span>{c.schedule_days}</span>
                        </div>
                      )}
                      {c.schedule_time && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="text-base">🕐</span>
                          <span>{c.schedule_time}</span>
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
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <span>📹</span>
                        <span><strong className="text-gray-900">{grabs}</strong> grabación{grabs !== 1 ? 'es' : ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones rápidas */}
                  <div className="border-t border-gray-100 grid grid-cols-2 divide-x divide-gray-100">
                    <Link
                      href={`/teacher/courses/${c.id}?tab=recordings`}
                      className="flex items-center justify-center gap-2 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-purple-700 transition-colors rounded-bl-2xl"
                    >
                      <span>📹</span> Grabaciones
                    </Link>
                    <Link
                      href={`/teacher/courses/${c.id}?tab=materials`}
                      className="flex items-center justify-center gap-2 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-purple-700 transition-colors rounded-br-2xl"
                    >
                      <span>📚</span> Material
                    </Link>
                  </div>

                  {/* Link al detalle completo */}
                  <Link
                    href={`/teacher/courses/${c.id}`}
                    className="block text-center text-xs text-gray-400 hover:text-purple-700 py-2 border-t border-gray-100 transition-colors rounded-b-2xl hover:bg-gray-50"
                  >
                    Ver detalle del curso →
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
