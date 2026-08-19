import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { generateTempPassword, isValidCustomPassword } from '@/lib/temp-password'

const RATE_LIMIT = { windowMs: 60_000, max: 15 } // 15 por minuto

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(`students-reset-password:${getClientIp(request)}`, RATE_LIMIT)
    if (!rl.success) {
      return NextResponse.json(
        { error: `Demasiadas solicitudes. Intentá de nuevo en ${Math.ceil((rl.resetAt - Date.now()) / 60000)} min.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { student_id, custom_password } = body

    if (!student_id) {
      return NextResponse.json({ error: 'Falta el alumno.' }, { status: 400 })
    }

    if (custom_password && !isValidCustomPassword(custom_password)) {
      return NextResponse.json({ error: 'La contraseña personalizada debe tener al menos 6 caracteres.' }, { status: 400 })
    }

    // Verificar que quien llama es director, secretary o coordinator
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
      return NextResponse.json({ error: 'Sin permisos para reenviar credenciales.' }, { status: 403 })
    }

    // Usar service role para poder tocar auth.users
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll() { return [] }, setAll() {} } }
    )

    // Verificar que el alumno pertenece a la misma organización que quien llama
    const { data: targetProfile } = await (adminSupabase as any)
      .from('profiles')
      .select('id, organization_id, email, first_name, last_name, role_id')
      .eq('id', student_id)
      .single()

    if (!targetProfile || targetProfile.organization_id !== callerProfile?.organization_id) {
      return NextResponse.json({ error: 'Alumno no encontrado.' }, { status: 404 })
    }

    if (targetProfile.role_id !== 4) {
      return NextResponse.json({ error: 'Este endpoint solo permite reenviar credenciales de alumnos.' }, { status: 400 })
    }

    const newPassword = custom_password ? custom_password.trim() : generateTempPassword()

    const { error: authError } = await (adminSupabase as any).auth.admin.updateUserById(
      student_id,
      { password: newPassword }
    )

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    return NextResponse.json({
      success:       true,
      temp_password: newPassword,
      email:         targetProfile.email,
      full_name:     `${targetProfile.first_name} ${targetProfile.last_name}`,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno.' }, { status: 500 })
  }
}
