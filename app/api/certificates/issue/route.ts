// app/api/certificates/issue/route.ts
// Emite certificado para cualquier intento completado (aprobado o no)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Roles staff que pueden emitir certificados para cualquier alumno de su org
const STAFF_ROLE_IDS = [1, 2, 5] // director, coordinator, teacher
const RATE_LIMIT = { windowMs: 60_000, max: 20 } // 20 por minuto por IP

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(`certificates:${getClientIp(req)}`, RATE_LIMIT)
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

    // Obtener perfil del caller para verificar rol y org
    const { data: callerProfile } = await sb
      .from('profiles')
      .select('role_id, organization_id')
      .eq('id', user.id)
      .single()

    if (!callerProfile) return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 403 })

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

    // Verificar ownership: el caller debe ser el propio alumno
    // o staff (director/coordinator/teacher) de la misma organización
    const isOwner = attempt.student_id === user.id
    const isStaff = STAFF_ROLE_IDS.includes(callerProfile.role_id) &&
                    callerProfile.organization_id === attempt.evaluations?.organization_id

    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Sin permisos para emitir este certificado.' }, { status: 403 })
    }

    // Si ya existe un certificado para este intento, borrarlo para re-emitirlo
    // con el score actualizado (importante para exámenes con speaking corregidos manualmente)
    await sb
      .from('certificates')
      .delete()
      .eq('attempt_id', attempt_id)

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
