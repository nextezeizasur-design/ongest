// RUTA: app/director/monthly/page.tsx
// Dashboard ejecutivo mensual: altas, promedio institucional y aprobación por nivel,
// con comparación contra el mes anterior. Navegación por mes vía ?month=YYYY-MM.

export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import { formatScore, scoreColor } from '@/lib/utils'

export const metadata = { title: 'Dashboard Ejecutivo' }

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function parseMonthParam(month: string | undefined): { year: number; monthIdx: number } {
  const now = new Date()
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number)
    return { year: y, monthIdx: m - 1 }
  }
  return { year: now.getFullYear(), monthIdx: now.getMonth() }
}

function monthParam(year: number, monthIdx: number): string {
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}`
}

function delta(current: number | null, previous: number | null): { label: string; color: string } | null {
  if (current == null || previous == null) return null
  const diff = current - previous
  if (diff === 0) return { label: '= sin cambios', color: 'text-gray-400' }
  return diff > 0
    ? { label: `▲ +${diff}`, color: 'text-green-600' }
    : { label: `▼ ${diff}`, color: 'text-red-600' }
}

export default async function DirectorMonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const profile  = await requireRole('director')
  const orgId    = profile.organization_id
  const supabase = await createClient()
  const sb       = supabase as any

  const sp = await searchParams
  const { year, monthIdx } = parseMonthParam(sp.month)

  const monthStart = new Date(year, monthIdx, 1)
  const monthEnd   = new Date(year, monthIdx + 1, 1) // exclusivo
  const prevStart  = new Date(year, monthIdx - 1, 1)
  const prevEnd    = monthStart

  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && monthIdx === now.getMonth()

  const prevMonthYear = monthIdx === 0 ? year - 1 : year
  const prevMonthIdx  = monthIdx === 0 ? 11 : monthIdx - 1
  const nextMonthYear = monthIdx === 11 ? year + 1 : year
  const nextMonthIdx  = monthIdx === 11 ? 0 : monthIdx + 1

  // ── 1. Altas del mes (y del mes anterior, para comparar) ──
  const [{ count: altasCount }, { count: altasPrevCount }] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('role_id', 4)
      .gte('created_at', monthStart.toISOString()).lt('created_at', monthEnd.toISOString()),
    sb.from('profiles').select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('role_id', 4)
      .gte('created_at', prevStart.toISOString()).lt('created_at', prevEnd.toISOString()),
  ])

  // ── 2. Evaluaciones de la org, con su nivel CEFR (para agrupar aprobación por nivel) ──
  const { data: orgEvals } = await sb
    .from('evaluations')
    .select('id, cefr_levels(code)')
    .eq('organization_id', orgId)

  const evalIds = (orgEvals ?? []).map((e: any) => e.id)
  const cefrByEval: Record<string, string> = {}
  for (const e of orgEvals ?? []) cefrByEval[e.id] = e.cefr_levels?.code ?? 'Sin nivel'

  // ── 3. Intentos del mes y del mes anterior (excluye timed_out, según regla de negocio) ──
  async function attemptsInRange(start: Date, end: Date) {
    if (evalIds.length === 0) return []
    const { data } = await sb
      .from('attempts')
      .select('evaluation_id, score, passed, status, submitted_at')
      .in('evaluation_id', evalIds)
      .in('status', ['submitted', 'graded'])
      .gte('submitted_at', start.toISOString())
      .lt('submitted_at', end.toISOString())
    return data ?? []
  }

  const [attemptsThisMonth, attemptsPrevMonth] = await Promise.all([
    attemptsInRange(monthStart, monthEnd),
    attemptsInRange(prevStart, prevEnd),
  ])

  function avgOf(attempts: any[]): number | null {
    const scored = attempts.filter(a => a.score != null)
    if (scored.length === 0) return null
    return Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length)
  }

  function passRateOf(attempts: any[]): number | null {
    if (attempts.length === 0) return null
    const passed = attempts.filter(a => a.passed).length
    return Math.round((passed / attempts.length) * 100)
  }

  const avgThisMonth  = avgOf(attemptsThisMonth)
  const avgPrevMonth  = avgOf(attemptsPrevMonth)
  const passThisMonth = passRateOf(attemptsThisMonth)
  const passPrevMonth = passRateOf(attemptsPrevMonth)

  // ── 4. Aprobación por nivel CEFR, solo del mes seleccionado ──
  const byLevel: Record<string, { total: number; passed: number }> = {}
  for (const a of attemptsThisMonth) {
    const code = cefrByEval[a.evaluation_id] ?? 'Sin nivel'
    if (!byLevel[code]) byLevel[code] = { total: 0, passed: 0 }
    byLevel[code].total++
    if (a.passed) byLevel[code].passed++
  }
  const levelRows = Object.entries(byLevel)
    .map(([code, v]) => ({ code, total: v.total, passRate: Math.round((v.passed / v.total) * 100) }))
    .sort((a, b) => b.total - a.total)

  const altasDelta = delta(altasCount ?? 0, altasPrevCount ?? 0)
  const avgDelta    = delta(avgThisMonth, avgPrevMonth)
  const passDelta   = delta(passThisMonth, passPrevMonth)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Dashboard Ejecutivo"
        subtitle={`${MONTH_NAMES[monthIdx]} ${year}`}
        actions={
          <div className="flex items-center gap-2">
            <a
              href={`/director/monthly?month=${monthParam(prevMonthYear, prevMonthIdx)}`}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              ← Mes anterior
            </a>
            {!isCurrentMonth && (
              <a
                href={`/director/monthly?month=${monthParam(nextMonthYear, nextMonthIdx)}`}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Mes siguiente →
              </a>
            )}
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* KPIs principales */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <div className="card">
              <p className="text-xs text-gray-500 mb-1">Altas del mes</p>
              <p className="text-2xl font-bold text-gray-900">{altasCount ?? 0}</p>
              {altasDelta && <p className={`text-xs mt-1 ${altasDelta.color}`}>{altasDelta.label} vs mes anterior</p>}
            </div>

            <div className="card">
              <p className="text-xs text-gray-500 mb-1">Bajas del mes</p>
              <p className="text-2xl font-bold text-gray-300">—</p>
              <p className="text-xs text-gray-400 mt-1">No trackeado aún</p>
            </div>

            <div className="card">
              <p className="text-xs text-gray-500 mb-1">Promedio institucional</p>
              <p className={`text-2xl font-bold ${scoreColor(avgThisMonth)}`}>{formatScore(avgThisMonth)}</p>
              {avgDelta && <p className={`text-xs mt-1 ${avgDelta.color}`}>{avgDelta.label}pts vs mes anterior</p>}
            </div>

            <div className="card">
              <p className="text-xs text-gray-500 mb-1">Tasa de aprobación</p>
              <p className={`text-2xl font-bold ${scoreColor(passThisMonth)}`}>
                {passThisMonth != null ? `${passThisMonth}%` : '—'}
              </p>
              {passDelta && <p className={`text-xs mt-1 ${passDelta.color}`}>{passDelta.label}pts vs mes anterior</p>}
            </div>
          </div>

          {/* Aprobación por nivel CEFR */}
          <div className="card">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Aprobación por nivel CEFR — {MONTH_NAMES[monthIdx]}</h2>
            {levelRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                Sin exámenes corregidos en {MONTH_NAMES[monthIdx].toLowerCase()}.
              </p>
            ) : (
              <div className="space-y-4">
                {levelRows.map(l => (
                  <div key={l.code} className="flex items-center gap-4">
                    <span className={`cefr-pill ${l.code !== 'Sin nivel' ? `cefr-${l.code}` : ''} w-16 justify-center flex-shrink-0 text-center`}>
                      {l.code}
                    </span>
                    <div className="flex-1">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs text-gray-500">{l.total} examen{l.total !== 1 ? 'es' : ''} rendido{l.total !== 1 ? 's' : ''}</span>
                        <span className={`text-xs font-bold ${scoreColor(l.passRate)}`}>{l.passRate}% aprobación</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${l.passRate}%`,
                            background: l.passRate >= 80 ? '#22c55e' : l.passRate >= 60 ? '#f59e0b' : '#ef4444',
                          }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 px-1">
            "Bajas del mes" requiere guardar la fecha en que se desactiva un alumno (hoy solo existe un campo activo/inactivo, sin historial).
            Si querés esa métrica, avisame y agregamos un campo <code>deactivated_at</code> — 1 sola migración SQL.
          </p>

        </div>
      </main>
    </div>
  )
}
