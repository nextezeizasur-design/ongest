// RUTA: app/api/users/delete/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function DELETE(request: NextRequest) {
  try {
    const { user_id } = await request.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id requerido.' }, { status: 400 })
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

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role_id, organization_id')
      .eq('id', user.id)
      .single()

    if (!callerProfile || callerProfile.role_id !== 1) {
      return NextResponse.json({ error: 'Solo el director puede eliminar usuarios.' }, { status: 403 })
    }

    // Verificar que el usuario a eliminar pertenece a la misma org
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('organization_id, role_id')
      .eq('id', user_id)
      .single()

    if (!targetProfile || targetProfile.organization_id !== callerProfile.organization_id) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    // No permitir auto-eliminación
    if (user_id === user.id) {
      return NextResponse.json({ error: 'No podés eliminar tu propia cuenta.' }, { status: 400 })
    }

    // Usar service role para eliminar de Auth (cascadea a profiles por FK)
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

    const { error: deleteError } = await (adminSupabase as any).auth.admin.deleteUser(user_id)

    if (deleteError) {
      console.error('[delete user] Error:', deleteError)
      return NextResponse.json({ error: 'Error al eliminar el usuario.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('[delete user] Error inesperado:', err)
    return NextResponse.json({ error: err.message ?? 'Error interno.' }, { status: 500 })
  }
}
