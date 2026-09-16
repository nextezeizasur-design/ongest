// app/teacher/evaluations/[id]/edit/page.tsx
// Editar un borrador de evaluación existente — versión Docente.
// Calcada de app/coordinator/evaluations/[id]/edit/page.tsx: reutiliza el mismo
// EditEvaluationClient (no se reescribe el editor), pero con su propio
// requireRole. La de coordinador tiene ['director','coordinator'] escrito
// adentro del archivo, así que un docente rebota ahí aunque el layout de
// /teacher/* lo permita — por eso hace falta esta página propia y no alcanza
// con reexportar como se hizo con evaluations/new.

import { requireRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditEvaluationClient from '@/components/coordinator/EditEvaluationClient'

export const metadata = { title: 'Editar evaluación' }

export default async function TeacherEditEvaluationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }  = await params
  await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb = supabase as any

  const [{ data: ev }, { data: questions }] = await Promise.all([
    sb.from('evaluations').select('*').eq('id', id).single(),
    sb.from('questions').select('*, options(*)').eq('evaluation_id', id).order('sort_order'),
  ])

  if (!ev) redirect('/teacher/evaluations')

  // Mismas reglas que la versión de coordinador: se puede editar si es
  // borrador, o si está publicada pero todavía no empezó y no tiene intentos.
  const now = new Date()
  const availFrom = ev.available_from ? new Date(ev.available_from) : null
  const notStartedYet = availFrom ? availFrom > now : false

  const { count: attemptCount } = await sb
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('evaluation_id', id)
    .in('status', ['submitted', 'graded', 'in_progress', 'flagged'])

  const hasAttempts = (attemptCount ?? 0) > 0
  const canEdit = ev.status === 'draft' || (ev.status === 'published' && notStartedYet && !hasAttempts)

  if (!canEdit) redirect(`/teacher/evaluations/${id}`)

  return (
    <EditEvaluationClient
      evaluation={ev}
      questions={questions ?? []}
      backHref="/teacher/evaluations"
    />
  )
}
