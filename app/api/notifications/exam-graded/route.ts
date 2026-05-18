// app/api/notifications/exam-graded/route.ts
// Inserta una notificación para el alumno cuando el docente finaliza la corrección.
// Usa service_role para saltear RLS (el docente no puede insertar notifs para otros usuarios).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { attempt_id } = await req.json()
    if (!attempt_id) {
      return NextResponse.json({ error: 'attempt_id required' }, { status: 400 })
    }

    // Verificar que el caller está autenticado y tiene rol de docente/coordinador/director
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Leer datos del intento para construir la notificación
    const sb = supabase as any
    const { data: attempt } = await sb
      .from('attempts')
      .select(`
        id, score, passed, student_id,
        evaluations ( title, pass_score )
      `)
      .eq('id', attempt_id)
      .single()

    if (!attempt) {
      return NextResponse.json({ error: 'Intento no encontrado' }, { status: 404 })
    }

    const evalTitle = attempt.evaluations?.title ?? 'tu evaluación'
    const score     = attempt.score != null ? Math.round(attempt.score) : null
    const passed    = attempt.passed

    // Construir el mensaje según el resultado
    const title = passed
      ? `✅ Corrección lista — ${evalTitle}`
      : `📋 Corrección lista — ${evalTitle}`

    const body = score != null
      ? passed
        ? `Tu examen fue corregido. Obtuviste ${score}%. ¡Aprobaste!`
        : `Tu examen fue corregido. Obtuviste ${score}%. Revisá el feedback de tu docente.`
      : `Tu examen "${evalTitle}" fue corregido. Revisá tus resultados.`

    // Insertar con service_role para saltear RLS
    const admin = await createAdminClient()
    const { error } = await (admin as any)
      .from('notifications')
      .insert({
        user_id:  attempt.student_id,
        title,
        body,
        type:     'exam_graded',
        link:     `/results`,
        is_read:  false,
      })

    if (error) {
      console.error('Error inserting notification:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('exam-graded notification error:', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
