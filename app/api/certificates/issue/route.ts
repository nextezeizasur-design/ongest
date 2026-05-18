// app/api/certificates/issue/route.ts
// Emite certificado para cualquier intento completado (aprobado o no)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { attempt_id } = await req.json()
    if (!attempt_id) return NextResponse.json({ error: 'attempt_id required' }, { status: 400 })

    const supabase = await createClient()
    const sb = supabase as any

    // Verificar que el intento existe y está completado
    const { data: attempt } = await sb
      .from('attempts')
      .select(`
        id, student_id, score, passed, submitted_at,
        evaluations ( id, title, organization_id, pass_score )
      `)
      .eq('id', attempt_id)
      .not('submitted_at', 'is', null)
      .single()

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found or not submitted' }, { status: 404 })
    }

    // Verificar que no existe ya un certificado para este intento
    const { data: existing } = await sb
      .from('certificates')
      .select('id')
      .eq('attempt_id', attempt_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ skipped: true, certificate_id: existing.id })
    }

    // Obtener nombre del alumno
    const { data: profile } = await sb
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', attempt.student_id)
      .single()

    const studentName = profile
      ? `${profile.first_name} ${profile.last_name}`
      : 'Alumno'

    const eval_ = attempt.evaluations

    // Insertar certificado — siempre, aprobado o no
    const { data: cert, error } = await sb
      .from('certificates')
      .insert({
        student_id:      attempt.student_id,
        attempt_id:      attempt.id,
        evaluation_id:   eval_?.id,
        organization_id: eval_?.organization_id,
        student_name:    studentName,
        eval_title:      eval_?.title ?? 'Evaluación',
        score:           attempt.score ?? 0,
        passed:          attempt.passed ?? false,
        issued_by:       'Next English Institute',
        is_active:       true,
      })
      .select('id, verify_hash')
      .single()

    if (error) {
      console.error('Error inserting certificate:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      certificate_id: cert.id,
      verify_hash:    cert.verify_hash,
      passed:         attempt.passed ?? false,
    })

  } catch (err) {
    console.error('certificates/issue error:', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
