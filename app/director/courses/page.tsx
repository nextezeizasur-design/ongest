export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getEnrollmentCounts } from '@/services/courses'
import TopBar from '@/components/layout/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import CefrPill from '@/components/ui/CefrPill'
import DirectorCoursesClient from '@/components/shared/DirectorCoursesClient'

export const metadata = { title: 'Cursos' }

export default async function DirectorCourses() {
  const profile  = await requireRole('director')
  const supabase = await createClient()
  const sb       = supabase as any
  const orgId    = profile.organization_id

  const [{ data: courses }, counts, { data: teachers }] = await Promise.all([
    sb.from('courses')
      .select(`
        id, name, description, is_active,
        schedule_days, schedule_time, bibliography, notes,
        cefr_level_id, teacher_id,
        cefr_levels(id, code, label)
      `)
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name'),
    getEnrollmentCounts(orgId),
    sb.from('profiles')
      .select('id, first_name, last_name')
      .eq('organization_id', orgId)
      .eq('role_id', 5)
      .order('last_name'),
  ])

  // Count de grabaciones por curso
  const courseIds = (courses ?? []).map((c: any) => c.id)
  const recCounts: Record<string, number> = {}
  if (courseIds.length > 0) {
    const { data: recs } = await sb
      .from('class_recordings')
      .select('course_id')
      .in('course_id', courseIds)
      .or('is_visible.eq.true,is_visible.is.null')
    ;(recs ?? []).forEach((r: any) => {
      recCounts[r.course_id] = (recCounts[r.course_id] ?? 0) + 1
    })
  }

  // Enriquecer cursos con datos del docente
  const teacherIds = [...new Set((courses ?? []).map((c: any) => c.teacher_id).filter(Boolean))]
  let teacherMap: Record<string, any> = {}
  if (teacherIds.length > 0) {
    const { data: teacherProfiles } = await sb
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', teacherIds)
    ;(teacherProfiles ?? []).forEach((t: any) => { teacherMap[t.id] = t })
  }
  const coursesWithTeacher = (courses ?? []).map((c: any) => ({
    ...c,
    profiles: c.teacher_id ? teacherMap[c.teacher_id] ?? null : null,
  }))

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Cursos"
        subtitle={`${(courses ?? []).length} cursos activos`}
        actions={
          <a href="/director/courses/new" className="btn-brand">+ Nuevo curso</a>
        }
      />

      <main className="flex-1 overflow-y-auto p-6">
        {(courses ?? []).length === 0 ? (
          <EmptyState
            title="Sin cursos creados"
            description="Creá el primer curso para empezar a inscribir alumnos."
            action={<a href="/director/courses/new" className="btn-brand">+ Nuevo curso</a>}
          />
        ) : (
          <DirectorCoursesClient
            courses={coursesWithTeacher}
            counts={counts}
            recCounts={recCounts}
            teachers={teachers ?? []}
            baseHref="/director"
            canDelete={true}
          />
        )}
      </main>
    </div>
  )
}
