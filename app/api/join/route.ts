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

    // 1. Validar código y obtener curso + org + docente
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, name, organization_id, is_active, teacher_id')
      .eq('join_code', code.toUpperCase().trim())
      .single()

    if (courseError || !course) {
      return NextResponse.json({ error: 'Código de curso inválido' }, { status: 404 })
    }

    if (!course.is_active) {
      return NextResponse.json({ error: 'Este curso ya no está activo' }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()

    // 2. Verificar duplicado en Auth
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers()
    const existsInAuth = authList?.users?.some(u => u.email === cleanEmail)
    if (existsInAuth) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese email' }, { status: 409 })
    }

    // 3. Crear usuario en Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      },
    })

    if (authError || !authData.user) {
      console.error('[/api/join] Auth createUser error:', authError)
      return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 })
    }

    const userId = authData.user.id

    // 4. Insertar profile + enrollment via función SECURITY DEFINER
    const { error: fnError } = await supabaseAdmin.rpc('fn_register_student', {
      p_user_id: userId,
      p_email: cleanEmail,
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_organization_id: course.organization_id,
      p_course_id: course.id,
    })

    if (fnError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      console.error('[fn_register_student] Error:', JSON.stringify(fnError))
      return NextResponse.json({
        error: 'Error al registrar el alumno',
        detail: fnError.message,
        code: fnError.code
      }, { status: 500 })
    }

    // 5. Notificaciones automáticas — no bloquean el registro si fallan
    try {
      const studentFullName = `${firstName.trim()} ${lastName.trim()}`
      const notifTitle = '👤 Nuevo alumno registrado'
      const notifBody  = `${studentFullName} se unió al curso "${course.name}".`
      const notifLink  = `/students`

      // Destinatarios: docente del curso + todas las secretarias de la org
      const recipientIds: string[] = []

      // Docente del curso (si tiene uno asignado)
      if (course.teacher_id) {
        recipientIds.push(course.teacher_id)
      }

      // Secretarias de la misma organización (role_id = 3)
      const { data: secretaries } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('organization_id', course.organization_id)
        .eq('role_id', 3)

      if (secretaries && secretaries.length > 0) {
        for (const s of secretaries) {
          // Evitar duplicado si el docente también es secretaria (raro pero posible)
          if (!recipientIds.includes(s.id)) {
            recipientIds.push(s.id)
          }
        }
      }

      // Insertar una notificación por destinatario
      if (recipientIds.length > 0) {
        const notifications = recipientIds.map(uid => ({
          user_id:    uid,
          title:      notifTitle,
          body:       notifBody,
          type:       'new_student',
          link:       notifLink,
          is_read:    false,
        }))

        const { error: notifError } = await supabaseAdmin
          .from('notifications')
          .insert(notifications)

        if (notifError) {
          // Solo log — el registro del alumno ya fue exitoso
          console.error('[/api/join] Error insertando notificaciones:', notifError)
        }
      }
    } catch (notifErr) {
      console.error('[/api/join] Notificaciones fallaron (no crítico):', notifErr)
    }

    return NextResponse.json({
      success: true,
      courseName: course.name,
    })

  } catch (err: any) {
    console.error('[/api/join] Error inesperado:', err)
    return NextResponse.json({
      error: 'Error interno del servidor',
      detail: err?.message
    }, { status: 500 })
  }
}
