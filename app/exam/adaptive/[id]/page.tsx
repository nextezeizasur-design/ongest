'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdaptiveExam, AdaptiveOption } from '@/hooks/useAdaptiveExam'
import StudentRadarCard from '@/components/shared/StudentRadarCard'
import { createClient } from '@/lib/supabase/client'

const DIFFICULTY_CONFIG = {
  easy:   { label: 'Básico',     color: 'bg-green-100 text-green-700', bar: 'bg-green-400' },
  medium: { label: 'Intermedio', color: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' },
  hard:   { label: 'Avanzado',   color: 'bg-red-100 text-red-700',     bar: 'bg-red-400'   },
}

const SKILL_EMOJI: Record<string, string> = {
  grammar:    '📝',
  listening:  '🎧',
  reading:    '📖',
  writing:    '✏️',
  speaking:   '🗣️',
  vocabulary: '📚',
}

export default function AdaptiveExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: evaluationId } = use(params)
  const router   = useRouter()
  const supabase = createClient()

  const { state, loading, error, startAdaptiveExam, answerQuestion } = useAdaptiveExam(evaluationId)

  const [phase, setPhase]               = useState<'intro' | 'exam' | 'result'>('intro')
  const [selected, setSelected]         = useState<string | null>(null)
  const [textAnswer, setTextAnswer]     = useState('')
  const [answered, setAnswered]         = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [userId, setUserId]             = useState<string>('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (state.isComplete && phase === 'exam') {
      setTimeout(() => setPhase('result'), 800)
    }
  }, [state.isComplete])

  async function handleStart() {
    await startAdaptiveExam()
    setPhase('exam')
  }

  async function handleAnswer() {
    if (!state.currentQuestion) return
    if (!selected && !textAnswer.trim()) return
    setAnswered(true)
    setShowFeedback(true)
    setTimeout(async () => {
      await answerQuestion(state.currentQuestion!.id, selected, textAnswer || null)
      setSelected(null)
      setTextAnswer('')
      setAnswered(false)
      setShowFeedback(false)
    }, 1200)
  }

  const q        = state.currentQuestion
  const diff     = q ? DIFFICULTY_CONFIG[q.difficulty_label] : null
  const progress = state.totalQuestions > 0
    ? Math.round((state.questionsAnswered / state.totalQuestions) * 100) : 0

  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full p-8">
          <div className="text-5xl mb-4 text-center">🧠</div>
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Evaluación Adaptativa</h1>
          <p className="text-gray-500 text-center mb-6 text-sm">
            Este examen se adapta en tiempo real a tu nivel.
            Las preguntas serán más fáciles o más difíciles según tus respuestas.
          </p>
          <div className="bg-purple-50 rounded-xl p-5 mb-6 space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <span className="text-xl">📊</span>
              <span><strong>{state.totalQuestions} preguntas</strong> adaptadas a tu nivel</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <span className="text-xl">⚡</span>
              <span>La dificultad <strong>sube o baja</strong> automáticamente</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <span className="text-xl">🎯</span>
              <span>Tu nivel se <strong>mide con precisión</strong> en cada respuesta</span>
            </div>
          </div>
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-3 text-white font-semibold rounded-xl text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#642f8d' }}
          >
            {loading ? 'Preparando examen…' : 'Comenzar evaluación →'}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    const correctCount = state.history.filter(h => h.isCorrect).length
    const pct          = state.history.length > 0
      ? Math.round((correctCount / state.history.length) * 100) : 0
    const finalAbility = state.abilityScore
    const cefrLevel    =
      finalAbility >= 85 ? 'C1–C2' :
      finalAbility >= 70 ? 'B2'    :
      finalAbility >= 55 ? 'B1'    :
      finalAbility >= 40 ? 'A2'    : 'A1'

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full p-8">
          <div className="text-6xl text-center mb-4">{pct >= 60 ? '🎉' : '📚'}</div>
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Evaluación completada</h1>
          <p className="text-gray-500 text-center text-sm mb-6">
            Tu nivel fue calculado en base a tus respuestas
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold" style={{ color: pct >= 60 ? '#16a34a' : '#dc2626' }}>
                {pct}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Respuestas correctas</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-purple-700">{cefrLevel}</p>
              <p className="text-xs text-gray-500 mt-1">Nivel estimado</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>A1</span>
              <span className="font-semibold text-gray-700">Habilidad: {Math.round(finalAbility)}/100</span>
              <span>C2</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${finalAbility}%`, backgroundColor: '#642f8d' }}
              />
            </div>
          </div>

          {/* Radar compacto */}
          {userId && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Tu radar de habilidades
              </p>
              <StudentRadarCard
                studentId={userId}
                studentName="Tu rendimiento acumulado"
                compact={true}
              />
              <a
                href="/results/radar"
                className="block text-center text-xs text-purple-600 hover:underline mt-3"
              >
                Ver radar completo →
              </a>
            </div>
          )}

          <div className="mb-6 space-y-2 max-h-36 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Recorrido del examen
            </p>
            {state.history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  h.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {h.isCorrect ? '✓' : '✗'}
                </span>
                <span className="flex-1 text-gray-700 truncate">{h.body.slice(0, 50)}…</span>
                <span className="text-xs text-gray-400">{SKILL_EMOJI[h.skill]} {h.difficulty}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push('/exam')}
            className="w-full py-3 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#642f8d' }}
          >
            Ver mis evaluaciones
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">
              Pregunta {state.questionsAnswered + 1} de {state.totalQuestions}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Nivel:</span>
              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${state.abilityScore}%`, backgroundColor: '#642f8d' }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-700">{Math.round(state.abilityScore)}</span>
            </div>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 bg-purple-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-6 pt-8">
        <div className="max-w-2xl w-full space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              ⚠️ {error}
            </div>
          )}

          {q && (
            <div className={`bg-white rounded-2xl shadow-sm border-2 transition-all duration-300 ${
              showFeedback
                ? selected && q.options.find(o => o.id === selected)?.is_correct
                  ? 'border-green-400' : 'border-red-300'
                : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{SKILL_EMOJI[q.skill]}</span>
                  <span className="text-xs text-gray-500 capitalize">{q.skill}</span>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${diff?.color}`}>
                  {diff?.label}
                </span>
              </div>

              <div className="p-5">
                <p className="text-gray-900 font-medium text-lg leading-snug mb-5">{q.body}</p>

                {(q.q_type === 'multiple_choice' || q.q_type === 'true_false') && (
                  <div className="space-y-2.5">
                    {q.options.map((opt: AdaptiveOption) => {
                      const isSelected   = selected === opt.id
                      const isCorrectOpt = opt.is_correct
                      let optStyle = 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                      if (showFeedback && isSelected) {
                        optStyle = isCorrectOpt
                          ? 'border-green-500 bg-green-50 text-green-900'
                          : 'border-red-400 bg-red-50 text-red-900'
                      } else if (showFeedback && isCorrectOpt) {
                        optStyle = 'border-green-300 bg-green-50 text-green-800'
                      } else if (isSelected) {
                        optStyle = 'border-purple-500 bg-purple-50 text-purple-900 font-medium'
                      }
                      return (
                        <button
                          key={opt.id}
                          onClick={() => !answered && setSelected(opt.id)}
                          disabled={answered}
                          className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm ${optStyle}`}
                        >
                          <div className="flex items-center gap-2">
                            {showFeedback && isSelected && <span>{isCorrectOpt ? '✓' : '✗'}</span>}
                            {opt.body}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {q.q_type === 'short_answer' && (
                  <input
                    type="text"
                    value={textAnswer}
                    onChange={e => setTextAnswer(e.target.value)}
                    disabled={answered}
                    placeholder="Escribí tu respuesta…"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                    onKeyDown={e => e.key === 'Enter' && !answered && handleAnswer()}
                  />
                )}

                {q.q_type === 'essay' && (
                  <textarea
                    value={textAnswer}
                    onChange={e => setTextAnswer(e.target.value)}
                    disabled={answered}
                    rows={4}
                    placeholder="Desarrollá tu respuesta…"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-purple-500 transition-colors"
                  />
                )}

                {!showFeedback && (
                  <button
                    onClick={handleAnswer}
                    disabled={answered || loading || (!selected && !textAnswer.trim())}
                    className="mt-4 w-full py-3 text-white font-semibold rounded-xl transition-all disabled:opacity-40 hover:opacity-90"
                    style={{ backgroundColor: '#642f8d' }}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Cargando siguiente…
                      </span>
                    ) : 'Confirmar respuesta'}
                  </button>
                )}

                {showFeedback && (
                  <div className={`mt-4 rounded-xl p-3 text-sm font-medium text-center ${
                    selected && q.options.find(o => o.id === selected)?.is_correct
                      ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'
                  }`}>
                    {selected && q.options.find(o => o.id === selected)?.is_correct
                      ? '✅ ¡Correcto! La siguiente pregunta será un poco más difícil.'
                      : '❌ Incorrecto. La siguiente pregunta se ajustará a tu nivel.'}
                  </div>
                )}
              </div>

              <div className="px-5 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Dificultad:</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${diff?.bar}`}
                      style={{ width: `${q.difficulty_score}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{q.difficulty_score}/100</span>
                </div>
              </div>
            </div>
          )}

          {state.history.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {state.history.map((h, i) => (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    h.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}
                  title={`P${i + 1}: ${h.isCorrect ? 'Correcta' : 'Incorrecta'} · Dif. ${h.difficulty}`}
                >
                  {h.isCorrect ? '✓' : '✗'}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
