import { createClient } from '@/lib/supabase/server'
import type { Evaluation, EvaluationStats, Question } from '@/types'

export async function getEvaluations(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evaluations')
    .select('*, cefr_levels(code, label), profiles(first_name, last_name)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  return { data: (data ?? []) as Evaluation[], error }
}

export async function getEvaluationStats(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_evaluation_stats')
    .select('*')
    .eq('organization_id', orgId)
    .order('available_until', { ascending: true })

  return { data: (data ?? []) as EvaluationStats[], error }
}

export async function getEvaluationById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evaluations')
    .select('*, cefr_levels(code, label)')
    .eq('id', id)
    .single()

  return { data: data as Evaluation | null, error }
}

export async function getEvaluationWithQuestions(id: string) {
  const supabase = await createClient()

  const [{ data: evalData }, { data: questionsData }] = await Promise.all([
    supabase.from('evaluations').select('*, cefr_levels(code, label)').eq('id', id).single(),
    supabase.from('questions').select('*, options(*)').eq('evaluation_id', id).order('sort_order'),
  ])

  const questions = (questionsData ?? []).map((q: any) => ({
    ...q,
    options: (q.options ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
  })) as Question[]

  return {
    evaluation: evalData as Evaluation | null,
    questions,
  }
}

export async function createEvaluation(data: Partial<Evaluation>) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from('evaluations')
    .insert(data)
    .select()
    .single()

  return { data: result, error }
}

export async function updateEvaluationStatus(id: string, status: 'draft' | 'published' | 'closed') {
  const supabase = await createClient()
  const { error } = await supabase
    .from('evaluations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  return { error }
}
