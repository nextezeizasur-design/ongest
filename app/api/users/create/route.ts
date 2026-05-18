import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ROLE_IDS: Record<string, number> = {
  director:    1,
  coordinator: 2,
  secretary:   3,
  student:     4,
  teacher:     5,
}

export async function POST(request: NextRequest) {
  try {
    const { first_name, last_name, email, role, organization_id: bodyOrgId } = await request.json()

    if (!first_name || !last_name || !email || !role) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios.' },
        { status: 400 }
      )
    }

    if (!ROLE_IDS[role]) {
      return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 })
    }

    // Verificar que quien llama es director
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

    if (!profile || profile.role_id !== 1) {
      return NextResponse.json({ error: 'Solo el director puede crear usuarios.' }, { status: 403 })
    }

    const organization_id = bodyOrgId ?? profile.organization_id

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

    // ✅ Opción A: invite por email — el usuario elige su propia contraseña
    // No se genera ni guarda ninguna contraseña temporal
    const { data: inviteData, error: createError } = await (adminSupabase as any).auth.admin.generateLink({
      type:  'invite',
      email: email.trim().toLowerCase(),
      options: {
        data: {
          first_name:      first_name.trim(),
          last_name:       last_name.trim(),
          role_id:         ROLE_IDS[role],
          organization_id: organization_id,
        },
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

    const newUser = inviteData?.user ?? inviteData

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
      .eq('id', newUser.user.id)

    return NextResponse.json({ success: true, invited: true })

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}
