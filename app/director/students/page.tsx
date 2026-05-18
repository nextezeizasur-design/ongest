import { requireRole } from '@/lib/auth'
import { getStudentStats } from '@/services/students'
import TopBar from '@/components/layout/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { formatScore, scoreColor, scoreBarColor, CEFR_LEVELS } from '@/lib/utils'
import type { CefrCode } from '@/types'

export const metadata = { title: 'Alumnos' }

export default async function DirectorStudents({
  searchParams,
}: {
  searchParams: Promise<{ cefr?: string; q?: string; status?: string }>
}) {
  const profile  = await requireRole('director')
  const sp = await searchParams
  const { data: all } = await getStudentStats(profile.organization_id)

  // Filtros
  let students = all
  if (sp.cefr)            students = students.filter(s => s.cefr_code === sp.cefr)
  if (sp.status === 'risk')  students = students.filter(s => (s.avg_score ?? 100) < 60 && s.total_attempts > 0)
  if (sp.status === 'pending') students = students.filter(s => s.total_attempts === 0)
  if (sp.q) {
    const q = sp.q.toLowerCase()
    students = students.filter(s =>
      `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase().includes(q)
    )
  }

  const atRisk  = all.filter(s => (s.avg_score ?? 100) < 60 && s.total_attempts > 0).length
  const pending = all.filter(s => s.total_attempts === 0).length

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Alumnos"
        subtitle={`${students.length} resultado${students.length !== 1 ? 's' : ''} de ${all.length}`}
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total',       value: all.length,  href: '/director/students' },
            { label: 'En riesgo',   value: atRisk,      href: '/director/students?status=risk',    color: 'text-red-600' },
            { label: 'Sin rendir',  value: pending,     href: '/director/students?status=pending', color: 'text-amber-600' },
          ].map(s => (
            <a key={s.label} href={s.href} className="card-sm text-center hover:bg-gray-50 transition-colors">
              <p className={`text-2xl font-semibold ${s.color ?? 'text-gray-900'}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </a>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <form method="GET" className="flex-1 min-w-[200px]">
            {sp.cefr && <input type="hidden" name="cefr" value={sp.cefr} />}
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            <input
              name="q"
              defaultValue={sp.q}
              placeholder="Buscar por nombre o email…"
              className="input max-w-xs"
            />
          </form>

          <div className="flex flex-wrap gap-1.5">
            <FilterPill href="/director/students" active={!sp.cefr && !sp.status}>Todos</FilterPill>
            {CEFR_LEVELS.map(level => (
              <FilterPill key={level} href={`/director/students?cefr=${level}`} active={sp.cefr === level}>
                {level}
              </FilterPill>
            ))}
            <FilterPill href="/director/students?status=risk"    active={sp.status === 'risk'}>En riesgo</FilterPill>
            <FilterPill href="/director/students?status=pending" active={sp.status === 'pending'}>Sin rendir</FilterPill>
          </div>
        </div>

        {/* Table */}
        {students.length === 0 ? (
          <EmptyState title="Sin resultados" description="No hay alumnos con los filtros aplicados." />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Nivel</th>
                  <th>Curso</th>
                  <th>Exámenes</th>
                  <th>Aprobados</th>
                  <th>Promedio</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  const initials = `${s.first_name[0]}${s.last_name[0]}`.toUpperCase()
                  const st = s.total_attempts === 0
                    ? { label: 'Sin rendir', cls: 'badge-gray' }
                    : (s.avg_score ?? 100) < 60
                    ? { label: 'En riesgo',  cls: 'badge-red' }
                    : { label: 'Al día',     cls: 'badge-green' }
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ background: '#642f8d' }}>
                            {initials}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{s.first_name} {s.last_name}</p>
                            <p className="text-xs text-gray-400">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>{s.cefr_code ? <span className={`cefr-pill cefr-${s.cefr_code}`}>{s.cefr_code}</span> : '—'}</td>
                      <td className="text-gray-600 max-w-[150px] truncate">{s.course_name ?? '—'}</td>
                      <td className="text-gray-600">{s.total_attempts}</td>
                      <td className="text-gray-600">{s.passed_count} / {s.total_attempts}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${scoreColor(s.avg_score)}`}>
                            {formatScore(s.avg_score)}
                          </span>
                          <div className="score-bar-bg">
                            <div className={`score-bar ${scoreBarColor(s.avg_score)}`}
                              style={{ width: `${s.avg_score ?? 0}%` }} />
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

function FilterPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a href={href}
      className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
      style={active
        ? { background: '#642f8d', color: '#fff' }
        : { background: '#fff', border: '1px solid #e5e7eb', color: '#6b7280' }
      }>
      {children}
    </a>
  )
}
