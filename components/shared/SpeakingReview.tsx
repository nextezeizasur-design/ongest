'use client'

// components/shared/SpeakingReview.tsx
// Panel de corrección de respuestas de speaking para el docente
// Muestra transcripción + score automático + permite override manual

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SpeakingResponse {
  id: string
  transcript: string
  auto_score: number
  keywords_found: string[]
  similarity_pct: number
  manual_score: number | null
  teacher_note: string | null
}

interface SpeakingReviewProps {
  attemptId:      string
  questionId:     string
  questionBody:   string
  expectedAnswer?: string
  keywords?:      string[]
  points:         number
}

export default function SpeakingReview({
  attemptId,
  questionId,
  questionBody,
  expectedAnswer,
  keywords = [],
  points,
}: SpeakingReviewProps) {
  const supabase = createClient()

  const [response, setResponse]     = useState<SpeakingResponse | null>(null)
  const [manualScore, setManualScore] = useState<number>(0)
  const [note, setNote]             = useState('')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await (supabase as any)
        .from('speaking_responses')
        .select('*')
        .eq('attempt_id', attemptId)
        .eq('question_id', questionId)
        .maybeSingle()

      setResponse(data)
      setManualScore(data?.manual_score ?? data?.auto_score ?? 0)
      setNote(data?.teacher_note ?? '')
      setLoading(false)
    }
    load()
  }, [attemptId, questionId])

  async function saveManualScore() {
    if (!response) return
    setSaving(true)

    await (supabase as any)
      .from('speaking_responses')
      .update({ manual_score: manualScore, teacher_note: note })
      .eq('id', response.id)

    // Actualizar answers también
    const earnedPts = Math.round((manualScore / 100) * points * 10) / 10
    await (supabase as any)
      .from('answers')
      .update({
        points_earned: earnedPts,
        is_correct:    manualScore >= 60,
        grader_note:   note,
      })
      .eq('attempt_id', attemptId)
      .eq('question_id', questionId)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return <div className="text-xs text-gray-400 py-2">Cargando respuesta…</div>
  }

  if (!response) {
    return (
      <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-400 italic">
        El alumno no respondió esta pregunta.
      </div>
    )
  }

  const displayScore = response.manual_score ?? response.auto_score

  return (
    <div className="space-y-3">
      {/* Transcripción */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1.5">
          Transcripción del alumno
        </p>
        <p className="text-sm text-gray-800 leading-relaxed">{response.transcript}</p>
      </div>

      {/* Score automático + keywords */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5">
          <p className="text-xs text-purple-600 font-medium mb-0.5">Score automático</p>
          <p className="text-xl font-bold text-purple-800">{Math.round(response.auto_score)}%</p>
          {response.similarity_pct > 0 && (
            <p className="text-xs text-purple-500 mt-0.5">
              Similitud: {Math.round(response.similarity_pct)}%
            </p>
          )}
        </div>

        {keywords.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
            <p className="text-xs text-gray-500 font-medium mb-1.5">Keywords</p>
            <div className="flex flex-wrap gap-1">
              {keywords.map(kw => {
                const found = response.keywords_found?.includes(kw) ||
                  response.keywords_found?.some((f: string) =>
                    f.toLowerCase() === kw.toLowerCase()
                  )
                return (
                  <span
                    key={kw}
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      found
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-600 line-through'
                    }`}
                  >
                    {kw}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Respuesta modelo */}
      {expectedAnswer && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
          <p className="text-xs text-blue-600 font-medium mb-1">Respuesta modelo</p>
          <p className="text-sm text-blue-800 leading-relaxed">{expectedAnswer}</p>
        </div>
      )}

      {/* Score manual override */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900">Corrección manual</p>
          {saved && <span className="text-xs text-green-600">✓ Guardado</span>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Score final (0-100) · máx {points} pts
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={manualScore}
              onChange={e => setManualScore(Math.min(100, Math.max(0, Number(e.target.value))))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Puntos otorgados
            </label>
            <div className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-700">
              {(manualScore / 100 * points).toFixed(1)} / {points} pts
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Nota al alumno</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ej: Good pronunciation, work on verb tenses…"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        <button
          onClick={saveManualScore}
          disabled={saving}
          className="w-full py-2 text-sm text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#642f8d' }}
        >
          {saving ? 'Guardando…' : 'Guardar corrección'}
        </button>
      </div>
    </div>
  )
}
