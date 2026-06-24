// RUTA: app/teacher/courses/page.tsx

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import TeacherCourseCards from '@/components/teacher/TeacherCourseCards'

export const metadata = { title: 'Mis cursos' }

export default async function TeacherCourses() {
  const profile  = await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  const { data: courses } = await sb
    .from('courses')
    .select('*, cefr_levels(code, label), join_code')
    .eq('teacher_id', profile.id)
    .eq('is_active', true)
    .order('name')

  const courseIds = (courses ?? []).map((c: any) => c.id)

  const [{ data: enrollCounts }, { data: recCounts }] = await Promise.all([
    courseIds.length > 0
      ? sb.from('enrollments').select('course_id').in('course_id', courseIds)
      : { data: [] },
    courseIds.length > 0
      ? sb.from('class_recordings').select('course_id').in('course_id', courseIds).or('is_visible.eq.true,is_visible.is.null')
      : { data: [] },
  ])

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
      <TopBar
        title="Mis cursos"
        subtitle={`${list.length} curso${list.length !== 1 ? 's' : ''} asignado${list.length !== 1 ? 's' : ''}`}
      />
      <main className="flex-1 overflow-y-auto p-6">
        {list.length === 0 ? (
          <EmptyState
            title="Sin cursos asignados"
            description="El director o coordinación te asignará cursos próximamente."
          />
        ) : (
          <TeacherCourseCards
            courses={list}
            alumnosPorCurso={alumnosPorCurso}
            grabsPorCurso={grabsPorCurso}
          />
        )}
      </main>
    </div>
  )
}
