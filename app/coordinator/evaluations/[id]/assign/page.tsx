// app/coordinator/evaluations/[id]/assign/page.tsx
// Gestionar asignación de cursos a una evaluación
// Funciona para evaluaciones en cualquier estado (borrador, publicada, etc.)

import { requireRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AssignCoursesClient from '@/components/coordinator/AssignCoursesClient'

export const metadata = { title: 'Asignar cursos' }

export default async function AssignCoursesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = await params
  const profile  = await requireRole(['director', 'coordinator'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  const [{ data: ev }, { data: allCourses }, { data: assigned }] = await Promise.all([
    sb.from('evaluations').select('id, title, status').eq('id', id).single(),
    sb.from('courses')
      .select('id, name, cefr_levels(code, label)')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('name'),
    sb.from('evaluation_courses')
      .select('course_id')
      .eq('evaluation_id', id),
  ])

  if (!ev) redirect(profile.role === 'director' ? '/director/evaluations' : '/coordinator/evaluations')

  const assignedIds  = (assigned ?? []).map((r: any) => r.course_id) as string[]
  const backHref     = profile.role === 'director'
    ? `/director/evaluations/${id}`
    : `/coordinator/evaluations/${id}`

  return (
    <AssignCoursesClient
      evaluationId={id}
      evaluationTitle={ev.title}
      courses={allCourses ?? []}
      initialAssigned={assignedIds}
      backHref={backHref}
    />
  )
}
