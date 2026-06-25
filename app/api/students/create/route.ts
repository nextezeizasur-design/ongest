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

    // Generar contraseña temporal (10 caracteres)
    const tempPassword = Math.random().toString(36).slice(2, 7) +
                         Math.random().toString(36).slice(2, 7).toUpperCase()

    const { data: authData, error: authError } = await (adminSupabase as any).auth.admin.createUser({
      email:          email.trim().toLowerCase(),
      password:       tempPassword,
      email_confirm:  true,
      user_metadata: {
        first_name:      first_name.trim(),
        last_name:       last_name.trim(),
        role_id:         4,
        organization_id: organization_id,
      },
    })

    if (authError) {
      if (authError.message?.includes('already registered') || authError.message?.includes('already been registered')) {
        return NextResponse.json({ error: 'Ya existe un usuario con ese email.' }, { status: 409 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const newUserId: string | undefined = authData?.user?.id
    if (!newUserId) {
      return NextResponse.json({ error: 'Error al obtener el ID del usuario creado.' }, { status: 500 })
    }

    // Actualizar perfil con datos adicionales (el trigger ya lo creó)
    await (adminSupabase as any).from('profiles').update({
      first_name:      first_name.trim(),
      last_name:       last_name.trim(),
      email:           email.trim().toLowerCase(),
      phone:           phone?.trim() || null,
      birth_date:      birth_date || null,
      organization_id,
      role_id:         4,
      is_active:       true,
    }).eq('id', newUserId)

    // Inscribir en curso si se especificó
    if (course_id) {
      await (adminSupabase as any).from('enrollments').insert({
        student_id: newUserId,
        course_id,
      })
    }

    return NextResponse.json({
      success:       true,
      user_id:       newUserId,
      temp_password: tempPassword,
      email:         email.trim().toLowerCase(),
      full_name:     `${first_name.trim()} ${last_name.trim()}`,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno.' }, { status: 500 })
  }
}
