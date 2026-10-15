export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ExamPreviewClient from '@/components/shared/ExamPreviewClient'

export const metadata = { title: 'Vista previa' }

export default async function TeacherEvaluationPreview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id }   = await params
  const { from } = await searchParams
  const backHref = from === 'coordinator' ? `/coordinator/evaluations/${id}`
                  : from === 'director'    ? `/director/evaluations/${id}`
                  : `/teacher/evaluations/${id}`
  const profile  = await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  const { data: ev } = await sb
    .from('evaluations')
    .select('id, title, instructions, time_limit_min')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!ev) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-400 text-sm">Evaluación no encontrada.</p>
      </div>
    )
  }

  // Mismo criterio de acceso que app/teacher/evaluations/[id]/page.tsx:
  // un docente solo puede previsualizar evaluaciones asignadas a cursos que dicta.
  if (profile.role === 'teacher') {
    const { data: myCourses } = await sb
      .from('courses')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('teacher_id', profile.id)

    const myCourseIds = (myCourses ?? []).map((c: any) => c.id)

    let isAssignedToMe = false
    if (myCourseIds.length > 0) {
      const { data: ec } = await sb
        .from('evaluation_courses')
        .select('evaluation_id')
        .eq('evaluation_id', id)
        .in('course_id', myCourseIds)
      isAssignedToMe = (ec ?? []).length > 0
    }

    if (!isAssignedToMe) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-gray-400 text-sm">Evaluación no encontrada.</p>
        </div>
      )
    }
  }

  const { data: questions } = await sb
    .from('questions')
    .select('id, body, q_type, points, sort_order, options(id, body, sort_order)')
    .eq('evaluation_id', id)
    .order('sort_order', { ascending: true })

  const sortedQuestions = (questions ?? [])
    .slice()
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((q: any) => ({
      ...q,
      options: (q.options ?? []).slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    }))

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <Link href={backHref} className="text-xs text-gray-400 hover:text-gray-600">
          ← Volver a la evaluación
        </Link>
      </div>
      <ExamPreviewClient
        evaluationId={ev.id}
        title={ev.title}
        instructions={ev.instructions}
        timeLimitMin={ev.time_limit_min}
        questions={sortedQuestions}
      />
    </div>
  )
}
