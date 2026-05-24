// app/api/register/route.ts
// Crea una nueva organización + su usuario director en un solo paso.
// Ruta pública — no requiere autenticación previa.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Muy restrictivo: máximo 3 registros por IP cada 60 minutos
const RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 3 }

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quitar acentos
    .replace(/[^a-z0-9\s-]/g, '')      // solo letras, números, guiones
    .trim()
    .replace(/\s+/g, '-')              // espacios → guiones
    .replace(/-+/g, '-')               // guiones dobles → uno
    .slice(0, 50)
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const rl = rateLimit(`register:${getClientIp(req)}`, RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Esperá un momento e intentá de nuevo.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const {
      institute_name,
      director_first_name,
      director_last_name,
      director_email,
    } = body

    // Validaciones básicas
    if (!institute_name?.trim()) {
      return NextResponse.json({ error: 'El nombre del instituto es obligatorio.' }, { status: 400 })
    }
    if (!director_first_name?.trim() || !director_last_name?.trim()) {
      return NextResponse.json({ error: 'El nombre y apellido del director son obligatorios.' }, { status: 400 })
    }
    if (!director_email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(director_email)) {
      return NextResponse.json({ error: 'El email no es válido.' }, { status: 400 })
    }

    const admin = await createAdminClient()
    const sb    = admin as any

    // Generar slug único a partir del nombre del instituto
    const baseSlug = slugify(institute_name.trim())
    if (!baseSlug) {
      return NextResponse.json({ error: 'El nombre del instituto contiene caracteres inválidos.' }, { status: 400 })
    }

    // Verificar que el slug no esté ocupado — agregar sufijo numérico si hace falta
    let finalSlug  = baseSlug
    let slugSuffix = 0

    while (true) {
      const { data: existing } = await sb
        .from('organizations')
        .select('id')
        .eq('slug', finalSlug)
        .maybeSingle()

      if (!existing) break

      slugSuffix++
      finalSlug = `${baseSlug}-${slugSuffix}`
    }

    // Crear la organización
    const { data: org, error: orgError } = await sb
      .from('organizations')
      .insert({
        name:      institute_name.trim(),
        slug:      finalSlug,
        is_active: true,
      })
      .select('id, slug')
      .single()

    if (orgError || !org) {
      console.error('Error creando organización:', orgError)
      return NextResponse.json(
        { error: 'No se pudo crear el instituto. Intentá de nuevo.' },
        { status: 500 }
      )
    }

    // Crear el usuario director vía invitación por email
    // Supabase envía el email de bienvenida automáticamente (requiere SMTP configurado)
    const { data: inviteData, error: inviteError } = await admin.auth.admin.generateLink({
      type:  'invite',
      email: director_email.trim().toLowerCase(),
      options: {
        data: {
          first_name:      director_first_name.trim(),
          last_name:       director_last_name.trim(),
          role_id:         1,               // director
          organization_id: org.id,
        },
      },
    })

    if (inviteError) {
      // Si falla la invitación, eliminar la org para no dejar huérfanos
      await sb.from('organizations').delete().eq('id', org.id)

      if (inviteError.message?.includes('already registered')) {
        return NextResponse.json(
          { error: 'Ya existe una cuenta con ese email. Usá otro email o contactanos.' },
          { status: 409 }
        )
      }

      console.error('Error creando director:', inviteError)
      return NextResponse.json(
        { error: 'No se pudo crear el usuario. Intentá de nuevo.' },
        { status: 500 }
      )
    }

    const newUser = inviteData?.user ?? (inviteData as any)?.user

    // Actualizar el perfil creado por el trigger con los datos completos
    if (newUser?.id) {
      await sb.from('profiles').update({
        first_name:      director_first_name.trim(),
        last_name:       director_last_name.trim(),
        email:           director_email.trim().toLowerCase(),
        organization_id: org.id,
        role_id:         1,
        is_active:       true,
      }).eq('id', newUser.id)
    }

    return NextResponse.json({
      success:      true,
      slug:         finalSlug,
      login_url:    `/login?org=${finalSlug}`,
      message:      `Instituto creado. Se envió un email de activación a ${director_email.trim().toLowerCase()}.`,
    })

  } catch (err: any) {
    console.error('Register error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}
