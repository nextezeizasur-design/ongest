// app/api/recommendations/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { attempt_id } = await req.json()
    if (!attempt_id) return NextResponse.json({ error: 'attempt_id required' }, { status: 400 })

    const supabase = await createClient()
    const sb = supabase as any

    // ── Verificar si ya hay recomendaciones para este intento ──────────────
    const { count } = await sb
      .from('student_recommendations')           // ✅ nombre correcto
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', attempt_id)

    if ((count ?? 0) > 0) {
      return NextResponse.json({ skipped: true, reason: 'already_exists' })
    }

    // ── Obtener datos del intento ──────────────────────────────────────────
    const { data: attempt } = await sb
      .from('attempts')
      .select('id, score, evaluation_id, student_id, evaluations(title, pass_score)')
      .eq('id', attempt_id)
      .single()

    if (!attempt) return NextResponse.json({ error: 'attempt not found' }, { status: 404 })

    // ── Obtener respuestas con is_correct y skill de la pregunta ──────────
    // Una sola query — sin N+1 loops de options
    const { data: answers } = await sb
      .from('answers')
      .select(`
        is_correct,
        points_earned,
        questions ( q_type, skill, points )
      `)
      .eq('attempt_id', attempt_id)

    // ── Calcular rendimiento por skill ────────────────────────────────────
    // Usamos questions.skill si existe, sino fallback a q_type como categoría
    const skillScores: Record<string, { earned: number; total: number }> = {}

    for (const answer of (answers ?? [])) {
      const q = answer.questions
      if (!q) continue

      // Usar skill semántico si existe (grammar, vocabulary, speaking…)
      // Si la pregunta no tiene skill definido, usar q_type como fallback
      const skill = q.skill?.trim() || q.q_type

      if (!skillScores[skill]) skillScores[skill] = { earned: 0, total: 0 }
      skillScores[skill].total  += q.points ?? 1
      skillScores[skill].earned += answer.points_earned ?? 0
    }

    // ── Buscar reglas de recomendación aplicables ─────────────────────────
    // Primero intentamos usar recommendation_rules si existen
    const { data: rules } = await sb
      .from('recommendation_rules')
      .select('*')
      .eq('is_active', true)

    const rulesMap: Record<string, any[]> = {}
    for (const rule of (rules ?? [])) {
      if (!rulesMap[rule.skill]) rulesMap[rule.skill] = []
      rulesMap[rule.skill].push(rule)
    }

    // ── Generar recomendaciones para skills con < 60% ─────────────────────
    const recommendations: any[] = []

    for (const [skill, data] of Object.entries(skillScores)) {
      if (data.total === 0) continue
      const pct = Math.round((data.earned / data.total) * 100)
      if (pct >= 60) continue  // skill OK, no recomendar

      // Buscar regla específica para este skill y nivel de score
      const skillRules = (rulesMap[skill] ?? [])
        .filter((r: any) => pct <= r.threshold_pct)
        .sort((a: any, b: any) => b.priority - a.priority)

      if (skillRules.length > 0) {
        // Usar la regla más prioritaria
        const rule = skillRules[0]
        recommendations.push({
          attempt_id,
          student_id:    attempt.student_id,
          evaluation_id: attempt.evaluation_id,
          rule_id:       rule.id,
          skill,
          score_pct:     pct,
        })
      } else {
        // Sin regla específica → generar recomendación genérica
        recommendations.push({
          attempt_id,
          student_id:    attempt.student_id,
          evaluation_id: attempt.evaluation_id,
          rule_id:       null,
          skill,
          score_pct:     pct,
        })
      }
    }

    if (recommendations.length === 0) {
      return NextResponse.json({ created: 0 })
    }

    // ── Insertar en student_recommendations ───────────────────────────────
    const { data: inserted, error } = await sb
      .from('student_recommendations')           // ✅ nombre correcto
      .upsert(recommendations, {
        onConflict:       'attempt_id,skill',    // constraint que acabamos de crear
        ignoreDuplicates: true,
      })
      .select('id')

    if (error) {
      console.error('Error inserting recommendations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ created: inserted?.length ?? 0 })

  } catch (err) {
    console.error('recommendations/generate error:', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
