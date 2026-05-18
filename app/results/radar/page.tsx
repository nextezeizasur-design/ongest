import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import SkillRadar from '@/components/shared/SkillRadar'
import type { SkillScore } from '@/components/shared/SkillRadar'

export const metadata = { title: 'Mi radar de habilidades' }

export default async function StudentRadarPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'student') redirect('/exam')

  const supabase = await createClient()
  const sb       = supabase as any

  // Radar general del alumno (todos sus intentos)
  const { data: radarData } = await sb.rpc('get_student_radar', {
    p_student_id: profile.id,
  })

  const skills: SkillScore[] = radarData ?? []

  // Evolución temporal (últimos 8 intentos por skill)
  const { data: evolutionData } = await sb.rpc('get_student_skill_evolution', {
    p_student_id: profile.id,
    p_limit:      20,
  })

  // Agrupar evolución por skill
  const evolution: Record<string, { title: string; score: number; date: string }[]> = {}
  ;(evolutionData ?? []).forEach((row: any) => {
    if (!evolution[row.skill]) evolution[row.skill] = []
    evolution[row.skill].push({
      title: row.eval_title,
      score: row.score_pct,
      date:  row.submitted_at,
    })
  })

  // Calcular skill más fuerte y más débil
  const withData = skills.filter(s => s.score_pct > 0)
  const strongest = withData.length > 0
    ? withData.reduce((a, b) => a.score_pct > b.score_pct ? a : b)
    : null
  const weakest = withData.length > 0
    ? withData.reduce((a, b) => a.score_pct < b.score_pct ? a : b)
    : null

  const hasData = withData.length > 0

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        role="student"
        name={`${profile.first_name} ${profile.last_name}`}
        email={profile.email}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          title="Mi radar de habilidades"
          subtitle="Rendimiento por área de inglés"
        />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">

            {!hasData ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <div className="text-5xl mb-4">📊</div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Todavía no hay datos
                </h2>
                <p className="text-gray-500 text-sm">
                  Completá evaluaciones para ver tu radar de habilidades.
                  Las preguntas deben tener asignada una habilidad (Grammar, Listening, etc.)
                </p>
                <a
                  href="/exam"
                  className="inline-block mt-4 px-5 py-2 text-sm text-white rounded-xl hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#642f8d' }}
                >
                  Ver mis exámenes →
                </a>
              </div>
            ) : (
              <>
                {/* Radar principal */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h2 className="font-semibold text-gray-900 mb-1">Tu perfil de habilidades</h2>
                  <p className="text-xs text-gray-400 mb-6">
                    Basado en todos tus exámenes completados
                  </p>
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <SkillRadar
                      skills={skills}
                      size={280}
                      showLegend={false}
                    />
                    <div className="flex-1 w-full space-y-3">
                      {skills.map(s => (
                        <div key={s.skill} className="flex items-center gap-3">
                          <span className="text-base w-5 flex-shrink-0">
                            {{ grammar:'📝', listening:'🎧', reading:'📖', writing:'✏️', vocabulary:'📚' }[s.skill] ?? '●'}
                          </span>
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-gray-700">{s.label}</span>
                              <span className={`font-bold ${
                                s.score_pct >= 60 ? 'text-green-600' :
                                s.score_pct > 0   ? 'text-red-500'   : 'text-gray-400'
                              }`}>
                                {s.score_pct > 0 ? `${Math.round(s.score_pct)}%` : 'Sin datos'}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${s.score_pct}%`,
                                  backgroundColor: s.score_pct >= 60 ? '#16a34a' : '#dc2626',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Fortaleza y debilidad */}
                <div className="grid grid-cols-2 gap-4">
                  {strongest && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                        💪 Tu punto fuerte
                      </p>
                      <p className="text-lg font-bold text-green-900">{strongest.label}</p>
                      <p className="text-2xl font-bold text-green-600 mt-1">
                        {Math.round(strongest.score_pct)}%
                      </p>
                    </div>
                  )}
                  {weakest && weakest.skill !== strongest?.skill && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                        🎯 A mejorar
                      </p>
                      <p className="text-lg font-bold text-amber-900">{weakest.label}</p>
                      <p className="text-2xl font-bold text-amber-600 mt-1">
                        {Math.round(weakest.score_pct)}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Evolución por skill */}
                {Object.keys(evolution).length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-900 mb-4">Evolución por habilidad</h2>
                    <div className="space-y-5">
                      {Object.entries(evolution).map(([skill, entries]) => {
                        const sorted = [...entries].reverse() // cronológico
                        return (
                          <div key={skill}>
                            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                              {{ grammar:'📝', listening:'🎧', reading:'📖', writing:'✏️', vocabulary:'📚' }[skill]} {skill}
                            </p>
                            <div className="flex items-end gap-1.5 h-14">
                              {sorted.map((e, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                                  <div
                                    className="w-full rounded-t-sm transition-all duration-500 cursor-help"
                                    style={{
                                      height: `${Math.max(4, (e.score / 100) * 48)}px`,
                                      backgroundColor: e.score >= 60 ? '#16a34a' : '#dc2626',
                                      opacity: 0.7 + (i / sorted.length) * 0.3,
                                    }}
                                  />
                                  {/* Tooltip */}
                                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                                    {e.title}: {Math.round(e.score)}%
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                              <span>Primer examen</span>
                              <span>Último examen</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
