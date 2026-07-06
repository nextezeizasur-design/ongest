import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const RATE_LIMIT = { windowMs: 60_000, max: 20 } // 20 por minuto

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(`students-update:${getClientIp(request)}`, RATE_LIMIT)
    if (!rl.success) {
      return NextResponse.json(
        { error: `Demasiadas solicitudes. Intentá de nuevo en ${Math.ceil((rl.resetAt - Date.now()) / 60000)} min.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { student_id, first_name, last_name, email, phone, birth_date, course_id } = body

    if (!student_id || !first_name || !last_name || !email) {
      return NextResponse.json({ error: 'Nombre, apellido y email son obligatorios.' }, { status: 400 })
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
      return NextResponse.json({ error: 'Sin permisos para editar alumnos.' }, { status: 403 })
    }

    // Usar service role para poder tocar auth.users y cualquier perfil de la organización
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll() { return [] }, setAll() {} } }
    )

    // Verificar que el alumno a editar pertenece a la misma organización que quien llama
    const { data: targetProfile } = await (adminSupabase as any)
      .from('profiles').select('id, organization_id, email').eq('id', student_id).single()

    if (!targetProfile || targetProfile.organization_id !== callerProfile?.organization_id) {
      return NextResponse.json({ error: 'Alumno no encontrado.' }, { status: 404 })
    }

    const newEmail = email.trim().toLowerCase()

    // Si el email cambió, actualizarlo primero en Auth (ahí vive el login real)
    if (newEmail !== targetProfile.email) {
      const { error: authError } = await (adminSupabase as any).auth.admin.updateUserById(
        student_id,
        { email: newEmail, email_confirm: true }
      )

      if (authError) {
        if (authError.message?.includes('already been registered') || authError.message?.includes('already registered')) {
          return NextResponse.json({ error: 'Ya existe un usuario con ese email.' }, { status: 409 })
        }
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }
    }

    // Actualizar el perfil (siempre en la misma operación que Auth, para que nunca queden desincronizados)
    const { error: profileError } = await (adminSupabase as any).from('profiles').update({
      first_name: first_name.trim(),
      last_name:  last_name.trim(),
      email:      newEmail,
      phone:      phone?.trim() || null,
      birth_date: birth_date || null,
    }).eq('id', student_id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Actualizar curso/inscripción si se especificó
    if (course_id !== undefined) {
      const { data: currentEnrollment } = await (adminSupabase as any)
        .from('enrollments').select('course_id').eq('student_id', student_id).maybeSingle()

      const currentCourseId = currentEnrollment?.course_id ?? ''
      if (course_id !== currentCourseId) {
        if (currentCourseId) {
          await (adminSupabase as any).from('enrollments').delete().eq('student_id', student_id)
        }
        if (course_id) {
          await (adminSupabase as any).from('enrollments').insert({ student_id, course_id })
        }
      }
    }

    return NextResponse.json({ success: true, email: newEmail })

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno.' }, { status: 500 })
  }
}
