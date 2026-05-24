// app/api/recommendations/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Roles staff que pueden generar recomendaciones para cualquier alumno de su org
const STAFF_ROLE_IDS = [1, 2, 5] // director, coordinator, teacher
const RATE_LIMIT = { windowMs: 60_000, max: 20 } // 20 por minuto por IP

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(`recommendations:${getClientIp(req)}`, RATE_LIMIT)
    if (!rl.success) {
      return NextResponse.json(
        { error: `Demasiadas solicitudes. Intentá de nuevo en ${Math.ceil((rl.resetAt - Date.now()) / 60000)} min.` },
        { status: 429 }
      )
    }
    const { attempt_id } = await req.json()
    if (!attempt_id) return NextResponse.json({ error: 'attempt_id required' }, { status: 400 })

    const supabase = await createClient()
    const sb = supabase as any

    // Verificar sesión activa
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    // Obtener perfil del caller
    const { data: callerProfile } = await sb
      .from('profiles')
      .select('role_id, organization_id')
      .eq('id', user.id)
      .single()

    if (!callerProfile) return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 403 })

    // ── Obtener datos del intento ──────────────────────────────────────────
    const { data: attempt } = await sb
      .from('attempts')
      .select('id, score, evaluation_id, student_id, evaluations(title, pass_score)')
      .eq('id', attempt_id)
      .single()

    if (!attempt) return NextResponse.json({ error: 'attempt not found' }, { status: 404 })

    // Verificar ownership: el caller debe ser el propio alumno
    // o staff de la misma organización que la evaluación
    const { data: evalOrg } = await sb
      .from('evaluations')
      .select('organization_id')
      .eq('id', attempt.evaluation_id)
      .single()

    const isOwner = attempt.student_id === user.id
    const isStaff = STAFF_ROLE_IDS.includes(callerProfile.role_id) &&
                    callerProfile.organization_id === evalOrg?.organization_id

    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Sin permisos para acceder a este intento.' }, { status: 403 })
    }

    // ── Obtener respuestas con is_correct y skill de la pregunta ──────────
    const { data: answers } = await sb
      .from('answers')
      .select(`
        is_correct,
        points_earned,
        questions ( q_type, skill, points )
      `)
      .eq('attempt_id', attempt_id)

    // ── Calcular rendimiento por skill ────────────────────────────────────
    const skillScores: Record<string, { earned: number; total: number }> = {}

    for (const answer of (answers ?? [])) {
      const q = answer.questions
      if (!q) continue
      const skill = q.skill?.trim() || q.q_type
      if (!skillScores[skill]) skillScores[skill] = { earned: 0, total: 0 }
      skillScores[skill].total  += q.points ?? 1
      skillScores[skill].earned += answer.points_earned ?? 0
    }

    // ── Buscar reglas de recomendación aplicables ─────────────────────────
    const { data: rules } = await sb
      .from('recommendation_rules')
      .select('*')
      .eq('is_active', true)

    const rulesMap: Record<string, any[]> = {}
    for (const rule of (rules ?? [])) {
      if (!rulesMap[rule.skill]) rulesMap[rule.skill] = []
      rulesMap[rule.skill].push(rule)
    }

    // ── Recomendaciones existentes del alumno (para comparar scores) ──────
    // Solo miramos skills con score < 60% en este intento
    const weakSkills = Object.entries(skillScores)
      .filter(([_, data]) => data.total > 0 && Math.round((data.earned / data.total) * 100) < 60)
      .map(([skill]) => skill)

    let existingRecs: Record<string, any> = {}
    if (weakSkills.length > 0) {
      const { data: existing } = await sb
        .from('student_recommendations')
        .select('id, skill, score_pct, is_dismissed')
        .eq('student_id', attempt.student_id)
        .in('skill', weakSkills)

      for (const rec of (existing ?? [])) {
        existingRecs[rec.skill] = rec
      }
    }

    // ── Generar upserts por student_id+skill ──────────────────────────────
    // Regla: 1 recomendación por alumno por skill.
    // Si ya existe y el nuevo score es PEOR → actualizar (el alumno sigue fallando)
    // Si ya existe y el nuevo score es MEJOR o igual → no tocar (no spamear)
    // Si no existe → crear
    const toUpsert: any[] = []

    for (const [skill, data] of Object.entries(skillScores)) {
      if (data.total === 0) continue
      const pct = Math.round((data.earned / data.total) * 100)
      if (pct >= 60) continue  // skill OK, no recomendar

      const existing = existingRecs[skill]

      // Si ya existe una rec activa (no descartada) con score igual o peor → no actualizar
      if (existing && !existing.is_dismissed && existing.score_pct <= pct) continue

      // Buscar regla específica para este skill
      const skillRules = (rulesMap[skill] ?? [])
        .filter((r: any) => pct <= r.threshold_pct)
        .sort((a: any, b: any) => b.priority - a.priority)

      toUpsert.push({
        student_id:    attempt.student_id,
        attempt_id,
        evaluation_id: attempt.evaluation_id,
        rule_id:       skillRules[0]?.id ?? null,
        skill,
        score_pct:     pct,
        is_read:       false,       // resetear como no leída al actualizarse
        is_dismissed:  false,
        updated_at:    new Date().toISOString(),
      })
    }

    if (toUpsert.length === 0) {
      return NextResponse.json({ created: 0, message: 'no new weak skills or no improvements needed' })
    }

    // ── Upsert por student_id+skill ───────────────────────────────────────
    // onConflict apunta al nuevo constraint student_recommendations_student_skill_unique
    // que solo aplica cuando is_dismissed = false
    // Para filas descartadas (is_dismissed=true) no hay conflicto → se insertan nuevas
    const { data: inserted, error } = await sb
      .from('student_recommendations')
      .upsert(toUpsert, {
        onConflict:       'student_id,skill',
        ignoreDuplicates: false,  // queremos actualizar, no ignorar
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
