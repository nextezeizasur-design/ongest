import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import { formatScore, scoreColor, CEFR_LEVELS } from '@/lib/utils'
import InstitutionalReportButton from '@/components/director/InstitutionalReportButton'
import type { StudentStats } from '@/types'

export const metadata = { title: 'Reportes' }

export default async function DirectorReports() {
  const profile  = await requireRole('director')
  const supabase = await createClient()
  const orgId    = profile.organization_id

  const [{ data: students }, { data: evals }] = await Promise.all([
    supabase.from('v_student_stats').select('*').eq('organization_id', orgId),
    supabase.from('v_evaluation_stats').select('*').eq('organization_id', orgId),
  ])

  const all = (students ?? []) as StudentStats[]

  // Stats por nivel CEFR
  const byLevel = CEFR_LEVELS.map(code => {
    const group = all.filter(s => s.cefr_code === code && s.total_attempts > 0)
    const avg   = group.length ? Math.round(group.reduce((a,b) => a + (b.avg_score ?? 0), 0) / group.length) : null
    return { code, count: group.length, avg }
  }).filter(g => g.count > 0)

  // Alumnos en riesgo
  const atRisk = all.filter(s => (s.avg_score ?? 100) < 60 && s.total_attempts > 0)
    .sort((a,b) => (a.avg_score ?? 0) - (b.avg_score ?? 0))

  // Evaluaciones con peor rendimiento
  const worstEvals = (evals ?? [])
    .filter(e => e.avg_score != null)
    .sort((a: any, b: any) => (a.avg_score ?? 0) - (b.avg_score ?? 0))
    .slice(0, 5)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Reportes"
        subtitle="Análisis académico del ciclo"
        actions={<InstitutionalReportButton organizationId={profile.organization_id} />}
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Por nivel CEFR */}
        <div className="card">
          <h2 className="mb-5 text-sm font-semibold text-gray-900">Rendimiento por nivel CEFR</h2>
          {byLevel.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">Sin datos suficientes.</p>
          ) : (
            <div className="space-y-4">
              {byLevel.map(({ code, count, avg }) => (
                <div key={code} className="flex items-center gap-4">
                  <span className={`cefr-pill cefr-${code} w-10 justify-center flex-shrink-0`}>{code}</span>
                  <div className="flex-1">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs text-gray-500">{count} alumno{count !== 1 ? 's' : ''}</span>
                      <span className={`text-xs font-bold ${scoreColor(avg)}`}>{formatScore(avg)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${avg ?? 0}%`,
                          background: (avg ?? 0) >= 80 ? '#22c55e' : (avg ?? 0) >= 60 ? '#f59e0b' : '#ef4444',
                        }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

          {/* Alumnos en riesgo */}
          <div className="card">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">
              Alumnos en riesgo
              {atRisk.length > 0 && (
                <span className="ml-2 badge badge-red">{atRisk.length}</span>
              )}
            </h2>
            {atRisk.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-green-700">✓ Sin alumnos en riesgo</p>
                <p className="text-xs text-gray-400 mt-1">Todos los alumnos tienen promedio ≥ 60%</p>
              </div>
            ) : (
              <div className="space-y-2">
                {atRisk.slice(0, 8).map(s => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ background: '#642f8d' }}>
                      {`${s.first_name[0]}${s.last_name[0]}`.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-900">{s.first_name} {s.last_name}</p>
                      <p className="text-[10px] text-gray-400">{s.course_name ?? 'Sin curso'}</p>
                    </div>
                    <span className="text-sm font-bold text-red-600">{formatScore(s.avg_score)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evaluaciones con menor rendimiento */}
          <div className="card">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Evaluaciones — menor promedio</h2>
            {worstEvals.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">Sin datos.</p>
            ) : (
              <div className="space-y-3">
                {worstEvals.map((e: any) => (
                  <div key={e.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{e.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {e.completed_count} completados · {e.cefr_code ?? 'Sin nivel'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`text-sm font-bold ${scoreColor(e.avg_score)}`}>
                        {formatScore(e.avg_score)}
                      </span>
                      <div className="score-bar-bg mt-1">
                        <div className={`score-bar ${e.avg_score >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${e.avg_score ?? 0}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
