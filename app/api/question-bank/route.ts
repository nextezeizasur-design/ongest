// app/api/question-bank/route.ts
// GET: listar/buscar preguntas del banco
// POST: crear pregunta en el banco

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const ALLOWED_ROLES = [1, 2, 5]
const RATE_LIMIT_GET  = { windowMs: 60_000, max: 60 }  // lectura: más permisivo
const RATE_LIMIT_POST = { windowMs: 60_000, max: 20 }  // escritura: más restrictivo

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

// GET /api/question-bank?skill=grammar&cefr=B1&difficulty=medium&topic=present_simple&q=texto
export async function GET(request: NextRequest) {
  const rl = rateLimit(`qbank-get:${getClientIp(request)}`, RATE_LIMIT_GET)
  if (!rl.success) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Intentá de nuevo en ${Math.ceil((rl.resetAt - Date.now()) / 60000)} min.` },
      { status: 429 }
    )
  }

  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role_id, organization_id').eq('id', user.id).single()
  if (!profile || !ALLOWED_ROLES.includes(profile.role_id)) {
    return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
  }

  const sp         = request.nextUrl.searchParams
  const skill      = sp.get('skill')
  const cefr       = sp.get('cefr')
  const difficulty = sp.get('difficulty')
  const topic      = sp.get('topic')
  const q          = sp.get('q')
  const limit      = parseInt(sp.get('limit') ?? '20')

  const { data, error } = await (supabase as any).rpc('suggest_bank_questions', {
    p_organization_id: profile.organization_id,
    p_skill:           skill       || null,
    p_cefr_level:      cefr        || null,
    p_difficulty:      difficulty  || null,
    p_topic:           topic       || null,
    p_limit:           Math.min(limit, 50),
  })

  // Filtro de texto libre si hay query
  let results = data ?? []
  if (q) {
    const lower = q.toLowerCase()
    results = results.filter((r: any) =>
      r.body.toLowerCase().includes(lower) ||
      (r.topic ?? '').toLowerCase().includes(lower)
    )
  }

  return NextResponse.json({ questions: results })
}

// POST /api/question-bank — crear pregunta en el banco
export async function POST(request: NextRequest) {
  const rl = rateLimit(`qbank-post:${getClientIp(request)}`, RATE_LIMIT_POST)
  if (!rl.success) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Intentá de nuevo en ${Math.ceil((rl.resetAt - Date.now()) / 60000)} min.` },
      { status: 429 }
    )
  }

  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role_id, organization_id').eq('id', user.id).single()
  if (!profile || !ALLOWED_ROLES.includes(profile.role_id)) {
    return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
  }

  const body = await request.json()
  const {
    question_body, q_type, skill, difficulty_score, difficulty_label,
    cefr_level, topic, explanation, options,
  } = body

  if (!question_body || !q_type || !skill) {
    return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 })
  }

  const { data: question, error: qErr } = await (supabase as any)
    .from('question_bank')
    .insert({
      organization_id: profile.organization_id,
      created_by:      user.id,
      body:            question_body.trim(),
      q_type,
      skill,
      difficulty_score: difficulty_score ?? 50,
      difficulty_label: difficulty_label ?? 'medium',
      cefr_level:      cefr_level || null,
      topic:           topic || null,
      explanation:     explanation || null,
    })
    .select()
    .single()

  if (qErr || !question) {
    return NextResponse.json({ error: qErr?.message ?? 'Error creando pregunta.' }, { status: 400 })
  }

  // Insertar opciones
  if (options?.length > 0) {
    await (supabase as any).from('question_bank_options').insert(
      options.map((o: any, i: number) => ({
        question_id: question.id,
        body:        o.body,
        is_correct:  o.is_correct ?? false,
        sort_order:  i,
      }))
    )
  }

  return NextResponse.json({ success: true, question })
}
