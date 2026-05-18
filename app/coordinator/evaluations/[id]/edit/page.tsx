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

  // Solo se pueden editar borradores
  if (ev.status !== 'draft') {
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
