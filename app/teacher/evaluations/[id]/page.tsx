'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ScoreBar from '@/components/ui/ScoreBar'
import Badge from '@/components/ui/Badge'
import StudentRadarCard from '@/components/shared/StudentRadarCard'

interface Answer {
  id: string
  question_id: string
  option_id?: string
  text_answer?: string
  is_correct?: boolean
  points_earned: number
  grader_note?: string
  questions: {
    id: string
    sort_order: number
    q_type: string
    body: string
    points: number
    options?: { id: string; body: string; is_correct: boolean }[]
  }
}

interface Attempt {
  id: string
  score?: number
  passed?: boolean
  status: string
  teacher_feedback?: string
  evaluations: { title: string; pass_score: number }
  profiles: { first_name: string; last_name: string; email: string }
}

export default function GradePage({ params }: { params: Promise<{ id: string }> }) {
  const router   = useRouter()
  const supabase = createClient()
  const sb       = supabase as any

  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [attempt,   setAttempt]   = useState<Attempt | null>(null)
  const [answers,   setAnswers]   = useState<Answer[]>([])
  const [points,    setPoints]    = useState<Record<string, number>>({})
  const [notes,     setNotes]     = useState<Record<string, string>>({})
  const [feedback,  setFeedback]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [studentId, setStudentId] = useState<string>('')
  const [graderId,  setGraderId]  = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    params.then(p => setAttemptId(p.id))
    sb.auth.getUser().then(({ data }: any) => {
      if (data?.user?.id) setGraderId(data.user.id)
    })
  }, [params])

  useEffect(() => {
    if (!attemptId) return
    async function load() {
      const [{ data: att }, { data: ans }] = await Promise.all([
        sb.from('attempts')
          .select('*, evaluations(title, pass_score), profiles!attempts_student_id_fkey(first_name, last_name, email)')
          .eq('id', attemptId)
          .single(),
        sb.from('answers')
          .select('*, questions(id, sort_order, q_type, body, points, options(id, body, is_correct))')
          .eq('attempt_id', attemptId),
      ])

      setAttempt(att)
      setAnswers((ans ?? []).sort((a: any, b: any) => (a.questions?.sort_order ?? 0) - (b.questions?.sort_order ?? 0)))
      setFeedback(att?.teacher_feedback ?? '')
      if (att?.student_id) setStudentId(att.student_id)

      const initialPoints: Record<string, number> = {}
      const initialNotes:  Record<string, string>  = {}
      ;(ans ?? []).forEach((a: any) => {
        initialPoints[a.id] = a.points_earned ?? 0
        initialNotes[a.id]  = a.grader_note ?? ''
      })
      setPoints(initialPoints)
      setNotes(initialNotes)
      setLoading(false)
    }
    load()
  }, [attemptId])

  async function handleSave(finalize: boolean) {
    if (!attemptId || !attempt) return
    setSaving(true)
    setSaveError(null)

    try {
      // 1. Guardar cada respuesta abierta
      for (const ans of answers) {
        const q = ans.questions
        if (!['short_answer', 'essay'].includes(q.q_type)) continue

        const earned = Math.min(Math.max(points[ans.id] ?? 0, 0), q.points)
        const { error: ansErr } = await sb.from('answers').update({
          points_earned: earned,
          grader_note:   notes[ans.id] ?? '',
          is_correct:    earned > 0,
        }).eq('id', ans.id)

        if (ansErr) throw new Error(`Error al guardar respuesta: ${ansErr.message}`)
      }

      // 2. Recalcular score desde BD (fuente de verdad)
      const { data: allAnswers, error: fetchErr } = await sb
        .from('answers')
        .select('points_earned, questions(points)')
        .eq('attempt_id', attemptId)

      if (fetchErr) throw new Error(`Error al recalcular score: ${fetchErr.message}`)

      let totalPoints = 0
      let earnedPoints = 0
      ;(allAnswers ?? []).forEach((a: any) => {
        totalPoints  += a.questions?.points ?? 0
        earnedPoints += a.points_earned ?? 0
      })
      const newScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
      const passed   = newScore >= (attempt.evaluations?.pass_score ?? 60)

      // 3. UPDATE del attempt — con graded_by y manejo de error explícito
      const updatePayload: Record<string, any> = {
        score:            newScore,
        passed:           passed,
        teacher_feedback: feedback,
        status:           finalize ? 'graded' : 'submitted',
        graded_at:        finalize ? new Date().toISOString() : null,
      }
      if (finalize && graderId) {
        updatePayload.graded_by = graderId
      }

      const { error: updateErr } = await sb
        .from('attempts')
        .update(updatePayload)
        .eq('id', attemptId)

      if (updateErr) throw new Error(`Error al finalizar corrección: ${updateErr.message}`)

      // 4. Solo navegar si todo salió OK
      setSaving(false)
      if (finalize) {
        router.push('/teacher/results')
      }

    } catch (err: any) {
      console.error('handleSave error:', err)
      setSaveError(err?.message ?? 'Error inesperado')
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center text-gray-400 text-sm">Cargando…</div>
  )
  if (!attempt) return (
    <div className="flex h-screen items-center justify-center text-gray-400 text-sm">Intento no encontrado.</div>
  )

  const student      = attempt.profiles
  const totalPts     = answers.reduce((a, ans) => a + (ans.questions?.points ?? 0), 0)
  const earnedPts    = Object.entries(points).reduce((acc, [id, pts]) => {
    const ans    = answers.find(a => a.id === id)
    const maxPts = ans?.questions?.points ?? 0
    return acc + Math.min(pts, maxPts)
  }, 0)
  const previewScore = totalPts > 0 ? Math.round((earnedPts / totalPts) * 100) : 0
  const passScore    = attempt.evaluations?.pass_score ?? 60

  return (
    <div className="flex h-screen flex-col bg-gray-50">

      {/* Header fijo */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5">
              <path d="M12 4L6 10l6 6"/>
            </svg>
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">
              Corrección — {attempt.evaluations?.title}
            </h1>
            <p className="text-xs text-gray-400">
              {student?.first_name} {student?.last_name} · {student?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <ScoreBar score={previewScore} />
            <Badge variant={previewScore >= passScore ? 'green' : 'red'}>
              {previewScore >= passScore ? 'Aprueba' : 'No aprueba'}
            </Badge>
          </div>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="btn-outline text-xs py-1.5"
          >
            Guardar borrador
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="btn-brand text-xs py-1.5"
          >
            {saving ? 'Guardando…' : 'Finalizar corrección'}
          </button>
        </div>
      </header>

      {/* Banner de error visible */}
      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center justify-between">
          <p className="text-sm text-red-700">⚠ {saveError}</p>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 text-xs">
            Cerrar
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-4">

          {/* Radar del alumno */}
          {studentId && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Radar de habilidades — {attempt?.profiles?.first_name} {attempt?.profiles?.last_name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Rendimiento acumulado en todas las evaluaciones
                  </p>
                </div>
                <a href="/results/radar" className="text-xs text-purple-600 hover:underline">
                  Ver completo →
                </a>
              </div>
              <StudentRadarCard
                studentId={studentId}
                studentName={`${attempt?.profiles?.first_name} ${attempt?.profiles?.last_name}`}
                compact={true}
              />
            </div>
          )}

          {/* Respuestas */}
          {answers.map((ans, idx) => {
            const q      = ans.questions
            const isObj  = ['multiple_choice', 'true_false'].includes(q.q_type)
            const isOpen = ['short_answer', 'essay'].includes(q.q_type)

            return (
              <div key={ans.id} className="card">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white flex-shrink-0"
                      style={{ background: '#642f8d' }}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      {isObj ? 'Objetiva' : isOpen ? 'Respuesta abierta' : q.q_type}
                      · {q.points} pt{q.points !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {isObj && (
                    <Badge variant={ans.is_correct ? 'green' : 'red'}>
                      {ans.is_correct ? 'Correcta' : 'Incorrecta'} · {ans.points_earned} pts
                    </Badge>
                  )}
                </div>

                <p className="text-sm font-medium text-gray-900 mb-3 leading-relaxed">{q.body}</p>

                {/* Objetiva — opciones */}
                {isObj && q.options && (
                  <div className="space-y-1.5 mb-3">
                    {q.options.map(opt => {
                      const isSelected = ans.option_id === opt.id
                      const color = opt.is_correct
                        ? 'border-green-300 bg-green-50'
                        : isSelected && !opt.is_correct
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-200 bg-gray-50'
                      return (
                        <div key={opt.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${color}`}>
                          <span className={`text-xs font-medium ${
                            opt.is_correct ? 'text-green-700' : isSelected ? 'text-red-700' : 'text-gray-400'
                          }`}>
                            {opt.is_correct ? '✓' : isSelected ? '✕' : '·'}
                          </span>
                          <span className={
                            opt.is_correct ? 'text-green-800' : isSelected ? 'text-red-800' : 'text-gray-600'
                          }>
                            {opt.body}
                          </span>
                          {isSelected && !opt.is_correct && (
                            <span className="ml-auto text-xs text-red-600">Respuesta del alumno</span>
                          )}
                          {opt.is_correct && (
                            <span className="ml-auto text-xs text-green-700">Correcta</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Abierta — respuesta + puntos */}
                {isOpen && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                      <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">
                        Respuesta del alumno
                      </p>
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {ans.text_answer || (
                          <span className="italic text-gray-400">Sin respuesta</span>
                        )}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Puntos asignados (máx. {q.points})</label>
                        <input
                          type="number"
                          min={0}
                          max={q.points}
                          step={0.5}
                          value={points[ans.id] ?? 0}
                          onChange={e => setPoints(prev => ({
                            ...prev,
                            [ans.id]: Math.min(Math.max(parseFloat(e.target.value) || 0, 0), q.points),
                          }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="label">Nota al alumno (opcional)</label>
                        <input
                          type="text"
                          value={notes[ans.id] ?? ''}
                          onChange={e => setNotes(prev => ({ ...prev, [ans.id]: e.target.value }))}
                          placeholder="Ej: Good attempt, but…"
                          className="input"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Feedback general */}
          <div className="card">
            <label className="label text-sm font-semibold text-gray-900 mb-2 block">
              Feedback general al alumno
            </label>
            <textarea
              rows={3}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Escribí un comentario general sobre el desempeño del alumno…"
              className="textarea"
            />
          </div>

          {/* Score preview */}
          <div className="card flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Score calculado</p>
              <p className="text-xs text-gray-400">{earnedPts.toFixed(1)} / {totalPts} puntos</p>
            </div>
            <div className="flex items-center gap-3">
              <ScoreBar score={previewScore} />
              <Badge variant={previewScore >= passScore ? 'green' : 'red'}>
                {previewScore >= passScore ? 'Aprobado' : 'Desaprobado'}
              </Badge>
            </div>
          </div>

          <div className="flex gap-3 justify-end pb-6">
            <button onClick={() => handleSave(false)} disabled={saving} className="btn-outline">
              Guardar borrador
            </button>
            <button onClick={() => handleSave(true)} disabled={saving} className="btn-brand px-6">
              {saving ? 'Guardando…' : 'Finalizar corrección ✓'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
