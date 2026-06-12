'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ExamAssetViewer from '@/components/shared/ExamAssetViewer'
import SpeakingQuestion from '@/components/shared/SpeakingQuestion'
import { ToastProvider, useToast } from '@/components/shared/Toast'
import { useConfirm } from '@/hooks/useConfirm'

// ── Interfaces alineadas con DB real ──
interface Option {
  id: string
  body: string
  sort_order: number
  question_id?: string
}

interface Question {
  id: string
  body: string
  q_type: string
  sort_order: number
  points: number
  options: Option[]
}

interface ExamData {
  id: string
  title: string
  description?: string
  instructions?: string
  time_limit_min?: number
  pass_score?: number
  questions: Question[]
}

interface AttemptData {
  id: string
  started_at: string
  // answers guardadas: question_id → option_id (MC) o text (open)
  answers: Record<string, string>
}


// Helper: etiqueta legible del tipo de pregunta
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

type Phase = 'instructions' | 'exam'

// ── Shuffle determinístico por alumno ────────────────────────────────────────
// Seed = attempt_id → mismo alumno recarga = mismo orden.
// Distinto alumno = distinto orden. Algoritmo: Fisher-Yates + PRNG xmur3.
function seedRng(seed: string): () => number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  }
  return function () {
    h += h << 13; h ^= h >>> 7
    h += h << 3;  h ^= h >>> 17
    h += h << 5
    return ((h >>> 0) / 4294967296)
  }
}

function shuffleWithSeed<T>(arr: T[], seed: string): T[] {
  const rng    = seedRng(seed)
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}


export default function ExamPageWrapper({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ToastProvider>
      <ExamPage params={params} />
    </ToastProvider>
  )
}

function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: examId } = use(params)
  const router   = useRouter()
  const supabase = createClient()
  const toast    = useToast()
  const { confirm, ConfirmDialogNode } = useConfirm()

  const [exam, setExam]             = useState<ExamData | null>(null)
  const [attempt, setAttempt]       = useState<AttemptData | null>(null)
  const [answers, setAnswers]       = useState<Record<string, string>>({})
  const [phase, setPhase]           = useState<Phase>('instructions')
  const [currentQ, setCurrentQ]     = useState(0)
  const [timeLeft, setTimeLeft]     = useState<number | null>(null)
  const [localTime, setLocalTime]   = useState<string>('')
  const [warnings, setWarnings]     = useState(0)
  const [showWarn, setShowWarn]     = useState(false)
  const [warnMsg, setWarnMsg]       = useState('')
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [userId, setUserId]         = useState<string>('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs para evitar stale closures
  const phaseRef     = useRef<Phase>('instructions')
  const attemptRef   = useRef<AttemptData | null>(null)
  const warningsRef  = useRef(0)
  const submittedRef = useRef(false)
  const answersRef   = useRef<Record<string, string>>({})
  const channelRef   = useRef<BroadcastChannel | null>(null)

  useEffect(() => { phaseRef.current    = phase    }, [phase])
  useEffect(() => { attemptRef.current  = attempt  }, [attempt])
  useEffect(() => { warningsRef.current = warnings }, [warnings])
  useEffect(() => { answersRef.current  = answers  }, [answers])

  // ── Detectar examen abierto en otra tab ──
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return

    const channel = new BroadcastChannel(`exam_${examId}`)
    channelRef.current = channel

    // Avisar a otras tabs que esta tab está activa
    channel.postMessage({ type: 'tab_opened' })

    channel.onmessage = (e) => {
      if (e.data.type === 'tab_opened' && phaseRef.current === 'exam') {
        // Otra tab abrió el mismo examen — avisar que ya está en curso acá
        channel.postMessage({ type: 'already_open' })
      }
      if (e.data.type === 'already_open' && phaseRef.current === 'exam') {
        // Esta tab recibió aviso de que el examen ya está abierto en otra tab
        setWarnMsg('⚠️ Este examen ya está abierto en otra pestaña. Cerrá esa pestaña para continuar aquí.')
        setShowWarn(true)
      }
    }

    return () => { channel.close() }
  }, [examId])

  // ── Cargar examen ──
  useEffect(() => {
    async function loadExam() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // 1. Evaluación base
      const { data: evalData, error: evalError } = await supabase
        .from('evaluations')
        .select('id, title, description, instructions, time_limit_min, pass_score')
        .eq('id', examId)
        .single()

      if (evalError || !evalData) { router.push('/exam'); return }

      // 2. Preguntas
      const { data: questionsRaw, error: qError } = await supabase
        .from('questions')
        .select('id, body, q_type, sort_order, points')
        .eq('evaluation_id', examId)
        .order('sort_order', { ascending: true })

      if (qError || !questionsRaw) { router.push('/exam'); return }

      // 3. Opciones
      const questionIds = questionsRaw.map(q => q.id)
      let optionsRaw: any[] = []

      if (questionIds.length > 0) {
        const { data: opts } = await supabase
          .from('options')
          .select('id, body, sort_order, question_id')
          .in('question_id', questionIds)
          .order('sort_order', { ascending: true })
        optionsRaw = opts ?? []
      }

      // Combinar en memoria
      const questionsBuilt: Question[] = questionsRaw.map(q => ({
        id:         q.id,
        body:       q.body,
        q_type:     q.q_type,
        sort_order: q.sort_order,
        points:     q.points,
        options:    optionsRaw
          .filter(o => o.question_id === q.id)
          .sort((a, b) => a.sort_order - b.sort_order),
      }))

      // Shuffle determinístico usando attempt_id como seed (si ya existe)
      // o userId+examId como fallback para la pantalla de instrucciones
      const { data: existingForSeed } = await supabase
        .from('attempts')
        .select('id')
        .eq('evaluation_id', examId)
        .eq('student_id', user.id)
        .eq('status', 'in_progress')
        .is('submitted_at', null)
        .maybeSingle()

      const shuffleSeed = existingForSeed?.id ?? `${user.id}-${examId}`

      const shuffledQuestions = shuffleWithSeed(questionsBuilt, shuffleSeed).map(q => ({
        ...q,
        // Mezclar opciones solo en tipos con opciones intercambiables
        options: ['multiple_choice', 'true_false'].includes(q.q_type)
          ? shuffleWithSeed(q.options, `${shuffleSeed}-${q.id}`)
          : q.options,
      }))

      const examData: ExamData = { ...evalData, questions: shuffledQuestions }
      setExam(examData)

      // 4. Buscar si hay un intento en_progress existente (reusar el ya consultado)
      const existingAttempt = existingForSeed
        ? await supabase
            .from('attempts')
            .select('id, started_at')
            .eq('id', existingForSeed.id)
            .single()
            .then(r => r.data)
        : null

      // Verificar si ya agotó los intentos
      if ((evalData as any).max_attempts) {
        const { count: usedCount } = await supabase
          .from('attempts')
          .select('id', { count: 'exact', head: true })
          .eq('evaluation_id', examId)
          .eq('student_id', user.id)
          .not('submitted_at', 'is', null)

        if ((usedCount ?? 0) >= (evalData as any).max_attempts && !existingAttempt) {
          setExam(examData)
          setPhase('instructions')
          setLoading(false)
          return
        }
      }

      if (existingAttempt) {
        // Hay un intento en curso — retomar automáticamente
        const { data: savedAnswers } = await supabase
          .from('answers')
          .select('question_id, option_id, text_answer')
          .eq('attempt_id', existingAttempt.id)

        const answerMap: Record<string, string> = {}
        savedAnswers?.forEach((a: any) => {
          answerMap[a.question_id] = a.option_id ?? a.text_answer ?? ''
        })

        const att: AttemptData = {
          id:         existingAttempt.id,
          started_at: existingAttempt.started_at,
          answers:    answerMap,
        }
        setAttempt(att)
        attemptRef.current = att
        setAnswers(answerMap)
        answersRef.current = answerMap

        // Solo ir directo al examen si ya había respuestas guardadas (retoma)
        if (Object.keys(answerMap).length > 0) {
          setPhase('exam')
          phaseRef.current = 'exam'

          // Restaurar posición de pregunta desde localStorage
          try {
            const savedPos = localStorage.getItem(`exam_pos_${existingAttempt.id}`)
            if (savedPos !== null) {
              const pos = parseInt(savedPos)
              if (!isNaN(pos) && pos >= 0) setCurrentQ(pos)
            }
          } catch {}

          if (examData.time_limit_min) {
            const elapsed   = Math.floor((Date.now() - new Date(existingAttempt.started_at).getTime()) / 1000)
            const remaining = examData.time_limit_min * 60 - elapsed
            setTimeLeft(remaining > 0 ? remaining : 0)
          }
        }
      }

      setLoading(false)
    }

    loadExam()
  }, [examId])

  // ── Reloj hora local ──
  useEffect(() => {
    function tick() {
      const now = new Date()
      setLocalTime(now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    const interval = setInterval(tick, 30_000)
    return () => clearInterval(interval)
  }, [])

  // ── Timer — sincronizado con DB ──
  useEffect(() => {
    if (phase !== 'exam' || timeLeft === null || !attempt || !exam?.time_limit_min) return
    if (timeLeft <= 0) { submitExam('timeout'); return }

    const interval = setInterval(() => {
      // Recalcular desde started_at cada tick para evitar desvío acumulado
      const elapsed   = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000)
      const remaining = exam.time_limit_min! * 60 - elapsed

      if (remaining <= 0) {
        clearInterval(interval)
        setTimeLeft(0)
        submitExam('timeout')
      } else {
        setTimeLeft(remaining)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [phase, attempt, exam])

  // ── Submit ──
  const submitExam = useCallback(async (reason: string = 'manual') => {
    if (submittedRef.current) return
    submittedRef.current = true

    const att = attemptRef.current
    if (!att) return

    setSubmitting(true)

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {})
      }

      // Limpiar posición guardada al entregar
      try { localStorage.removeItem(`exam_pos_${att.id}`) } catch {}

      // Actualizar attempt: submitted_at + status
      // timed_out y anti-cheat también llevan submitted_at para que cuenten como completados
      const finalStatus = reason === 'anti-cheat' ? 'flagged'
                        : reason === 'timeout'    ? 'timed_out'
                        : 'submitted'

      await supabase
        .from('attempts')
        .update({
          submitted_at: new Date().toISOString(),
          status:       finalStatus,
        })
        .eq('id', att.id)

      // Auto-calificar
      const { data: gradeData } = await supabase.rpc('auto_grade_attempt', {
        p_attempt_id: att.id,
      })

      // Generar recomendaciones automáticas (fire & forget)
      fetch('/api/recommendations/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ attempt_id: att.id }),
      }).catch(() => {})

      // Emitir certificado solo si NO hay preguntas de speaking (que requieren corrección manual)
      // Si hay speaking, el certificado se emite cuando el docente finaliza la corrección
      const hasSpeaking = questions.some((q: any) => q.q_type === 'speaking')
      if (!hasSpeaking) {
        fetch('/api/certificates/issue', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ attempt_id: att.id }),
        }).catch(() => {})
      }

      router.push('/results')

    } catch (err) {
      console.error('Error al entregar examen:', err)
      submittedRef.current = false
      setSubmitting(false)
      toast.error('Error al entregar', 'No se pudo enviar el examen. Verificá tu conexión e intentá de nuevo.')
    }
  }, [supabase])

  const handleSubmit = useCallback((reason: string = 'manual') => {
    submitExam(reason)
  }, [submitExam])

  // ── Anti-trampa ──
  useEffect(() => {
    function handleVisibility() {
      if (phaseRef.current !== 'exam') return
      if (document.visibilityState !== 'hidden') return

      const n = warningsRef.current + 1
      warningsRef.current = n
      setWarnings(n)

      if (n >= 3) {
        setWarnMsg('Recibiste 3 advertencias por cambiar de pestaña. Tu examen fue entregado automáticamente.')
        setShowWarn(true)
        setTimeout(() => submitExam('anti-cheat'), 2000)
      } else {
        const remaining = 3 - n
        setWarnMsg(`Advertencia ${n} de 3 — No salgas del examen. Te quedan ${remaining} oportunidad${remaining !== 1 ? 'es' : ''} antes de la entrega automática.`)
        setShowWarn(true)
        setTimeout(() => setShowWarn(false), 5000)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [submitExam])

  // ── Guardar respuesta ──
  async function saveAnswer(questionId: string, value: string, isOptionId: boolean) {
    const att = attemptRef.current
    if (!att) return

    setAnswers(prev => {
      const next = { ...prev, [questionId]: value }
      answersRef.current = next
      return next
    })

    // Guardar posición actual en localStorage para retomar si el browser se cierra
    try {
      localStorage.setItem(`exam_pos_${att.id}`, String(currentQ))
    } catch {}

    // Indicador visual: saving → saved / error
    setSaveStatus('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    const row = isOptionId
      ? { attempt_id: att.id, question_id: questionId, option_id: value,  text_answer: null  }
      : { attempt_id: att.id, question_id: questionId, option_id: null,   text_answer: value }

    // Retry automático: hasta 3 intentos con backoff 500ms / 1500ms
    let lastError: any = null
    for (let attempt_n = 0; attempt_n < 3; attempt_n++) {
      if (attempt_n > 0) await new Promise(r => setTimeout(r, attempt_n * 500))

      const { error } = await (supabase as any)
        .from('answers')
        .upsert(row, { onConflict: 'attempt_id,question_id' })

      if (!error) {
        lastError = null
        break
      }
      lastError = error
    }

    if (lastError) {
      setSaveStatus('error')
      toast.warning('No se guardó', 'Tu respuesta no se pudo guardar. Verificá tu conexión.')
    } else {
      setSaveStatus('saved')
      // Volver a idle después de 2 segundos para no distraer
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }

  // ── Iniciar examen ──
  async function startExam() {
    if (!exam) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Usar RPC que valida max_attempts, ventana de tiempo y doble attempt
    const { data, error } = await (supabase as any).rpc('start_attempt', {
      p_evaluation_id: exam.id,
      p_student_id:    user.id,
    })

    const result = Array.isArray(data) ? data[0] : data

    if (error || !result) {
      alert('Error al iniciar el examen. Intentá de nuevo.')
      return
    }

    if (result.error_code) {
      toast.error(
        result.error_code === 'max_attempts' ? 'Intentos agotados' : 'No podés iniciar este examen',
        result.error_msg ?? undefined
      )
      return
    }

    const attData: AttemptData = {
      id:         result.attempt_id,
      started_at: result.started_at,
      answers:    {},
    }
    setAttempt(attData)
    attemptRef.current = attData

    // Timer calculado desde started_at de la DB
    if (exam.time_limit_min) {
      const elapsed   = Math.floor((Date.now() - new Date(result.started_at).getTime()) / 1000)
      const remaining = exam.time_limit_min * 60 - elapsed
      setTimeLeft(remaining > 0 ? remaining : 0)
    }

    try { await document.documentElement.requestFullscreen() } catch {}

    setPhase('exam')
    phaseRef.current = 'exam'
  }

  function formatTime(s: number) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  }

  // ── LOADING ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Evaluación no encontrada.</p>
      </div>
    )
  }

  // ── INSTRUCCIONES ──
  if (phase === 'instructions') {

    // Verificar intentos agotados (el RPC ya los calculó — si no hay attempt y hay max_attempts, están agotados)
    const attemptsExhausted = !attempt && (exam as any).max_attempts != null && (exam as any).max_attempts > 0

    if (attemptsExhausted) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Intentos agotados</h1>
            <p className="text-gray-500 mb-6">
              Ya usaste todos los intentos disponibles para <strong>{exam.title}</strong>.
            </p>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-xl w-full p-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-6" style={{ backgroundColor: '#642f8d20' }}>
            📝
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{exam.title}</h1>
          {exam.description && <p className="text-gray-500 mb-6">{exam.description}</p>}

          <div className="bg-purple-50 rounded-xl p-5 mb-6 space-y-3">
            <h2 className="font-semibold text-gray-800">Instrucciones</h2>
            <p className="text-sm text-gray-600">{exam.instructions ?? 'Respondé todas las preguntas con atención.'}</p>
            <div className="flex flex-wrap gap-4 pt-2 text-sm">
              {exam.time_limit_min && (
                <span className="flex items-center gap-1.5 text-gray-700">⏱ {exam.time_limit_min} minutos</span>
              )}
              <span className="flex items-center gap-1.5 text-gray-700">
                📋 {exam.questions.length} pregunta{exam.questions.length !== 1 ? 's' : ''}
              </span>
              {exam.pass_score && (
                <span className="flex items-center gap-1.5 text-gray-700">🎯 Mínimo aprobatorio: {exam.pass_score}%</span>
              )}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium mb-1">⚠️ Importante</p>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              <li>El examen se realiza en pantalla completa.</li>
              <li>No cambies de pestaña ni minimices el navegador.</li>
              <li>Tres infracciones = entrega automática.</li>
              <li>Las respuestas se guardan automáticamente.</li>
            </ul>
          </div>

          <button
            onClick={startExam}
            className="w-full py-3 text-white font-semibold rounded-xl text-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#642f8d' }}
          >
            Comenzar examen
          </button>
        </div>
      </div>
    )
  }

  // ── EXAMEN ──
  const question  = exam.questions[currentQ]
  const answered  = Object.keys(answers).length
  const total     = exam.questions.length
  const isLowTime = timeLeft !== null && timeLeft < 60
  const isMC      = question.q_type === 'multiple_choice' || question.q_type === 'true_false'

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Overlay advertencia */}
      {showWarn && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
            <div className="text-5xl mb-4">🚨</div>
            <p className="text-gray-800 font-medium">{warnMsg}</p>
            {warnings < 3 && (
              <button onClick={() => setShowWarn(false)} className="mt-6 px-6 py-2 text-white rounded-lg" style={{ backgroundColor: '#642f8d' }}>
                Entendido
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-3 md:px-4 py-2.5 md:py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-gray-900 text-xs md:text-sm truncate max-w-[140px] md:max-w-[200px]">
            {exam.title}
          </span>
          {warnings > 0 && (
            <span className="bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
              ⚠️ {warnings}/3
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          <span className="text-xs text-gray-500 hidden sm:inline">{answered}/{total} respondidas</span>

          {/* Indicador de auto-save */}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                <path d="M8 2a6 6 0 0 1 0 12" strokeLinecap="round"/>
              </svg>
              Guardando…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2.5}>
                <polyline points="2,8 6,12 14,4"/>
              </svg>
              Guardado
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
              </svg>
              Sin conexión
            </span>
          )}
          {/* ✅ Hora local — ayuda al alumno a manejar el tiempo real */}
          {localTime && (
            <span className="hidden sm:inline text-xs text-gray-400 font-mono">
              🕐 {localTime}
            </span>
          )}
          {timeLeft !== null && (
            <span className={`font-mono font-bold text-xs md:text-sm px-2 md:px-3 py-1 rounded-lg ${
              isLowTime ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-gray-100 text-gray-700'
            }`}>
              ⏱ {formatTime(timeLeft)}
            </span>
          )}
          <button
            onClick={async () => {
              const ok = await confirm({
                title:       'Entregar examen',
                message:     '¿Estás seguro? Una vez entregado no podés modificar tus respuestas.',
                confirmText: 'Entregar',
                cancelText:  'Seguir respondiendo',
                variant:     'warning',
              })
              if (ok) handleSubmit('manual')
            }}
            disabled={submitting}
            className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm text-white rounded-lg disabled:opacity-60 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#642f8d' }}
          >
            {submitting ? 'Enviando…' : 'Entregar'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar numeración — oculto en mobile, visible en desktop */}
        <aside className="hidden md:flex w-20 bg-white border-r border-gray-200 flex-col items-center py-4 gap-2 overflow-y-auto">
          {exam.questions.map((q, i) => {
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

        {/* Pregunta */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <div className="max-w-2xl mx-auto space-y-4">

            {/* Numeración mobile — scroll horizontal */}
            <div className="flex md:hidden gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {exam.questions.map((q, i) => {
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

            {/* PDF y audio si la evaluación tiene assets */}
            <ExamAssetViewer
              evaluationId={exam.id}
              attemptId={attempt?.id}
            />

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
                  <p className="text-gray-900 font-medium mt-1 text-lg leading-snug">{question.body}</p>
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
                        onClick={() => saveAnswer(question.id, opt.id, true)}
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
                  onChange={e => saveAnswer(question.id, e.target.value, false)}
                  placeholder="Escribí tu respuesta aquí…"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                />
              )}

              {/* Desarrollo */}
              {question.q_type === 'essay' && (
                <textarea
                  value={answers[question.id] ?? ''}
                  onChange={e => saveAnswer(question.id, e.target.value, false)}
                  rows={6}
                  placeholder="Desarrollá tu respuesta aquí…"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-purple-500 transition-colors"
                />
              )}

              {/* Speaking */}
              {question.q_type === 'speaking' && attempt && (
                <SpeakingQuestion
                  questionId={question.id}
                  attemptId={attempt.id}
                  studentId={userId}
                  questionBody={question.body}
                  expectedAnswer={(question as any).expected_answer}
                  keywords={(question as any).keywords ?? []}
                  timeLimitSec={(question as any).speaking_time_sec ?? 60}
                  savedTranscript={answers[question.id]}
                  onAnswered={(transcript, score) => {
                    saveAnswer(question.id, transcript, false)
                  }}
                />
              )}
            </div>

            {/* Prev / Next */}
            <div className="flex justify-between gap-3">
              <button
                onClick={() => setCurrentQ(p => Math.max(0, p - 1))}
                disabled={currentQ === 0}
                className="px-5 py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setCurrentQ(p => Math.min(total - 1, p + 1))}
                disabled={currentQ === total - 1}
                className="px-5 py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>  {/* cierre space-y-4 */}
        </main>
      </div>
      {ConfirmDialogNode}
    </div>
  )
}
