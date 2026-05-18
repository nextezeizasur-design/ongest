import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import TeacherDashboardClient from '@/components/teacher/TeacherDashboardClient'

export const metadata = { title: 'Panel docente' }

export default async function TeacherDashboard() {
  const profile  = await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  // Cursos del docente
  const { data: teacherCourses } = await sb
    .from('courses')
    .select('id, name, cefr_levels(code, label)')
    .eq('teacher_id', profile.id)
    .eq('is_active', true)
    .order('name')

  const allCourses = teacherCourses ?? []

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Panel docente"
        subtitle="Seguimiento inteligente del grupo"
      />
      <TeacherDashboardClient
        teacherId={profile.id}
        organizationId={profile.organization_id}
        courses={allCourses}
      />
    </div>
  )
}
