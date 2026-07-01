// RUTA: app/teacher/page.tsx
// Dashboard del docente: alumnos en riesgo, alertas y resumen del curso.
// (La cola de correcciones vive en /teacher/results — no se duplica acá.)

export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import TeacherDashboardClient from '@/components/teacher/TeacherDashboardClient'

export const metadata = { title: 'Dashboard' }

export default async function TeacherDashboardPage() {
  const profile  = await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  const { data: courses } = await sb
    .from('courses')
    .select('id, name, cefr_levels(code, label)')
    .eq('teacher_id', profile.id)
    .eq('is_active', true)
    .order('name')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Dashboard"
        subtitle="Alumnos en riesgo, alertas y resumen de tu curso"
      />
      <TeacherDashboardClient
        teacherId={profile.id}
        organizationId={profile.organization_id}
        courses={courses ?? []}
      />
    </div>
  )
}
