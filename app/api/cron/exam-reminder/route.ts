// RUTA: app/api/cron/exam-reminder/route.ts
//
// Llamado diariamente por cron-job.org a las 12:00 UTC (09:00 Argentina).
// URL pública pero protegida por CRON_SECRET en el header Authorization.
//
// EN CRON-JOB.ORG configurar:
//   URL:    https://ongest.vercel.app/api/cron/exam-reminder
//   Method: GET
//   Header: Authorization: Bearer TU_CRON_SECRET
//   Schedule: todos los días a las 12:00 UTC

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const RESEND_API_KEY   = process.env.RESEND_API_KEY!
const FROM_EMAIL       = process.env.FROM_EMAIL ?? 'noreply@resend.dev'
const APP_URL          = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ongest.vercel.app'
const CRON_SECRET      = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  // ── Protección: solo cron-job.org con el secret correcto ────────────────
  const auth = req.headers.get('authorization') ?? ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb  = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const now = new Date()
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  // 1. Evaluaciones publicadas que vencen en las próximas 48hs
  const { data: evals, error: evalErr } = await sb
    .from('evaluations')
    .select('id, title, available_until, organizations(name, slug)')
    .eq('status', 'published')
    .gte('available_until', now.toISOString())
    .lte('available_until', in48h.toISOString())

  if (evalErr) {
    console.error('exam-reminder: error fetching evals', evalErr)
    return NextResponse.json({ error: evalErr.message }, { status: 500 })
  }

  if (!evals || evals.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no evals due soon' })
  }

  const evalIds = evals.map((e: any) => e.id)

  // 2. Alumnos inscriptos en cursos con esas evaluaciones
  const { data: targets } = await sb
    .from('evaluation_courses')
    .select(`
      evaluation_id,
      courses (
        enrollments (
          student_id,
          profiles ( first_name, email )
        )
      )
    `)
    .in('evaluation_id', evalIds)

  if (!targets?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no students enrolled' })
  }

  // 3. Intentos ya completados → no molestar a quien ya rindió
  const { data: doneAttempts } = await sb
    .from('attempts')
    .select('student_id, evaluation_id')
    .in('evaluation_id', evalIds)
    .in('status', ['submitted', 'graded', 'timed_out', 'flagged'])

  const doneSet = new Set(
    (doneAttempts ?? []).map((a: any) => `${a.student_id}:${a.evaluation_id}`)
  )

  // 4. Armar lista deduplicada de emails
  const toSend: {
    email: string; firstName: string
    evalTitle: string; dueDate: string
    orgName: string; orgSlug: string
  }[] = []
  const seen = new Set<string>()

  for (const target of targets as any[]) {
    const evalId   = target.evaluation_id
    const evalData = evals.find((e: any) => e.id === evalId)
    if (!evalData) continue

    const orgName = (evalData.organizations as any)?.name ?? 'tu instituto'
    const orgSlug = (evalData.organizations as any)?.slug ?? ''
    const dueDate = new Date(evalData.available_until).toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit',
    })

    for (const enr of (target.courses?.enrollments ?? []) as any[]) {
      const profile = enr.profiles
      if (!profile?.email) continue
      const key = `${enr.student_id}:${evalId}`
      if (doneSet.has(key) || seen.has(key)) continue
      seen.add(key)
      toSend.push({
        email:     profile.email,
        firstName: profile.first_name ?? 'Alumno',
        evalTitle: evalData.title,
        dueDate,
        orgName,
        orgSlug,
      })
    }
  }

  if (toSend.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'all students already submitted' })
  }

  // 5. Enviar emails via Resend
  let sent = 0, errors = 0

  for (const item of toSend) {
    const loginUrl = `${APP_URL}/login?org=${item.orgSlug}`
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      item.email,
        subject: `⏰ Recordatorio: "${item.evalTitle}" vence pronto`,
        html:    buildReminderEmail(item.firstName, item.evalTitle, item.dueDate, item.orgName, loginUrl),
      }),
    })
    if (res.ok) { sent++ } else { errors++; console.error(await res.text()) }
  }

  return NextResponse.json({ ok: true, sent, errors })
}

function buildReminderEmail(
  firstName: string, evalTitle: string,
  dueDate: string, orgName: string, loginUrl: string,
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;max-width:560px;width:100%">
        <tr>
          <td style="background:#642f8d;padding:28px 32px;text-align:center">
            <p style="margin:0;font-size:22px;font-weight:700;color:#fff">${orgName}</p>
            <p style="margin:6px 0 0;font-size:12px;color:#e9d5ff">Plataforma de evaluaciones</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 8px;font-size:15px;color:#111">Hola <strong>${firstName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6">
              Recordatorio: tenés un examen pendiente que vence pronto.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f5eefb;border:1px solid #e9d5ff;border-radius:12px;margin-bottom:28px">
              <tr>
                <td style="padding:20px 24px">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#7c3aed;text-transform:uppercase">Evaluación pendiente</p>
                  <p style="margin:0 0 10px;font-size:17px;font-weight:700;color:#1f1135">${evalTitle}</p>
                  <p style="margin:0;font-size:13px;color:#6b7280">⏰ Vence el <strong style="color:#7c3aed">${dueDate}</strong></p>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${loginUrl}"
                  style="display:inline-block;background:#642f8d;color:#fff;text-decoration:none;
                         font-size:14px;font-weight:600;padding:13px 30px;border-radius:12px">
                  Ir a mis exámenes →
                </a>
              </td></tr>
            </table>
            <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center">
              Si ya rendiste este examen podés ignorar este mensaje.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center">
            <p style="margin:0;font-size:11px;color:#d1d5db">${orgName} · Enviado por OnGest</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
