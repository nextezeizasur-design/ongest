// RUTA: app/api/join/route.ts

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { code, firstName, lastName, email, password } = await request.json()

    if (!code || !firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Validar código y obtener curso + org
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, name, organization_id, is_active')
      .eq('join_code', code.toUpperCase().trim())
      .single()

    if (courseError || !course) {
      return NextResponse.json({ error: 'Código de curso inválido' }, { status: 404 })
    }

    if (!course.is_active) {
      return NextResponse.json({ error: 'Este curso ya no está activo' }, { status: 400 })
    }

    // 2. Verificar email duplicado
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .eq('organization_id', course.organization_id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese email' }, { status: 409 })
    }

    // 3. Crear usuario en Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      },
    })

    if (authError || !authData.user) {
      if (authError?.message?.includes('already been registered')) {
        return NextResponse.json({ error: 'Ya existe una cuenta con ese email' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 })
    }

    const userId = authData.user.id

    // 4. Insertar profile + enrollment via función SECURITY DEFINER
    const { error: fnError } = await supabaseAdmin.rpc('fn_register_student', {
      p_user_id: userId,
      p_email: email.toLowerCase().trim(),
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_organization_id: course.organization_id,
      p_course_id: course.id,
    })

    if (fnError) {
      // Rollback: eliminar usuario de Auth
      await supabaseAdmin.auth.admin.deleteUser(userId)
      console.error('[fn_register_student] Error:', fnError)
      return NextResponse.json({ error: 'Error al registrar el alumno' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      courseName: course.name,
    })

  } catch (err) {
    console.error('[/api/join] Error inesperado:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
