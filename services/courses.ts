import { createClient } from '@/lib/supabase/server'
import type { Course } from '@/types'

// Select explícito con todos los campos — evita que Supabase omita columnas nuevas
const COURSE_SELECT = `
  id, organization_id, name, description, is_active, created_at,
  schedule_days, schedule_time, bibliography, notes,
  cefr_level_id, teacher_id,
  cefr_levels(id, code, label, sort_order)
`

export async function getCourses(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('courses')
    .select(COURSE_SELECT)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name')

  return { data: (data ?? []) as Course[], error }
}

export async function getCourseById(id: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('courses')
    .select(COURSE_SELECT)
    .eq('id', id)
    .single()

  return { data: data as Course | null, error }
}

export async function getCourseWithStudents(courseId: string) {
  const supabase = await createClient()

  // Curso con todos los campos
  const { data: course } = await (supabase as any)
    .from('courses')
    .select(COURSE_SELECT)
    .eq('id', courseId)
    .single()

  if (!course) return { course: null as Course | null, students: [] }

  // Docente por separado (evita ambigüedad de FK)
  let teacher = null
  if (course.teacher_id) {
    const { data: t } = await (supabase as any)
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('id', course.teacher_id)
      .single()
    teacher = t ?? null
  }

  // Alumnos inscriptos
  const { data: enrollments } = await (supabase as any)
    .from('enrollments')
    .select('*, profiles(id, first_name, last_name, email, is_active)')
    .eq('course_id', courseId)

  return {
    course:   { ...course, profiles: teacher } as Course,
    students: (enrollments ?? []).map((e: any) => e.profiles).filter(Boolean),
  }
}

export async function getEnrollmentCounts(orgId: string) {
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('enrollments')
    .select('course_id, courses!inner(organization_id)')
    .eq('courses.organization_id', orgId)

  const counts: Record<string, number> = {}
  ;(data ?? []).forEach((e: any) => {
    counts[e.course_id] = (counts[e.course_id] ?? 0) + 1
  })
  return counts
}
