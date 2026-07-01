// RUTA: app/coordinator/calendar/page.tsx
// Calendario institucional de evaluaciones — muestra apertura y vencimiento por curso.

export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import EvaluationsCalendarClient, { type CalendarEvalItem } from '@/components/coordinator/EvaluationsCalendarClient'

export const metadata = { title: 'Calendario de evaluaciones' }

export default async function CoordinatorCalendarPage() {
  const profile  = await requireRole(['director', 'coordinator'] as any)
  const orgId    = profile.organization_id
  const supabase = await createClient()
  const sb       = supabase as any

  // Excluye borradores: el calendario institucional muestra solo fechas confirmadas.
  const { data: evals } = await sb
    .from('evaluations')
    .select(`
      id, title, eval_type, status, available_from, available_until,
      cefr_levels(code),
      evaluation_courses(course_id, courses(name))
    `)
    .eq('organization_id', orgId)
    .neq('status', 'draft')

  const items: CalendarEvalItem[] = (evals ?? [])
    .filter((ev: any) => ev.available_from || ev.available_until)
    .map((ev: any) => ({
      id:             ev.id,
      title:          ev.title,
      evalType:       ev.eval_type,
      cefrCode:       ev.cefr_levels?.code ?? null,
      status:         ev.status,
      courseNames:    (ev.evaluation_courses ?? []).map((ec: any) => ec.courses?.name).filter(Boolean),
      availableFrom:  ev.available_from,
      availableUntil: ev.available_until,
    }))

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Calendario de evaluaciones"
        subtitle={`${items.length} evaluación${items.length !== 1 ? 'es' : ''} con fecha programada`}
      />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <EvaluationsCalendarClient evaluations={items} />
        </div>
      </main>
    </div>
  )
}
