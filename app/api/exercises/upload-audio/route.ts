// RUTA: app/api/exercises/upload-audio/route.ts
//
// Sube el audio de un ejercicio de tipo "listening" mientras se está
// armando la evaluación (todavía sin evaluation_id, porque la evaluación
// no se guardó en la base todavía). Reutiliza el mismo bucket de Storage
// ("exam-audio") y el mismo patrón de auth/roles que
// /api/evaluations/upload-assets — no requiere ninguna migración ni
// política nueva.
//
// Antes de este endpoint, el editor de ejercicios solo guardaba el NOMBRE
// del archivo como texto (ej: "[AUDIO: audio.mp3]") sin subir el audio a
// ningún lado — el alumno nunca tenía un audio real para escuchar.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ALLOWED_ROLES = [1, 2, 5] // director, coordinator, teacher
const MAX_AUDIO_BYTES = 50 * 1024 * 1024 // 50MB — mismo límite que /api/evaluations/upload-assets
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac']

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    // Cliente con anon key para verificar sesión
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

    // ── Auth ──
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || !ALLOWED_ROLES.includes(profile.role_id)) {
      return NextResponse.json({ error: 'Sin permisos para subir archivos.' }, { status: 403 })
    }

    // ── Leer FormData ──
    const formData  = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json({ error: 'Se requiere un archivo de audio.' }, { status: 400 })
    }

    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `El archivo pesa ${(audioFile.size / (1024 * 1024)).toFixed(1)}MB. El máximo permitido es 50MB — comprimilo o subí un MP3 en vez de un WAV sin comprimir.` },
        { status: 400 }
      )
    }

    if (audioFile.type && !ALLOWED_AUDIO_TYPES.includes(audioFile.type)) {
      return NextResponse.json(
        { error: `Formato "${audioFile.type}" no soportado. Usá MP3, WAV, OGG o M4A.` },
        { status: 400 }
      )
    }

    // Cliente admin para Storage (service role key)
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll() { return [] }, setAll() {} } }
    )

    const orgSlug = profile.organization_id
    const ts       = Date.now()
    const safeName = audioFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    // Path "_drafts": la evaluación todavía no tiene id (se está armando en el
    // editor). El archivo queda igual disponible por URL pública una vez que
    // la evaluación se guarda — no hace falta moverlo.
    const storagePath = `${orgSlug}/_drafts/${ts}_${safeName}`
    const buffer       = Buffer.from(await audioFile.arrayBuffer())

    const { data, error } = await (adminSupabase as any)
      .storage
      .from('exam-audio')
      .upload(storagePath, buffer, {
        contentType: audioFile.type || 'audio/mpeg',
        upsert: true,
      })

    if (error) {
      return NextResponse.json({ error: `Error subiendo audio: ${error.message}` }, { status: 400 })
    }

    const { data: urlData } = (adminSupabase as any)
      .storage
      .from('exam-audio')
      .getPublicUrl(data.path)

    return NextResponse.json({
      url:      urlData?.publicUrl ?? null,
      filename: audioFile.name,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error inesperado subiendo el audio.' }, { status: 500 })
  }
}
