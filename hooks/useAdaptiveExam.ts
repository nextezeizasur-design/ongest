import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface AdaptiveOption {
  id: string
  body: string
  is_correct: boolean
  sort_order: number
}

export interface AdaptiveQuestion {
  id: string
  body: string
  q_type: string
  difficulty_score: number
  difficulty_label: 'easy' | 'medium' | 'hard'
  skill: string
  points: number
  options: AdaptiveOption[]
}

export interface AdaptiveHistoryEntry {
  questionId: string
  body: string
  difficulty: number
  skill: string
  isCorrect: boolean
  abilityAfter: number
}

export interface AdaptiveState {
  attemptId: string
  abilityScore: number
  currentQuestion: AdaptiveQuestion | null
  questionsAnswered: number
  totalQuestions: number
  isComplete: boolean
  history: AdaptiveHistoryEntry[]
}

export function useAdaptiveExam(evaluationId: string, adaptiveLength: number = 10) {
  const supabase = createClient()

  const [state, setState] = useState<AdaptiveState>({
    attemptId:         '',
    abilityScore:      50,
    currentQuestion:   null,
    questionsAnswered: 0,
    totalQuestions:    adaptiveLength,
    isComplete:        false,
    history:           [],
  })

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const seenIdsRef              = useRef<string[]>([])
  const attemptIdRef            = useRef<string>('')
  const abilityRef              = useRef<number>(50)
  const stateRef                = useRef<AdaptiveState>(state)

  // Mantener ref sincronizada con state para usar en closures
  const updateState = useCallback((updater: (prev: AdaptiveState) => AdaptiveState) => {
    setState(prev => {
      const next = updater(prev)
      stateRef.current = next
      return next
    })
  }, [])

  async function fetchNextQuestion(
    ability: number,
    seen: string[]
  ): Promise<AdaptiveQuestion | null> {
    const { data: rows, error: rpcError } = await supabase.rpc('get_next_adaptive_question', {
      p_evaluation_id: evaluationId,
      p_ability_score: ability,
      p_seen_ids:      seen.length > 0 ? seen : null,
    })

    if (rpcError || !rows || rows.length === 0) return null

    const q = rows[0]

    const { data: options } = await supabase
      .from('options')
      .select('id, body, is_correct, sort_order')
      .eq('question_id', q.question_id)
      .order('sort_order', { ascending: true })

    return {
      id:               q.question_id,
      body:             q.body,
      q_type:           q.q_type,
      difficulty_score: q.difficulty_score,
      difficulty_label: q.difficulty_label as 'easy' | 'medium' | 'hard',
      skill:            q.skill,
      points:           q.points,
      options:          options ?? [],
    }
  }

  const startAdaptiveExam = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: attempt, error: attError } = await supabase
        .from('attempts')
        .insert({
          evaluation_id: evaluationId,
          student_id:    user.id,
          started_at:    new Date().toISOString(),
          status:        'in_progress',
        })
        .select('id')
        .single()

      if (attError || !attempt) throw new Error('Error creando intento')

      attemptIdRef.current = attempt.id

      const { data: initResult } = await supabase.rpc('init_adaptive_state', {
        p_attempt_id:    attempt.id,
        p_student_id:    user.id,
        p_evaluation_id: evaluationId,
      })

      const initialAbility: number = (initResult as number) ?? 50
      abilityRef.current = initialAbility

      const firstQuestion = await fetchNextQuestion(initialAbility, [])

      updateState(() => ({
        attemptId:         attempt.id,
        abilityScore:      initialAbility,
        currentQuestion:   firstQuestion,
        questionsAnswered: 0,
        totalQuestions:    adaptiveLength,
        isComplete:        false,
        history:           [],
      }))

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [evaluationId, adaptiveLength])

  const answerQuestion = useCallback(async (
    questionId: string,
    selectedOptionId: string | null,
    textAnswer: string | null
  ) => {
    const currentState = stateRef.current
    if (!attemptIdRef.current || !currentState.currentQuestion) return

    setLoading(true)

    try {
      // Determinar si es correcta (solo para MC/TF)
      let isCorrect = false
      if (selectedOptionId) {
        isCorrect = currentState.currentQuestion.options
          .find(o => o.id === selectedOptionId)?.is_correct ?? false
      }

      // Guardar respuesta
      await supabase.from('answers').upsert({
        attempt_id:  attemptIdRef.current,
        question_id: questionId,
        option_id:   selectedOptionId,
        text_answer: textAnswer,
        is_correct:  selectedOptionId ? isCorrect : null,
      }, { onConflict: 'attempt_id,question_id' })

      // Actualizar ability score via ELO
      const { data: newAbility } = await supabase.rpc('update_adaptive_ability', {
        p_attempt_id:  attemptIdRef.current,
        p_question_id: questionId,
        p_is_correct:  isCorrect,
      })

      const updatedAbility: number = (newAbility as number) ?? abilityRef.current
      abilityRef.current = updatedAbility
      seenIdsRef.current = [...seenIdsRef.current, questionId]

      const newAnswered = currentState.questionsAnswered + 1
      const isComplete  = newAnswered >= currentState.totalQuestions

      const historyEntry: AdaptiveHistoryEntry = {
        questionId,
        body:         currentState.currentQuestion.body,
        difficulty:   currentState.currentQuestion.difficulty_score,
        skill:        currentState.currentQuestion.skill,
        isCorrect,
        abilityAfter: updatedAbility,
      }

      let nextQuestion: AdaptiveQuestion | null = null
      if (!isComplete) {
        nextQuestion = await fetchNextQuestion(updatedAbility, seenIdsRef.current)
      }

      updateState(prev => ({
        ...prev,
        abilityScore:      updatedAbility,
        currentQuestion:   nextQuestion,
        questionsAnswered: newAnswered,
        isComplete,
        history:           [...prev.history, historyEntry],
      }))

      // Entregar si completó
      if (isComplete) {
        await supabase
          .from('attempts')
          .update({ submitted_at: new Date().toISOString(), status: 'submitted' })
          .eq('id', attemptIdRef.current)

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('student_ability_history').insert({
            student_id:    user.id,
            evaluation_id: evaluationId,
            attempt_id:    attemptIdRef.current,
            ability_score: updatedAbility,
          })
        }
      }

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar respuesta')
    } finally {
      setLoading(false)
    }
  }, [evaluationId])

  return {
    state,
    loading,
    error,
    startAdaptiveExam,
    answerQuestion,
  }
}
