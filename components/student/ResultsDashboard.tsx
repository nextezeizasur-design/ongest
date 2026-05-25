'use client'
// RUTA: components/student/ResultsDashboard.tsx
// Dashboard del alumno: tabs Resumen | Historial
// Sin recharts — gráfico de barras en SVG puro para no agregar dependencias

import { useState }    from 'react'
import { useRouter }   from 'next/navigation'
import { formatDate, EVAL_TYPE_LABEL } from '@/lib/utils'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Attempt {
  id:           string
  score:        number | null
  passed:       boolean | null
  status:       string
  submitted_at: string | null
  started_at:   string | null
  evaluations:  {
    id:          string
    title:       string
    eval_type:   string
    pass_score:  number | null
    cefr_levels: { code: string; label: string } | null
  } | null
}

interface SkillScore {
  skill:     string
  label:     string
  score_pct: number
}

interface ScorePoint {
  title:       string
  score:       number
  passed:      boolean
  submittedAt: string
}

interface Props {
  activeTab:    'resumen' | 'historial'
  attempts:     Attempt[]
  skills:       SkillScore[]
  stats:        { total: number; approved: number; avgScore: number | null; bestScore: number | null; streak: number }
  scoreHistory: ScorePoint[]
  strongest:    SkillScore | null
  weakest:      SkillScore | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SKILL_EMOJI: Record<string, string> = {
  grammar:    '📝',
  listening:  '🎧',
  reading:    '📖',
  writing:    '✏️',
  vocabulary: '📚',
  speaking:   '🗣️',
}

function statusLabel(status: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    graded:    { label: 'Corregido',  cls: 'badge-green'  },
    submitted: { label: 'Entregado',  cls: 'badge-blue'   },
    timed_out: { label: 'Tiempo',     cls: 'badge-amber'  },
    flagged:   { label: 'Revisión',   cls: 'badge-red'    },
  }
  return map[status] ?? { label: status, cls: 'badge-gray' }
}

// Gráfico de barras SVG puro (sin dependencias)
function ScoreChart({ points }: { points: ScorePoint[] }) {
  if (points.length === 0) return null

  const W = 600
  const H = 120
  const BAR_W = Math.min(36, Math.floor((W - 40) / points.length) - 6)
  const spacing = (W - 40) / points.length

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 40}`}
      width="100%"
      className="overflow-visible"
      aria-label="Evolución de puntajes"
    >
      {/* Línea de aprobación (60%) */}
      <line
        x1="20" y1={H - H * 0.6}
        x2={W - 20} y2={H - H * 0.6}
        stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4"
      />
      <text x="22" y={H - H * 0.6 - 4} fontSize="9" fill="#9ca3af">60%</text>

      {points.map((p, i) => {
        const barH   = Math.max(4, (p.score / 100) * H)
        const x      = 20 + i * spacing + spacing / 2 - BAR_W / 2
        const y      = H - barH
        const color  = p.passed ? '#16a34a' : p.score >= 40 ? '#d97706' : '#dc2626'
        const isLast = i === points.length - 1

        return (
          <g key={i}>
            <rect
              x={x} y={y}
              width={BAR_W} height={barH}
              rx="3"
              fill={color}
              opacity={isLast ? 1 : 0.65 + (i / points.length) * 0.35}
            />
            {/* Score encima de la barra */}
            <text
              x={x + BAR_W / 2} y={y - 4}
              textAnchor="middle"
              fontSize="9"
              fill={color}
              fontWeight="600"
            >
              {p.score}%
            </text>
            {/* Etiqueta abajo (solo primero y último en mobile) */}
            <text
              x={x + BAR_W / 2} y={H + 14}
              textAnchor="middle"
              fontSize="9"
              fill="#9ca3af"
            >
              {p.title.length > 10 ? p.title.slice(0, 10) + '…' : p.title}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ResultsDashboard({
  activeTab: initialTab,
  attempts,
  skills,
  stats,
  scoreHistory,
  strongest,
  weakest,
}: Props) {
  const router  = useRouter()
  const [tab, setTab] = useState<'resumen' | 'historial'>(initialTab)

  function switchTab(t: 'resumen' | 'historial') {
    setTab(t)
    router.replace(`/results${t === 'historial' ? '?tab=historial' : ''}`, { scroll: false })
  }

  const hasData = stats.total > 0
  const approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0

  return (
    <main className="flex-1 overflow-y-auto pb-20 md:pb-6">

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white px-4 md:px-6">
        <div className="flex gap-1 max-w-3xl">
          {(['resumen', 'historial'] as const).map(t => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-[#642f8d] text-[#642f8d]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'resumen' ? '📊 Resumen' : '📋 Historial'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: Resumen ─────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">

          {!hasData ? (
            /* Estado vacío */
            <div className="card text-center py-12">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-4"
                style={{ background: '#f5eefb' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#642f8d" strokeWidth={1.5} className="h-8 w-8">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                Todavía no completaste ninguna evaluación
              </h3>
              <p className="text-sm text-gray-500 max-w-xs mx-auto">
                Cuando completes tu primer examen, acá vas a ver tu progreso, puntajes y habilidades.
              </p>
              <a
                href="/exam"
                className="inline-flex items-center justify-center mt-5 px-5 py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#642f8d' }}
              >
                Ver mis exámenes →
              </a>
            </div>
          ) : (
            <>
              {/* ── Stats cards ──────────────────────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card text-center">
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Evaluaciones</p>
                </div>
                <div className="card text-center">
                  <p className={`text-2xl font-bold ${approvalRate >= 60 ? 'text-green-600' : 'text-amber-600'}`}>
                    {approvalRate}%
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Aprobación</p>
                </div>
                <div className="card text-center">
                  <p className={`text-2xl font-bold ${
                    stats.avgScore === null ? 'text-gray-400' :
                    stats.avgScore >= 60 ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {stats.avgScore !== null ? `${stats.avgScore}%` : '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Promedio</p>
                </div>
                <div className="card text-center">
                  <p className="text-2xl font-bold" style={{ color: '#642f8d' }}>
                    {stats.bestScore !== null ? `${stats.bestScore}%` : '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Mejor nota</p>
                </div>
              </div>

              {/* ── Streak ───────────────────────────────────────────────── */}
              {stats.streak > 0 && (
                <div
                  className="card flex items-center gap-3"
                  style={{ background: '#f5eefb', border: '1px solid #e9d5ff' }}
                >
                  <span className="text-2xl">🔥</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#642f8d' }}>
                      {stats.streak} {stats.streak === 1 ? 'día activo' : 'días activos'} en los últimos 30 días
                    </p>
                    <p className="text-xs text-purple-400">
                      ¡Seguí así para mejorar tu nivel!
                    </p>
                  </div>
                </div>
              )}

              {/* ── Evolución de puntajes ────────────────────────────────── */}
              {scoreHistory.length > 0 && (
                <div className="card">
                  <h2 className="text-sm font-semibold text-gray-900 mb-1">
                    Evolución de puntajes
                  </h2>
                  <p className="text-xs text-gray-400 mb-4">
                    Últimos {scoreHistory.length} exámenes corregidos
                  </p>
                  <ScoreChart points={scoreHistory} />
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-600"></span>Aprobado</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500"></span>Cerca del mínimo</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500"></span>Desaprobado</span>
                  </div>
                </div>
              )}

              {/* ── Habilidades ──────────────────────────────────────────── */}
              {skills.length > 0 && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Mis habilidades</h2>
                      <p className="text-xs text-gray-400">Rendimiento por área</p>
                    </div>
                    <a
                      href="/results/radar"
                      className="text-xs font-medium hover:opacity-80 transition-opacity"
                      style={{ color: '#642f8d' }}
                    >
                      Ver radar →
                    </a>
                  </div>
                  <div className="space-y-3">
                    {[...skills]
                      .sort((a, b) => b.score_pct - a.score_pct)
                      .map((s: SkillScore) => (
                        <div key={s.skill} className="flex items-center gap-3">
                          <span className="text-base w-5 flex-shrink-0 text-center">
                            {SKILL_EMOJI[s.skill] ?? '●'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-medium text-gray-700">{s.label}</span>
                              <span className={`text-xs font-bold ${
                                s.score_pct === 0   ? 'text-gray-400' :
                                s.score_pct >= 60   ? 'text-green-600' : 'text-red-500'
                              }`}>
                                {s.score_pct > 0 ? `${Math.round(s.score_pct)}%` : 'Sin datos'}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${s.score_pct}%`,
                                  backgroundColor: s.score_pct >= 60 ? '#16a34a' : s.score_pct > 0 ? '#dc2626' : 'transparent',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* ── Fuerte / Débil ───────────────────────────────────────── */}
              {(strongest || weakest) && (
                <div className="grid grid-cols-2 gap-3">
                  {strongest && (
                    <div className="card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                        💪 Punto fuerte
                      </p>
                      <p className="text-sm font-bold text-green-900">{strongest.label}</p>
                      <p className="text-xl font-bold text-green-600 mt-0.5">
                        {Math.round(strongest.score_pct)}%
                      </p>
                    </div>
                  )}
                  {weakest && weakest.skill !== strongest?.skill && (
                    <div className="card" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                        🎯 A mejorar
                      </p>
                      <p className="text-sm font-bold text-amber-900">{weakest.label}</p>
                      <p className="text-xl font-bold text-amber-600 mt-0.5">
                        {Math.round(weakest.score_pct)}%
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Links a otras secciones ──────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { href: '/results/radar',           label: 'Radar de habilidades', icon: '📊', desc: 'Detalle por área' },
                  { href: '/results/recommendations',  label: 'Recomendaciones',      icon: '💡', desc: 'Qué practicar' },
                  { href: '/results/certificates',     label: 'Certificados',         icon: '🏆', desc: 'Tus logros' },
                ].map(l => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="card flex items-center gap-3 hover:shadow-sm transition-shadow group"
                  >
                    <span className="text-xl">{l.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{l.label}</p>
                      <p className="text-xs text-gray-400">{l.desc}</p>
                    </div>
                    <span className="text-gray-300 group-hover:translate-x-0.5 transition-transform text-sm">→</span>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Historial ───────────────────────────────────────────────── */}
      {tab === 'historial' && (
        <div className="p-4 md:p-6 space-y-3 max-w-3xl mx-auto">
          {attempts.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-sm font-semibold text-gray-900 mb-1">Sin evaluaciones completadas</p>
              <p className="text-xs text-gray-500">Cuando entregues un examen, va a aparecer acá.</p>
              <a
                href="/exam"
                className="inline-flex items-center justify-center mt-4 px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#642f8d' }}
              >
                Ver mis exámenes →
              </a>
            </div>
          ) : (
            attempts.map((a: Attempt) => {
              const ev      = a.evaluations
              const { label: stLabel, cls: stCls } = statusLabel(a.status)
              const isGraded = a.status === 'graded'

              return (
                <div key={a.id} className="card hover:shadow-sm transition-shadow">
                  <div className="flex items-start gap-3 md:items-center md:gap-4">

                    {/* Score circle */}
                    <div
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-white text-sm font-bold"
                      style={{
                        background:
                          !isGraded            ? '#9ca3af' :
                          (a.passed ?? false)  ? '#16a34a' : '#dc2626',
                      }}
                    >
                      {isGraded && a.score !== null ? `${Math.round(a.score)}%` : '—'}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold text-gray-900 w-full md:w-auto">
                          {ev?.title ?? 'Evaluación'}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {ev?.cefr_levels && (
                            <span className={`cefr-pill cefr-${ev.cefr_levels.code}`}>
                              {ev.cefr_levels.code}
                            </span>
                          )}
                          <span className={`badge ${stCls} text-xs`}>{stLabel}</span>
                          {isGraded && (
                            <span className={`badge text-xs ${a.passed ? 'badge-green' : 'badge-red'}`}>
                              {a.passed ? 'Aprobado' : 'Desaprobado'}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {a.submitted_at ? formatDate(a.submitted_at) : 'Fecha desconocida'}
                        {ev?.eval_type && ` · ${EVAL_TYPE_LABEL[ev.eval_type] ?? ev.eval_type}`}
                      </p>
                    </div>

                    {/* Acción */}
                    {isGraded && (
                      <a
                        href={`/exam/results/${a.id}`}
                        className="hidden md:inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
                      >
                        Ver corrección
                      </a>
                    )}
                  </div>

                  {/* Botón mobile */}
                  {isGraded && (
                    <div className="mt-3 md:hidden">
                      <a
                        href={`/exam/results/${a.id}`}
                        className="inline-flex items-center justify-center w-full py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Ver corrección →
                      </a>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </main>
  )
}
