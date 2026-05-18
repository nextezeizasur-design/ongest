import { createClient } from '@/lib/supabase/server'
import type { Attempt, Answer } from '@/types'

export async function getStudentAttempts(studentId: string) {
  const supabase = await createClient()
  const sb = supabase as any

  // Traemos submitted, graded Y timed_out para mostrarlos al alumno,
  // pero el promedio solo considera submitted y graded (con score real).
  const { data: attempts, error } = await sb
    .from('attempts')
    .select('*')
    .eq('student_id', studentId)
    .in('status', ['submitted', 'graded', 'timed_out'])
    .order('created_at', { ascending: false })

  if (!attempts?.length) return { data: [], error }

  // Obtener datos de evaluaciones por separado
  const evalIds = [...new Set(attempts.map((a: any) => a.evaluation_id))]
  const { data: evals } = await sb
    .from('evaluations')
    .select('id, title, pass_score, cefr_levels(code)')
    .in('id', evalIds)

  const evalMap: Record<string, any> = {}
  ;(evals ?? []).forEach((e: any) => { evalMap[e.id] = e })

  const result = attempts.map((a: any) => ({
    ...a,
    evaluations: evalMap[a.evaluation_id] ?? null,
    // ✅ Para timed_out con score null → forzar score 0 y passed false
    // así la UI tiene valores seguros sin romper el promedio
    score:  a.status === 'timed_out' && a.score == null ? 0  : a.score,
    passed: a.status === 'timed_out' && a.passed == null ? false : a.passed,
  }))

  return { data: result as Attempt[], error }
}

export async function getAttemptWithAnswers(attemptId: string) {
  const supabase = await createClient()
  const sb = supabase as any

  const [{ data: attempt }, { data: answers }] = await Promise.all([
    sb.from('attempts')
      .select('*, evaluations(id, title, pass_score, time_limit_min), profiles!attempts_student_id_fkey(first_name, last_name, email)')
      .eq('id', attemptId)
      .single(),
    sb.from('answers')
      .select('*, questions(id, sort_order, q_type, body, points, explanation, options(id, body, is_correct, sort_order))')
      .eq('attempt_id', attemptId)
      .order('questions(sort_order)'),
  ])

  return {
    attempt: attempt as Attempt | null,
    answers: (answers ?? []) as (Answer & { questions: any })[],
  }
}

export async function getAttemptsByEvaluation(evaluationId: string) {
  const supabase = await createClient()
  const sb = supabase as any

  const { data, error } = await sb
    .from('attempts')
    .select('*, profiles!attempts_student_id_fkey(first_name, last_name, email)')
    .eq('evaluation_id', evaluationId)
    .in('status', ['submitted', 'graded', 'timed_out'])
    .order('submitted_at', { ascending: false })

  return { data: (data ?? []) as Attempt[], error }
}

export async function createAttempt(evaluationId: string, studentId: string) {
  const supabase = await createClient()
  const sb = supabase as any

  const { data, error } = await sb
    .from('attempts')
    .insert({ evaluation_id: evaluationId, student_id: studentId, status: 'in_progress' })
    .select()
    .single()

  return { data: data as Attempt | null, error }
}

export async function getInProgressAttempt(evaluationId: string, studentId: string) {
  const supabase = await createClient()
  const sb = supabase as any

  const { data } = await sb
    .from('attempts')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .eq('student_id', studentId)
    .eq('status', 'in_progress')
    .maybeSingle()

  return data as Attempt | null
}
