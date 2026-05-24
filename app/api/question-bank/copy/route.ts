// app/api/question-bank/copy/route.ts
// Copia preguntas del banco a una evaluación — sin RPC, insert directo

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ALLOWED_ROLES = [1, 2, 5]

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role_id').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role_id)) {
      return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
    }

    const { bank_question_ids, evaluation_id } = await request.json()

    if (!evaluation_id || !bank_question_ids?.length) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 })
    }

    const sb = supabase as any

    // Obtener sort_order actual
    const { count } = await sb
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('evaluation_id', evaluation_id)

    let currentOrder = (count ?? 0) + 1
    const copied: string[] = []

    for (const bankId of bank_question_ids) {
      // 1. Obtener pregunta del banco — verificar que pertenece a la misma org
      const { data: bankQ } = await sb
        .from('question_bank')
        .select('*, question_bank_options(*)')
        .eq('id', bankId)
        .eq('organization_id', profile.organization_id)  // aislamiento multi-tenant
        .single()

      if (!bankQ) continue

      // 2. Insertar en questions
      const { data: newQ } = await sb
        .from('questions')
        .insert({
          evaluation_id:    evaluation_id,
          sort_order:       currentOrder,
          q_type:           bankQ.q_type,
          body:             bankQ.body,
          points:           1,
          explanation:      bankQ.explanation ?? null,
          difficulty_score: bankQ.difficulty_score ?? null,
          difficulty_label: bankQ.difficulty_label ?? null,
          skill:            bankQ.skill ?? null,
          topic:            bankQ.topic ?? null,
        })
        .select('id')
        .single()

      if (!newQ) continue

      // 3. Copiar opciones si las hay
      const opts = bankQ.question_bank_options ?? []
      if (opts.length > 0) {
        await sb.from('options').insert(
          opts.map((o: any, i: number) => ({
            question_id: newQ.id,
            body:        o.body,
            is_correct:  o.is_correct,
            sort_order:  o.sort_order ?? i + 1,
          }))
        )
      }

      // 4. Actualizar times_used en el banco
      await sb
        .from('question_bank')
        .update({ times_used: (bankQ.times_used ?? 0) + 1 })
        .eq('id', bankId)

      copied.push(newQ.id)
      currentOrder++
    }

    return NextResponse.json({
      success:      copied.length > 0,
      copied_count: copied.length,
      question_ids: copied,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno.' }, { status: 500 })
  }
}
