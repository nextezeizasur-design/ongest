import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import CefrPill from '@/components/ui/CefrPill'
import EmptyState from '@/components/ui/EmptyState'

export const metadata = { title: 'Mis cursos' }

export default async function TeacherCourses() {
  const profile  = await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  const { data: courses } = await sb
    .from('courses')
    .select('*, cefr_levels(code, label)')
    .eq('teacher_id', profile.id)
    .eq('is_active', true)
    .order('name')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Mis cursos" subtitle={`${(courses ?? []).length} cursos asignados`} />

      <main className="flex-1 overflow-y-auto p-6">
        {(courses ?? []).length === 0 ? (
          <EmptyState
            title="Sin cursos asignados"
            description="El director o coordinación te asignará cursos próximamente."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(courses ?? []).map((c: any) => (
              <a key={c.id} href={`/teacher/courses/${c.id}`}
                className="card hover:shadow-sm transition-shadow cursor-pointer block">
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900">{c.name}</h3>
                  {c.cefr_levels && <CefrPill code={c.cefr_levels.code} />}
                </div>
                {c.schedule_days && (
                  <p className="text-xs text-gray-500">📅 {c.schedule_days}</p>
                )}
                {c.schedule_time && (
                  <p className="text-xs text-gray-500">🕐 {c.schedule_time}</p>
                )}
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
