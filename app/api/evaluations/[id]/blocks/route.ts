// RUTA: app/api/evaluations/[id]/blocks/route.ts
//
// Corrige un texto (consigna, párrafo de lectura, enunciado) desde la Vista previa.
// Reemplaza el bloque en TODAS las preguntas de la evaluación que lo contienen,
// porque la consigna y los textos compartidos se repiten en cada pregunta.
//
// Reglas de permiso (definidas por dirección):
//   · director y coordinador: acceso total.
//   · docente: solo en evaluaciones que él mismo creó.
//   · en todos los casos: solo hasta que el examen se abre a los alumnos
//     (borrador, o publicado con fecha de inicio futura) y sin intentos.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { replaceBlock, hasBlock } from '@/lib/replace-block'
import { getEditBlockReason } from '@/lib/evaluation-edit'

const MAX_BLOCK = 8000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const profile = await getProfile()
    if (!profile) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if (!['director', 'coordinator', 'teacher'].includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })

    const payload = await request.json().catch(() => null)
    const oldBlock = typeof payload?.oldBlock === 'string' ? payload.oldBlock : ''
    const newBlock = typeof payload?.newBlock === 'string' ? payload.newBlock : ''
    if (!oldBlock.trim())
      return NextResponse.json({ error: 'Falta el texto original.' }, { status: 400 })
    if (oldBlock.length > MAX_BLOCK || newBlock.length > MAX_BLOCK)
      return NextResponse.json({ error: 'El texto es demasiado largo.' }, { status: 400 })

    const supabase = await createClient()
    const sb       = supabase as any

    const { data: ev } = await sb
      .from('evaluations')
      .select('id, status, available_from, available_until, created_by, organization_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single()
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 })

    if (profile.role === 'teacher' && ev.created_by !== profile.id)
      return NextResponse.json(
        { error: 'Los docentes solo pueden editar sus propias evaluaciones.' },
        { status: 403 },
      )

    const { count: attemptCount } = await sb
      .from('attempts')
      .select('id', { count: 'exact', head: true })
      .eq('evaluation_id', id)

    const blockReason = getEditBlockReason(ev, attemptCount ?? 0)
    if (blockReason) return NextResponse.json({ error: blockReason }, { status: 409 })

    const { data: questions, error: qErr } = await sb
      .from('questions')
      .select('id, body')
      .eq('evaluation_id', id)
    if (qErr) return NextResponse.json({ error: 'No se pudieron leer las preguntas.' }, { status: 500 })

    const targets = (questions ?? []).filter((q: any) => hasBlock(q.body, oldBlock))
    if (targets.length === 0)
      return NextResponse.json(
        { error: 'No se encontró ese texto. Recargá la página: puede haber cambiado.' },
        { status: 404 },
      )

    for (const q of targets) {
      const { error } = await sb
        .from('questions')
        .update({ body: replaceBlock(q.body, oldBlock, newBlock) })
        .eq('id', q.id)
        .eq('evaluation_id', id)
      if (error)
        return NextResponse.json({ error: `Error al guardar: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updated: targets.length })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error inesperado.' }, { status: 500 })
  }
}
