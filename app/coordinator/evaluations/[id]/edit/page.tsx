// app/coordinator/evaluations/[id]/edit/page.tsx
// Editar un borrador de evaluación existente
// Carga los datos y redirige al builder con ellos

import { requireRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditEvaluationClient from '@/components/coordinator/EditEvaluationClient'

export const metadata = { title: 'Editar evaluación' }

export default async function EditEvaluationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }  = await params
  const profile = await requireRole(['director', 'coordinator'] as any)
  const supabase = await createClient()
  const sb = supabase as any

  const [{ data: ev }, { data: questions }] = await Promise.all([
    sb.from('evaluations').select('*').eq('id', id).single(),
    sb.from('questions').select('*, options(*)').eq('evaluation_id', id).order('sort_order'),
  ])

  if (!ev) redirect('/coordinator/evaluations')

  // Se puede editar si:
  // 1. Es un borrador, O
  // 2. Está publicada PERO aún no empezó (available_from en el futuro) Y no tiene intentos
  const now = new Date()
  const availFrom = ev.available_from ? new Date(ev.available_from) : null
  const notStartedYet = availFrom ? availFrom > now : false

  // Verificar si tiene intentos
  const { count: attemptCount } = await sb
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('evaluation_id', id)
    .in('status', ['submitted', 'graded', 'in_progress'])

  const hasAttempts = (attemptCount ?? 0) > 0
  const canEdit = ev.status === 'draft' || (ev.status === 'published' && notStartedYet && !hasAttempts)

  if (!canEdit) {
    if (profile.role === 'director') redirect(`/director/evaluations/${id}`)
    redirect(`/coordinator/evaluations/${id}`)
  }

  // Si es director, redirigir a su ruta
  if (profile.role === 'director') {
    // La página de edición del director re-exporta este mismo componente
  }

  return (
    <EditEvaluationClient
      evaluation={ev}
      questions={questions ?? []}
      backHref={profile.role === 'director' ? '/director/evaluations' : '/coordinator/evaluations'}
    />
  )
}
