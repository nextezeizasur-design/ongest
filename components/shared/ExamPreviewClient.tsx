'use client'
// components/shared/ExamPreviewClient.tsx
//
// Vista previa de examen para el docente/coordinador: renderiza la MISMA
// pantalla que ve el alumno en app/exam/[id]/page.tsx (mismo diseño, mismo
// tipo de pregunta por vez, mismo resaltado de huecos en MC Cloze), pero
// sin ninguno de los efectos reales del examen:
//   - no crea ni toca ningún `attempt` en la base
//   - no hay timer que corra en contra de nadie
//   - las respuestas elegidas quedan solo en memoria de esta pantalla
//   - no hay botón "Entregar"
// Así el docente puede navegar pregunta por pregunta para señalar dudas
// ("mirá la 5") sin consumir el intento real de ningún alumno.

import { useState } from 'react'
import ExamAssetViewer from '@/components/shared/ExamAssetViewer'

interface Option {
  id: string
  body: string
  sort_order: number
}

interface Question {
  id: string
  body: string
  q_type: string
  sort_order: number
  points: number
  options: Option[]
}

interface ExamPreviewClientProps {
  evaluationId: string
  title: string
  instructions?: string | null
  timeLimitMin?: number | null
  questions: Question[]
}

function qTypeLabel(q_type: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    multiple_choice: { label: 'Opción múltiple',   color: 'bg-blue-100 text-blue-700'   },
    true_false:      { label: 'Verdadero / Falso',  color: 'bg-teal-100 text-teal-700'   },
    short_answer:    { label: 'Respuesta corta',    color: 'bg-amber-100 text-amber-700' },
    essay:           { label: 'Desarrollo',         color: 'bg-purple-100 text-purple-700'},
    speaking:        { label: '🎙 Speaking',         color: 'bg-pink-100 text-pink-700'   },
  }
  return map[q_type] ?? { label: q_type, color: 'bg-gray-100 text-gray-600' }
}

// En MC Cloze, cada hueco es una pregunta aparte que repite el párrafo
// completo. Esto separa la consigna de cierre ("Which word is correct for
// gap (N)?") y resalta el número de hueco (N) dentro del párrafo — idéntico
// a lo que ve el alumno en app/exam/[id]/page.tsx.
function renderQuestionBody(body: string) {
  const blocks = body.split('\n\n').filter(Boolean)
  const gapRegex = /Which word is correct for gap \((\d+)\)\s*\??/i
  const gapBlockIdx = blocks.findIndex(b => gapRegex.test(b))
  const gapMatch  = gapBlockIdx >= 0 ? blocks[gapBlockIdx].match(gapRegex) : null
  const gapToken  = gapMatch ? `(${gapMatch[1]})` : null

  return blocks.map((block, bi) => {
    if (bi === gapBlockIdx) {
      return (
        <p key={bi} className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5 mt-2">
          <span>👉</span>{block}
        </p>
      )
    }
    if (gapToken && block.includes(gapToken)) {
      const parts = block.split(gapToken)
      return (
        <p key={bi} className="text-gray-900 font-medium text-lg leading-snug">
          {parts.map((part, pi) => (
            <span key={pi}>
              {part}
              {pi < parts.length - 1 && (
                <mark className="bg-yellow-200 text-purple-800 font-bold rounded px-1">{gapToken}</mark>
              )}
            </span>
          ))}
        </p>
      )
    }
    if (block.startsWith('❓ ')) {
      return (
        <p key={bi} className="flex items-start gap-1.5 text-base font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mt-2">
          <span>❓</span><span>{block.slice(2).trim()}</span>
        </p>
      )
    }
    return <p key={bi} className="text-gray-900 font-medium text-lg leading-snug">{block}</p>
  })
}

export default function ExamPreviewClient({
  evaluationId, title, instructions, timeLimitMin, questions,
}: ExamPreviewClientProps) {
  const [currentQ, setCurrentQ] = useState(0)
  const [answers,  setAnswers]  = useState<Record<string, string>>({})

  const total    = questions.length
  if (total === 0) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        Esta evaluación todavía no tiene preguntas cargadas.
      </div>
    )
  }

  const question = questions[currentQ]
  const isMC     = question.q_type === 'multiple_choice' || question.q_type === 'true_false'
  const isOpen   = question.q_type === 'short_answer' || question.q_type === 'essay'

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Banner — deja clarísimo que esto no es el examen real */}
      <div className="bg-amber-400 text-amber-950 text-center text-sm font-semibold py-1.5">
        👁️ Vista previa docente — pantalla idéntica a la del alumno. No se registra ni se envía nada.
      </div>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
          {timeLimitMin != null && (
            <p className="text-xs text-gray-400">Tiempo límite real: {timeLimitMin} min (acá no corre)</p>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar numeración — oculto en mobile, visible en desktop */}
        <aside className="hidden md:flex w-20 bg-white border-r border-gray-200 flex-col items-center py-4 gap-2 overflow-y-auto">
          {questions.map((q, i) => {
            const done    = !!answers[q.id]
            const current = i === currentQ
            return (
              <button
                key={q.id}
                onClick={() => setCurrentQ(i)}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                  current ? 'text-white shadow-md'
                  : done   ? 'bg-green-100 text-green-800 hover:bg-green-200'
                           : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={current ? { backgroundColor: '#642f8d' } : {}}
              >
                {i + 1}
              </button>
            )
          })}
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <div className="max-w-2xl mx-auto space-y-4">

            {/* Numeración mobile — scroll horizontal */}
            <div className="flex md:hidden gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {questions.map((q, i) => {
                const done    = !!answers[q.id]
                const current = i === currentQ
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQ(i)}
                    className={`w-9 h-9 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
                      current ? 'text-white shadow-md'
                      : done   ? 'bg-green-100 text-green-800'
                               : 'bg-gray-100 text-gray-600'
                    }`}
                    style={current ? { backgroundColor: '#642f8d' } : {}}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>

            {instructions && currentQ === 0 && (
              <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3 text-sm text-purple-900">
                {instructions}
              </div>
            )}

            {/* PDF y audio si la evaluación tiene assets — sin attemptId: solo lectura */}
            <ExamAssetViewer evaluationId={evaluationId} />

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                      Pregunta {currentQ + 1} de {total}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${qTypeLabel(question.q_type).color}`}>
                      {qTypeLabel(question.q_type).label}
                    </span>
                  </div>
                  <div className="mt-1 space-y-1.5">{renderQuestionBody(question.body)}</div>
                </div>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full whitespace-nowrap">
                  {question.points} pt{question.points !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Opciones MC / True-False */}
              {isMC && (
                <div className="space-y-2.5 md:space-y-3">
                  {question.options.map(opt => {
                    const selected = answers[question.id] === opt.id
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setAnswers(prev => ({ ...prev, [question.id]: opt.id }))}
                        className={`w-full text-left px-4 py-3.5 md:py-3 rounded-xl border-2 transition-all text-sm ${
                          selected
                            ? 'border-purple-500 bg-purple-50 text-purple-900 font-medium'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {opt.body}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Respuesta corta */}
              {question.q_type === 'short_answer' && (
                <input
                  type="text"
                  value={answers[question.id] ?? ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                  placeholder="Escribí tu respuesta…"
                  className="input w-full"
                />
              )}

              {/* Desarrollo / Essay */}
              {question.q_type === 'essay' && (
                <textarea
                  rows={6}
                  value={answers[question.id] ?? ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                  placeholder="Escribí tu respuesta…"
                  className="textarea w-full"
                />
              )}

              {/* Speaking — acá no se graba audio real, es solo para mostrar la consigna */}
              {question.q_type === 'speaking' && (
                <div className="rounded-xl border-2 border-dashed border-pink-200 bg-pink-50 p-6 text-center">
                  <p className="text-3xl mb-2">🎙️</p>
                  <p className="text-sm text-pink-800">
                    Acá el alumno graba su respuesta de audio.
                    En esta vista previa no se graba nada.
                  </p>
                </div>
              )}

              {isOpen && (
                <p className="text-xs text-gray-400 mt-2">
                  Corrección manual — no tiene respuesta correcta predefinida.
                </p>
              )}
            </div>

            {/* Navegación */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
                disabled={currentQ === 0}
                className="btn-outline text-sm disabled:opacity-30"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setCurrentQ(q => Math.min(total - 1, q + 1))}
                disabled={currentQ === total - 1}
                className="btn-outline text-sm disabled:opacity-30"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
