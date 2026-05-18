'use client'
// components/teacher/SpeakingReviewer.tsx
// Issue 3: El docente puede escuchar grabaciones de speaking y dejar feedback

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SpeakingAnswer {
  answerId:    string
  questionId:  string
  questionBody: string
  studentName: string
  studentId:   string
  attemptId:   string
  transcript?: string
  audioPath?:  string
  audioUrl?:   string
  manualScore?: number | null
  feedbackText?: string | null
  maxPoints:   number
}

interface Props {
  evaluationId: string
}

export default function SpeakingReviewer({ evaluationId }: Props) {
  const supabase = createClient()
  const sb = supabase as any

  const [items,    setItems]    = useState<SpeakingAnswer[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [scores,   setScores]   = useState<Record<string, number | null>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})

  useEffect(() => { loadSpeakingAnswers() }, [evaluationId])

  async function loadSpeakingAnswers() {
    setLoading(true)

    // Preguntas de tipo speaking de esta evaluación
    const { data: questions } = await sb
      .from('questions')
      .select('id, body, points')
      .eq('evaluation_id', evaluationId)
      .eq('q_type', 'speaking')

    if (!questions?.length) { setLoading(false); return }

    const questionIds = questions.map((q: any) => q.id)

    // Respuestas de speaking con datos de alumno e intento
    const { data: answers } = await sb
      .from('answers')
      .select(`
        id,
        question_id,
        text_answer,
        audio_path,
        manual_score,
        feedback_text,
        attempt_id,
        attempts (
          student_id,
          profiles ( first_name, last_name )
        )
      `)
      .in('question_id', questionIds)

    if (!answers?.length) { setLoading(false); return }

    // Generar URLs de audio firmadas
    const results: SpeakingAnswer[] = []

    for (const ans of answers) {
      const q = questions.find((q: any) => q.id === ans.question_id)
      const profile = ans.attempts?.profiles

      let audioUrl: string | undefined
      if (ans.audio_path) {
        const { data: signed } = await sb
          .storage
          .from('speaking-recordings')
          .createSignedUrl(ans.audio_path, 3600) // 1 hora
        audioUrl = signed?.signedUrl
      }

      results.push({
        answerId:     ans.id,
        questionId:   ans.question_id,
        questionBody: q?.body ?? '',
        studentName:  profile ? `${profile.first_name} ${profile.last_name}` : 'Alumno',
        studentId:    ans.attempts?.student_id ?? '',
        attemptId:    ans.attempt_id,
        transcript:   ans.text_answer,
        audioPath:    ans.audio_path,
        audioUrl,
        manualScore:  ans.manual_score,
        feedbackText: ans.feedback_text,
        maxPoints:    q?.points ?? 10,
      })
    }

    setItems(results)

    // Inicializar scores y feedback del estado guardado
    const initScores: Record<string, number | null> = {}
    const initFeedback: Record<string, string> = {}
    results.forEach(r => {
      initScores[r.answerId]   = r.manualScore ?? null
      initFeedback[r.answerId] = r.feedbackText ?? ''
    })
    setScores(initScores)
    setFeedback(initFeedback)

    setLoading(false)
  }

  async function saveCorrection(answerId: string) {
    setSaving(answerId)
    const score = scores[answerId]
    const fb    = feedback[answerId] ?? ''

    const { error } = await sb
      .from('answers')
      .update({
        manual_score:  score,
        feedback_text: fb.trim() || null,
      })
      .eq('id', answerId)

    if (!error) {
      setItems(prev => prev.map(it =>
        it.answerId !== answerId ? it : { ...it, manualScore: score, feedbackText: fb }
      ))
    }
    setSaving(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!items.length) return (
    <div className="card text-center py-10 text-gray-400 text-sm">
      No hay respuestas de speaking para corregir.
    </div>
  )

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">
        🎙 Speaking — {items.length} respuesta{items.length !== 1 ? 's' : ''} para revisar
      </h3>

      {items.map(item => (
        <div key={item.answerId} className="card space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                  style={{ background: '#642f8d' }}>
                  {item.studentName[0]}
                </div>
                <p className="text-sm font-medium text-gray-900">{item.studentName}</p>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">Pregunta:</span> {item.questionBody}
              </p>
            </div>
            {item.manualScore !== null && item.manualScore !== undefined && (
              <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full flex-shrink-0">
                {item.manualScore} / {item.maxPoints} pts
              </span>
            )}
          </div>

          {/* Audio player */}
          {item.audioUrl ? (
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">🎵 Grabación</p>
              <audio
                ref={el => { audioRefs.current[item.answerId] = el }}
                controls
                className="w-full"
                src={item.audioUrl}
                preload="none"
              />
            </div>
          ) : item.audioPath ? (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              ⚠️ No se pudo cargar el audio (URL expirada). Recargá la página.
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">Sin grabación de audio.</p>
          )}

          {/* Transcripción */}
          {item.transcript && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">📝 Transcripción automática</p>
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700">
                {item.transcript}
              </div>
            </div>
          )}

          {/* Corrección del docente */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Tu corrección</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Puntaje (máx {item.maxPoints})</label>
                <input
                  type="number"
                  min={0}
                  max={item.maxPoints}
                  value={scores[item.answerId] ?? ''}
                  onChange={e => setScores(prev => ({
                    ...prev,
                    [item.answerId]: e.target.value === '' ? null : Number(e.target.value)
                  }))}
                  className="input"
                  placeholder="0"
                />
              </div>
              <div className="flex items-end">
                <div className="text-xs text-gray-400">
                  {scores[item.answerId] !== null && scores[item.answerId] !== undefined
                    ? `${Math.round((scores[item.answerId]! / item.maxPoints) * 100)}%`
                    : '—'
                  }
                </div>
              </div>
            </div>

            <div>
              <label className="label">Feedback para el alumno</label>
              <textarea
                rows={3}
                value={feedback[item.answerId] ?? ''}
                onChange={e => setFeedback(prev => ({ ...prev, [item.answerId]: e.target.value }))}
                placeholder="Escribí comentarios sobre la pronunciación, fluidez, vocabulario…"
                className="textarea"
              />
            </div>

            <button
              onClick={() => saveCorrection(item.answerId)}
              disabled={saving === item.answerId}
              className="btn-brand text-sm"
            >
              {saving === item.answerId ? 'Guardando…' : '💾 Guardar corrección'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
