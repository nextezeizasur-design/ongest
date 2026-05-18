import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ALLOWED_ROLES = [1, 2, 5] // director, coordinator, teacher

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
    const formData      = await request.formData()
    const pdfFile       = formData.get('pdf')           as File | null
    const audioFile     = formData.get('audio')         as File | null
    const evaluationId  = formData.get('evaluation_id') as string | null

    if (!evaluationId) {
      return NextResponse.json({ error: 'evaluation_id es requerido.' }, { status: 400 })
    }
    if (!pdfFile && !audioFile) {
      return NextResponse.json({ error: 'Se requiere al menos un archivo.' }, { status: 400 })
    }

    // Cliente admin para Storage (service role key)
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll() { return [] }, setAll() {} } }
    )

    const orgSlug = profile.organization_id
    const ts      = Date.now()

    let pdfUrl:        string | null = null
    let audioUrl:      string | null = null
    let pdfFilename:   string | null = null
    let audioFilename: string | null = null

    // ── Subir PDF ──
    if (pdfFile) {
      const safeName   = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${orgSlug}/${evaluationId}/${ts}_${safeName}`
      const buffer      = Buffer.from(await pdfFile.arrayBuffer())

      const { data, error } = await (adminSupabase as any)
        .storage
        .from('exam-pdfs')
        .upload(storagePath, buffer, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (error) {
        return NextResponse.json({ error: `Error subiendo PDF: ${error.message}` }, { status: 400 })
      }

      const { data: urlData } = (adminSupabase as any)
        .storage
        .from('exam-pdfs')
        .getPublicUrl(data.path)

      pdfUrl      = urlData?.publicUrl ?? null
      pdfFilename = pdfFile.name
    }

    // ── Subir Audio ──
    if (audioFile) {
      const safeName    = audioFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${orgSlug}/${evaluationId}/${ts}_${safeName}`
      const buffer      = Buffer.from(await audioFile.arrayBuffer())

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

      audioUrl      = urlData?.publicUrl ?? null
      audioFilename = audioFile.name
    }

    // ── Upsert en exam_assets ──
    const upsertData: any = {
      evaluation_id: evaluationId,
      uploaded_by:   user.id,
      updated_at:    new Date().toISOString(),
    }
    if (pdfUrl)        upsertData.pdf_url        = pdfUrl
    if (pdfFilename)   upsertData.pdf_filename   = pdfFilename
    if (audioUrl)      upsertData.audio_url      = audioUrl
    if (audioFilename) upsertData.audio_filename = audioFilename

    const { data: asset, error: assetError } = await supabase
      .from('exam_assets')
      .upsert(upsertData, { onConflict: 'evaluation_id' })
      .select()
      .single()

    if (assetError) {
      return NextResponse.json({ error: assetError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, asset })

  } catch (err: any) {
    console.error('[upload-assets]', err)
    return NextResponse.json(
      { error: err.message ?? 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}
