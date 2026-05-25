// RUTA: app/api/cron/inactive-reminder/route.ts
//
// Llamado los lunes por cron-job.org a las 12:00 UTC (09:00 Argentina).
// URL pública pero protegida por CRON_SECRET en el header Authorization.
//
// EN CRON-JOB.ORG configurar:
//   URL:    https://ongest.vercel.app/api/cron/inactive-reminder
//   Method: GET
//   Header: Authorization: Bearer TU_CRON_SECRET
//   Schedule: todos los lunes a las 12:00 UTC

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const RESEND_API_KEY   = process.env.RESEND_API_KEY!
const FROM_EMAIL       = process.env.FROM_EMAIL ?? 'noreply@resend.dev'
const APP_URL          = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ongest.vercel.app'
const CRON_SECRET      = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  // ── Protección ───────────────────────────────────────────────────────────
  const auth = req.headers.get('authorization') ?? ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb           = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const now          = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // 1. Todos los alumnos inscriptos
  const { data: enrollments, error } = await sb
    .from('enrollments')
    .select(`
      student_id, course_id,
      profiles ( first_name, email ),
      courses ( name, organizations(name, slug) )
    `)

  if (error || !enrollments?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no enrollments' })
  }

  // 2. Último intento por alumno
  const studentIds = [...new Set(enrollments.map((e: any) => e.student_id))]

  const { data: lastAttempts } = await sb
    .from('attempts')
    .select('student_id, started_at')
    .in('student_id', studentIds)
    .order('started_at', { ascending: false })

  const lastActivity: Record<string, Date | null> = {}
  for (const id of studentIds) lastActivity[id] = null
  for (const a of (lastAttempts ?? []) as any[]) {
    if (!lastActivity[a.student_id] && a.started_at) {
      lastActivity[a.student_id] = new Date(a.started_at)
    }
  }

  // 3. Evaluaciones pendientes por curso
  const courseIds = [...new Set(enrollments.map((e: any) => e.course_id))]
  const { data: pendingEvals } = await sb
    .from('evaluation_courses')
    .select('course_id, evaluation_id, evaluations!inner(id, title, status, available_until)')
    .in('course_id', courseIds)
    .eq('evaluations.status', 'published')

  const evalsByCourse: Record<string, any[]> = {}
  for (const pe of (pendingEvals ?? []) as any[]) {
    if (!evalsByCourse[pe.course_id]) evalsByCourse[pe.course_id] = []
    evalsByCourse[pe.course_id].push(pe.evaluations)
  }

  // 4. Intentos completados
  const { data: completedAttempts } = await sb
    .from('attempts')
    .select('student_id, evaluation_id')
    .in('student_id', studentIds)
    .in('status', ['submitted', 'graded', 'timed_out', 'flagged'])

  const completedSet = new Set(
    (completedAttempts ?? []).map((a: any) => `${a.student_id}:${a.evaluation_id}`)
  )

  // 5. Filtrar: inactivos + con exámenes pendientes
  const toSend: {
    email: string; firstName: string; pendingCount: number
    orgName: string; orgSlug: string; courseName: string
  }[] = []
  const seen = new Set<string>()

  for (const enr of enrollments as any[]) {
    const { student_id, profiles: profile, courses: course } = enr
    if (!profile?.email || seen.has(student_id)) continue

    const last       = lastActivity[student_id]
    const isInactive = !last || last < sevenDaysAgo
    if (!isInactive) continue

    const courseEvals = evalsByCourse[enr.course_id] ?? []
    const pending     = courseEvals.filter((ev: any) => {
      const notExpired = !ev.available_until || new Date(ev.available_until) > now
      const notDone    = !completedSet.has(`${student_id}:${ev.id}`)
      return notExpired && notDone
    })
    if (pending.length === 0) continue

    seen.add(student_id)
    toSend.push({
      email:        profile.email,
      firstName:    profile.first_name ?? 'Alumno',
      pendingCount: pending.length,
      orgName:      course?.organizations?.name ?? 'tu instituto',
      orgSlug:      course?.organizations?.slug ?? '',
      courseName:   course?.name ?? 'tu curso',
    })
  }

  if (toSend.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no inactive students with pending evals' })
  }

  // 6. Enviar emails
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
        subject: `📚 Tenés ${item.pendingCount} examen${item.pendingCount > 1 ? 'es' : ''} esperándote`,
        html:    buildInactiveEmail(item.firstName, item.pendingCount, item.courseName, item.orgName, loginUrl),
      }),
    })
    if (res.ok) { sent++ } else { errors++; console.error(await res.text()) }
  }

  return NextResponse.json({ ok: true, sent, errors })
}

function buildInactiveEmail(
  firstName: string, pendingCount: number,
  courseName: string, orgName: string, loginUrl: string,
): string {
  const examWord = pendingCount === 1 ? 'examen' : 'exámenes'
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
              Hace unos días que no entrás a la plataforma. Todavía tenés
              <strong>${pendingCount} ${examWord}</strong> pendiente${pendingCount > 1 ? 's' : ''}
              en <strong>${courseName}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f5eefb;border:1px solid #e9d5ff;border-radius:12px;margin-bottom:28px">
              <tr>
                <td style="padding:20px 24px;text-align:center">
                  <p style="margin:0 0 2px;font-size:36px;font-weight:800;color:#642f8d">${pendingCount}</p>
                  <p style="margin:0;font-size:14px;color:#7c3aed">${examWord} pendiente${pendingCount > 1 ? 's' : ''}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#9ca3af">${courseName}</p>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${loginUrl}"
                  style="display:inline-block;background:#642f8d;color:#fff;text-decoration:none;
                         font-size:14px;font-weight:600;padding:13px 30px;border-radius:12px">
                  Retomar mis estudios →
                </a>
              </td></tr>
            </table>
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
