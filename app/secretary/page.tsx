import { requireRole } from '@/lib/auth'
import { getStudentStats } from '@/services/students'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import StatCard from '@/components/ui/StatCard'

export const metadata = { title: 'Secretaría' }

export default async function SecretaryDashboard() {
  const profile  = await requireRole(['director','coordinator','secretary'] as any)
  const supabase = await createClient()

  const [{ data: students }, { data: courses }] = await Promise.all([
    getStudentStats(profile.organization_id),
    supabase.from('courses').select('id').eq('organization_id', profile.organization_id).eq('is_active', true),
  ])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Secretaría" subtitle="Gestión administrativa"
        actions={<a href="/secretary/students" className="btn-brand">+ Nuevo alumno</a>} />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Total alumnos"  value={students.length}          delay={0} />
          <StatCard label="Cursos activos" value={courses?.length ?? 0}     delay={1} />
          <StatCard label="Sin curso"      value={students.filter(s => !s.course_id).length}
            sub={students.filter(s => !s.course_id).length > 0 ? 'Requieren asignación' : '✓ Todos asignados'}
            subColor={students.filter(s => !s.course_id).length > 0 ? 'amber' : 'green'}
            delay={2} />
        </div>

        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Acceso rápido</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { href: '/secretary/students',         label: 'Alta de alumno',    icon: '👤' },
              { href: '/secretary/students',         label: 'Lista de alumnos',  icon: '📋' },
              { href: '/secretary/courses',          label: 'Gestión de cursos', icon: '📚' },
            ].map(item => (
              <a key={item.href+item.label} href={item.href}
                className="card-sm flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
