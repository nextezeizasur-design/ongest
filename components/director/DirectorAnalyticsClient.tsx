'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Tipos ─────────────────────────────────────────────────────
interface Kpis {
  active_students:   number
  active_delta:      number
  avg_score:         number | null
  avg_score_delta:   number | null
  pass_rate:         number | null
  pass_rate_delta:   number | null
  at_risk_count:     number
  total_attempts:    number
  total_evaluations: number
}

interface CoursePerf {
  course_id:      string
  course_name:    string
  cefr_code:      string | null
  avg_score:      number | null
  pass_rate:      number | null
  total_students: number
  at_risk:        number
}

interface SkillPerf {
  skill:     string
  avg_score: number | null
  attempts:  number
}

interface MonthlyActivity {
  month_label:     string
  attempts:        number
  passed:          number
  active_students: number
}

interface FunnelStage {
  stage: string
  count: number
}

interface RiskStudent {
  student_id:       string
  student_name:     string
  email:            string
  course_name:      string
  cefr_code:        string | null
  avg_score_recent: number | null
  risk_status:      string
  last_attempt_at:  string | null
}

interface Props {
  organizationId:  string
  initialKpis:     Kpis | null
  initialCourses:  CoursePerf[]
  initialSkills:   SkillPerf[]
  initialMonthly:  MonthlyActivity[]
  initialFunnel:   FunnelStage[]
  initialRisk:     RiskStudent[]
}

const PERIODS = [
  { label: '7d',  days: 7   },
  { label: '30d', days: 30  },
  { label: '3m',  days: 90  },
  { label: '1a',  days: 365 },
]

const SKILL_LABEL: Record<string, string> = {
  grammar:    'Grammar',
  listening:  'Listening',
  reading:    'Reading',
  writing:    'Writing',
  vocabulary: 'Vocabulary',
  speaking:   'Speaking',
}

function scoreColor(score: number): string {
  return score >= 60 ? '#3b6d11' : score >= 40 ? '#854f0b' : '#a32d2d'
}

function deltaDisplay(delta: number | null): { text: string; color: string } {
  if (delta == null) return { text: '—', color: 'var(--color-text-tertiary)' }
  const sign = delta >= 0 ? '▲ +' : '▼ '
  const color = delta >= 0 ? '#3b6d11' : '#a32d2d'
  return { text: `${sign}${Math.abs(Math.round(delta))} vs período anterior`, color }
}

export default function DirectorAnalyticsClient({
  organizationId,
  initialKpis,
  initialCourses,
  initialSkills,
  initialMonthly,
  initialFunnel,
  initialRisk,
}: Props) {
  const sb = createClient() as any

  const [period, setPeriod]     = useState(90)
  const [kpis, setKpis]         = useState(initialKpis)
  const [courses, setCourses]   = useState(initialCourses)
  const [skills, setSkills]     = useState(initialSkills)
  const [monthly, setMonthly]   = useState(initialMonthly)
  const [funnel, setFunnel]     = useState(initialFunnel)
  const [risk, setRisk]         = useState(initialRisk)
  const [loading, setLoading]   = useState(false)

  async function changePeriod(days: number) {
    setPeriod(days)
    setLoading(true)
    const months = Math.max(3, Math.round(days / 30))

    const [k, c, s, m] = await Promise.all([
      sb.rpc('get_director_kpis',        { p_organization_id: organizationId, p_days: days }),
      sb.rpc('get_course_performance',   { p_organization_id: organizationId, p_days: days }),
      sb.rpc('get_org_skill_performance',{ p_organization_id: organizationId, p_days: days }),
      sb.rpc('get_monthly_activity',     { p_organization_id: organizationId, p_months: months }),
    ])

    setKpis(k.data?.[0] ?? null)
    setCourses(c.data ?? [])
    setSkills(s.data ?? [])
    setMonthly(m.data ?? [])
    setLoading(false)
  }

  const maxAttempts = Math.max(...monthly.map(m => m.attempts), 1)
  const maxFunnel   = funnel[0]?.count ?? 1

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Selector de período */}
        <div className="flex items-center gap-2">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => changePeriod(p.days)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                period === p.days
                  ? 'text-white border-transparent'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
              }`}
              style={period === p.days ? { backgroundColor: '#642f8d' } : {}}
            >
              {p.label}
            </button>
          ))}
          {loading && (
            <span className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'Alumnos activos',
                value: kpis.active_students,
                delta: kpis.active_delta,
                format: (v: number) => String(v),
                highlight: false,
              },
              {
                label: 'Promedio general',
                value: kpis.avg_score,
                delta: kpis.avg_score_delta,
                format: (v: number) => `${Math.round(v)}%`,
                highlight: true,
              },
              {
                label: 'Tasa de aprobación',
                value: kpis.pass_rate,
                delta: kpis.pass_rate_delta,
                format: (v: number) => `${Math.round(v)}%`,
                highlight: true,
              },
              {
                label: 'Alumnos en riesgo',
                value: kpis.at_risk_count,
                delta: null,
                format: (v: number) => String(v),
                highlight: false,
                danger: kpis.at_risk_count > 0,
              },
            ].map(m => {
              const d = deltaDisplay(m.delta)
              return (
                <div key={m.label} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 mb-2">{m.label}</p>
                  <p className={`text-3xl font-bold ${
                    m.danger ? 'text-red-600' :
                    m.highlight && m.value != null
                      ? ((m.value as number) >= 60 ? 'text-green-600' : 'text-red-600')
                      : 'text-gray-900'
                  }`}>
                    {m.value != null ? m.format(m.value as number) : '—'}
                  </p>
                  <p className="text-xs mt-2" style={{ color: d.color }}>{d.text}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Grid medio: cursos + actividad mensual */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Rendimiento por curso */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Rendimiento por curso</h3>
            {courses.length === 0 ? (
              <p className="text-sm text-gray-400">Sin datos en el período</p>
            ) : (
              <div className="space-y-3">
                {courses.map(c => (
                  <div key={c.course_id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {c.course_name}
                        </span>
                        {c.cefr_code && (
                          <span className={`cefr-pill cefr-${c.cefr_code} flex-shrink-0`}>
                            {c.cefr_code}
                          </span>
                        )}
                        {c.at_risk > 0 && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex-shrink-0">
                            {c.at_risk} en riesgo
                          </span>
                        )}
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${c.avg_score ?? 0}%`,
                            backgroundColor: scoreColor(c.avg_score ?? 0),
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 w-20">
                      <span className="text-sm font-bold" style={{ color: scoreColor(c.avg_score ?? 0) }}>
                        {c.avg_score != null ? `${Math.round(c.avg_score)}%` : '—'}
                      </span>
                      <p className="text-xs text-gray-400">{c.total_students} alumnos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actividad mensual */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Actividad mensual</h3>
            {monthly.length === 0 ? (
              <p className="text-sm text-gray-400">Sin datos en el período</p>
            ) : (
              <>
                <div className="flex items-end gap-2 h-[80px] mb-2">
                  {monthly.map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-sm transition-all"
                        style={{
                          height: `${Math.max(4, (m.attempts / maxAttempts) * 72)}px`,
                          backgroundColor: i === monthly.length - 1 ? '#642f8d' : '#ded4f7',
                        }}
                        title={`${m.attempts} evaluaciones`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  {monthly.map((m, i) => (
                    <div key={i} className="flex-1 text-center">
                      <p className="text-xs text-gray-400 truncate">{m.month_label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-3 text-xs text-gray-500">
                  <span>{monthly.reduce((s, m) => s + m.attempts, 0)} evaluaciones totales</span>
                  {monthly.length >= 2 && (
                    <span className={
                      monthly[monthly.length-1].attempts >= monthly[monthly.length-2].attempts
                        ? 'text-green-600' : 'text-red-600'
                    }>
                      {monthly[monthly.length-1].attempts >= monthly[monthly.length-2].attempts ? '▲' : '▼'}
                      Tendencia vs mes anterior
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Grid inferior: skills + embudo + riesgo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Skills */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Rendimiento por skill</h3>
            {skills.length === 0 ? (
              <p className="text-sm text-gray-400">Sin datos</p>
            ) : (
              <div className="space-y-3">
                {skills.map(s => (
                  <div key={s.skill} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-20 flex-shrink-0">
                      {SKILL_LABEL[s.skill] ?? s.skill}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${s.avg_score ?? 0}%`,
                          backgroundColor: scoreColor(s.avg_score ?? 0),
                        }}
                      />
                    </div>
                    <span
                      className="text-sm font-bold w-10 text-right"
                      style={{ color: scoreColor(s.avg_score ?? 0) }}
                    >
                      {s.avg_score != null ? `${Math.round(s.avg_score)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Embudo */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Embudo de actividad</h3>
            {funnel.length === 0 ? (
              <p className="text-sm text-gray-400">Sin datos</p>
            ) : (
              <div className="space-y-2.5">
                {funnel.map((f, i) => {
                  const pct = Math.round((f.count / maxFunnel) * 100)
                  const opacity = 1 - i * 0.2
                  return (
                    <div key={f.stage}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">{f.stage}</span>
                        <span className="text-xs font-bold text-gray-800">{f.count}</span>
                      </div>
                      <div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg flex items-center px-2 transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: `rgba(100, 47, 141, ${opacity})`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
                {funnel.length >= 2 && (
                  <p className="text-xs text-gray-400 mt-2">
                    Retención: {Math.round((funnel[1]?.count ?? 0) / (funnel[0]?.count ?? 1) * 100)}%
                    · Aprobación: {Math.round((funnel[funnel.length-1]?.count ?? 0) / (funnel[0]?.count ?? 1) * 100)}%
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Alumnos en riesgo */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Alumnos en riesgo</h3>
            {risk.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm text-gray-500">Sin alumnos en riesgo</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {risk.map(s => (
                  <div key={s.student_id} className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      s.risk_status === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {s.student_name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{s.course_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-sm font-bold ${
                        s.risk_status === 'critical' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {s.avg_score_recent != null ? `${Math.round(s.avg_score_recent)}%` : '—'}
                      </span>
                    </div>
                  </div>
                ))}
                <a
                  href="/director/students"
                  className="block text-center text-xs mt-2 hover:underline"
                  style={{ color: '#642f8d' }}
                >
                  Ver todos los alumnos →
                </a>
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  )
}
