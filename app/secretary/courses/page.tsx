export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getEnrollmentCounts } from '@/services/courses'
import TopBar from '@/components/layout/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import SecretaryCoursesClient from '@/components/secretary/SecretaryCoursesClient'

export const metadata = { title: 'Cursos' }

export default async function SecretaryCourses() {
  const profile  = await requireRole(['director', 'coordinator', 'secretary'] as any)
  const supabase = await createClient()
  const sb       = supabase as any
  const orgId    = profile.organization_id

  const [{ data: rawCourses }, counts, { data: teachers }] = await Promise.all([
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
  const courseIds = (rawCourses ?? []).map((c: any) => c.id)
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

  // Enriquecer con docente
  const teacherIds = [...new Set((rawCourses ?? []).map((c: any) => c.teacher_id).filter(Boolean))]
  let teacherMap: Record<string, any> = {}
  if (teacherIds.length > 0) {
    const { data: tp } = await sb
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', teacherIds)
    ;(tp ?? []).forEach((t: any) => { teacherMap[t.id] = t })
  }
  const courses = (rawCourses ?? []).map((c: any) => ({
    ...c,
    profiles: c.teacher_id ? teacherMap[c.teacher_id] ?? null : null,
  }))

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Cursos" subtitle="Vista de cursos activos" />
      <main className="flex-1 overflow-y-auto p-6">
        {courses.length === 0 ? (
          <EmptyState title="Sin cursos activos" description="La coordinación aún no ha creado cursos." />
        ) : (
          <SecretaryCoursesClient
            courses={courses}
            counts={counts}
            recCounts={recCounts}
            teachers={teachers ?? []}
          />
        )}
      </main>
    </div>
  )
}
