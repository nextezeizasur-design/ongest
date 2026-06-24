// RUTA: app/api/users/create/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const ROLE_IDS: Record<string, number> = {
  director:    1,
  coordinator: 2,
  secretary:   3,
  student:     4,
  teacher:     5,
}

const RATE_LIMIT = { windowMs: 60_000, max: 10 }

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pass = ''
  for (let i = 0; i < 10; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pass
}

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(`users-create:${getClientIp(request)}`, RATE_LIMIT)
    if (!rl.success) {
      return NextResponse.json(
        { error: `Demasiadas solicitudes. Intentá de nuevo en ${Math.ceil((rl.resetAt - Date.now()) / 60000)} min.` },
        { status: 429 }
      )
    }

    const { first_name, last_name, email, role } = await request.json()

    if (!first_name || !last_name || !email || !role) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios.' },
        { status: 400 }
      )
    }

    if (!ROLE_IDS[role]) {
      return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 })
    }

    // Verificar que quien llama es director o secretary o coordinator
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || ![1, 2, 3].includes(profile.role_id)) {
      return NextResponse.json({ error: 'No tenés permisos para crear usuarios.' }, { status: 403 })
    }

    const organization_id = profile.organization_id

    // Usar Service Role para crear el usuario en Auth
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return [] },
          setAll() {},
        },
      }
    )

    // Generar contraseña temporal
    const tempPassword = generateTempPassword()

    // Crear usuario con contraseña temporal
    const { data: newUserData, error: createError } = await (adminSupabase as any).auth.admin.createUser({
      email:         email.trim().toLowerCase(),
      password:      tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name:      first_name.trim(),
        last_name:       last_name.trim(),
        role_id:         ROLE_IDS[role],
        organization_id: organization_id,
      },
    })

    if (createError) {
      if (createError.message?.includes('already registered')) {
        return NextResponse.json(
          { error: 'Ya existe un usuario con ese email.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    const newUser = newUserData?.user

    // Actualizar el perfil creado por el trigger
    await (adminSupabase as any)
      .from('profiles')
      .update({
        first_name:      first_name.trim(),
        last_name:       last_name.trim(),
        email:           email.trim().toLowerCase(),
        organization_id: organization_id,
        role_id:         ROLE_IDS[role],
        is_active:       true,
      })
      .eq('id', newUser.id)

    return NextResponse.json({
      success:       true,
      temp_password: tempPassword,
    })

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}
