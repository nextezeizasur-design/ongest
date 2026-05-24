import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const RATE_LIMIT = { windowMs: 60_000, max: 10 } // 10 por minuto

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(`students-create:${getClientIp(request)}`, RATE_LIMIT)
    if (!rl.success) {
      return NextResponse.json(
        { error: `Demasiadas solicitudes. Intentá de nuevo en ${Math.ceil((rl.resetAt - Date.now()) / 60000)} min.` },
        { status: 429 }
      )
    }
    const body = await request.json()
    const { first_name, last_name, email, phone, birth_date, course_id, organization_id } = body

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: 'Nombre, apellido y email son obligatorios.' }, { status: 400 })
    }

    // Verificar que quien llama es director o secretary
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

    const { data: callerProfile } = await (supabase as any)
      .from('profiles').select('role_id, organization_id').eq('id', caller.id).single()
    const { data: callerRole } = await (supabase as any)
      .from('roles').select('name').eq('id', callerProfile?.role_id).single()

    if (!['director', 'secretary', 'coordinator'].includes(callerRole?.name)) {
      return NextResponse.json({ error: 'Sin permisos para crear usuarios.' }, { status: 403 })
    }

    // Usar service role para crear el usuario en Auth
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll() { return [] }, setAll() {} } }
    )

    // ✅ Opción A: invite por email — el alumno elige su propia contraseña
    // Supabase envía el email de bienvenida automáticamente
    const { data: inviteData, error: authError } = await (adminSupabase as any).auth.admin.generateLink({
      type:  'invite',
      email: email.trim().toLowerCase(),
      options: {
        data: {
          first_name:      first_name.trim(),
          last_name:       last_name.trim(),
          role_id:         4,
          organization_id: organization_id,
        },
      },
    })

    if (authError) {
      if (authError.message?.includes('already registered')) {
        return NextResponse.json({ error: 'Ya existe un usuario con ese email.' }, { status: 409 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const newUser = inviteData?.user ?? inviteData

    // Actualizar perfil con datos adicionales (el trigger ya lo creó)
    await (adminSupabase as any).from('profiles').update({
      first_name:  first_name.trim(),
      last_name:   last_name.trim(),
      email:       email.trim().toLowerCase(),
      phone:       phone?.trim() || null,
      birth_date:  birth_date || null,
      organization_id,
      role_id:     4,
      is_active:   true,
    }).eq('id', newUser.user.id)

    // Inscribir en curso si se especificó
    if (course_id) {
      await (adminSupabase as any).from('enrollments').insert({
        student_id: newUser.user.id,
        course_id,
      })
    }

    return NextResponse.json({
      success: true,
      user_id: newUser?.id ?? newUser?.user?.id,
      invited: true,
      message: `Alumno creado. Se envió un email de bienvenida a ${email}.`,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno.' }, { status: 500 })
  }
}
