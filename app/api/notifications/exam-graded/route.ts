// RUTA: app/api/notifications/exam-graded/route.ts
// Versión actualizada: inserta notificación in-app + envía email via Resend.
// Se llama desde el componente de corrección cuando el docente finaliza.

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL     = process.env.FROM_EMAIL ?? 'noreply@resend.dev'
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ongest.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const { attempt_id } = await req.json()
    if (!attempt_id) {
      return NextResponse.json({ error: 'attempt_id required' }, { status: 400 })
    }

    // Verificar autenticación y rol
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Datos del intento + perfil del alumno + organización
    const sb = supabase as any
    const { data: attempt } = await sb
      .from('attempts')
      .select(`
        id, score, passed, student_id,
        evaluations (
          title, pass_score,
          evaluation_courses ( courses ( organizations ( name, slug ) ) )
        )
      `)
      .eq('id', attempt_id)
      .single()

    if (!attempt) {
      return NextResponse.json({ error: 'Intento no encontrado' }, { status: 404 })
    }

    // Perfil del alumno para el email
    const admin = await createAdminClient()
    const { data: profile } = await (admin as any)
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', attempt.student_id)
      .single()

    const evalTitle = attempt.evaluations?.title ?? 'tu evaluación'
    const score     = attempt.score != null ? Math.round(attempt.score) : null
    const passed    = attempt.passed

    // Organización (para URL de login)
    const orgSlug = attempt.evaluations
      ?.evaluation_courses?.[0]
      ?.courses?.organizations?.slug ?? ''

    // ── 1. Notificación in-app (existente) ───────────────────────────────
    const title = passed
      ? `✅ Corrección lista — ${evalTitle}`
      : `📋 Corrección lista — ${evalTitle}`

    const body = score != null
      ? passed
        ? `Tu examen fue corregido. Obtuviste ${score}%. ¡Aprobaste!`
        : `Tu examen fue corregido. Obtuviste ${score}%. Revisá el feedback de tu docente.`
      : `Tu examen "${evalTitle}" fue corregido. Revisá tus resultados.`

    const { error: notifError } = await (admin as any)
      .from('notifications')
      .insert({
        user_id: attempt.student_id,
        title,
        body,
        type:    'exam_graded',
        link:    `/results`,
        is_read: false,
      })

    if (notifError) {
      console.error('Error inserting notification:', notifError)
      return NextResponse.json({ error: notifError.message }, { status: 500 })
    }

    // ── 2. Email via Resend ───────────────────────────────────────────────
    if (RESEND_API_KEY && profile?.email) {
      const loginUrl = `${APP_URL}/login?org=${orgSlug}`
      const html     = buildGradedEmail(
        profile.first_name ?? 'Alumno',
        evalTitle,
        score,
        passed ?? false,
        loginUrl,
      )

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from:    FROM_EMAIL,
          to:      profile.email,
          subject: passed
            ? `✅ Tu examen "${evalTitle}" fue corregido — ¡Aprobaste!`
            : `📋 Tu examen "${evalTitle}" fue corregido`,
          html,
        }),
      })

      if (!emailRes.ok) {
        // No fallar el request si el email no se envió — la notif in-app ya está
        console.error('Resend error:', await emailRes.text())
      }
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('exam-graded notification error:', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

// ── Template HTML ────────────────────────────────────────────────────────────

function buildGradedEmail(
  firstName: string,
  evalTitle: string,
  score:     number | null,
  passed:    boolean,
  loginUrl:  string,
): string {
  const accentColor = passed ? '#16a34a' : '#dc2626'
  const bgColor     = passed ? '#f0fdf4' : '#fef2f2'
  const borderColor = passed ? '#bbf7d0' : '#fecaca'
  const emoji       = passed ? '🎉' : '📝'
  const headline    = passed ? '¡Aprobaste!' : 'Revisá tu corrección'
  const message     = passed
    ? `¡Felicitaciones! Tu docente ya corrigió tu examen y aprobaste${score !== null ? ` con <strong>${score}%</strong>` : ''}. Podés ver el detalle de tu corrección en la plataforma.`
    : `Tu docente ya corrigió tu examen${score !== null ? ` y obtuviste <strong>${score}%</strong>` : ''}. Revisá el feedback para ver en qué podés mejorar.`

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;max-width:560px;width:100%">

        <tr>
          <td style="background:#642f8d;padding:28px 32px;text-align:center">
            <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff">OnGest</p>
            <p style="margin:6px 0 0;font-size:13px;color:#e9d5ff;opacity:0.9">Plataforma de evaluaciones</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 8px;font-size:16px;color:#111827">
              Hola <strong>${firstName}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">
              ${message}
            </p>

            <!-- Result card -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:${bgColor};border:1px solid ${borderColor};border-radius:12px;margin-bottom:28px">
              <tr>
                <td style="padding:24px;text-align:center">
                  <p style="margin:0 0 4px;font-size:36px">${emoji}</p>
                  <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:${accentColor}">${headline}</p>
                  <p style="margin:0;font-size:14px;color:#6b7280">${evalTitle}</p>
                  ${score !== null
                    ? `<p style="margin:8px 0 0;font-size:32px;font-weight:800;color:${accentColor}">${score}%</p>`
                    : ''}
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${loginUrl}"
                    style="display:inline-block;background:#642f8d;color:#ffffff;text-decoration:none;
                           font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px">
                    Ver mi corrección →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f3f4f6;text-align:center">
            <p style="margin:0;font-size:12px;color:#d1d5db">OnGest · Plataforma de evaluaciones</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
