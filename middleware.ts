// RUTA: middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

const RUTAS_PUBLICAS = ['/login', '/join', '/api/join', '/register', '/api/register']

// Rutas de API que no deben actualizar last_seen_at (evitar ruido de cron jobs)
const RUTAS_API_EXCLUIDAS = ['/api/cron', '/api/mercadopago']

const INICIO_POR_ROL: Record<string, string> = {
  director:    '/director',
  coordinator: '/students',
  secretary:   '/students',
  teacher:     '/courses',
  student:     '/exam',
}

// Actualizar last_seen_at máximo 1 vez cada 5 minutos por sesión
// para no saturar la DB con cada request estático
const INTERVALO_UPDATE_MS = 5 * 60 * 1000

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as any)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Sin sesión → ir a login
  if (!user && !RUTAS_PUBLICAS.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Con sesión en página de login → redirigir según rol
  if (user && pathname === '/login') {
    const { data } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('profile_id', user.id)
      .single()
    const rol = (data?.roles as any)?.name ?? 'student'
    return NextResponse.redirect(new URL(INICIO_POR_ROL[rol] ?? '/', request.url))
  }

  // ── Tracking de actividad ────────────────────────────────────────────────
  // Solo para usuarios autenticados y rutas que no sean API de sistema
  if (user) {
    const esRutaExcluida = RUTAS_API_EXCLUIDAS.some(r => pathname.startsWith(r))

    if (!esRutaExcluida) {
      // Leer cookie para saber si ya actualizamos en los últimos 5 min
      const lastUpdateCookie = request.cookies.get('_ls_upd')?.value
      const lastUpdate       = lastUpdateCookie ? parseInt(lastUpdateCookie, 10) : 0
      const ahora            = Date.now()

      if (ahora - lastUpdate > INTERVALO_UPDATE_MS) {
        // Traer first_login_at para saber si es el primer acceso
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_login_at')
          .eq('id', user.id)
          .single()

        const updates: Record<string, string> = {
          last_seen_at: new Date().toISOString(),
        }

        // Si nunca ingresó, registrar el primer acceso
        if (!profile?.first_login_at) {
          updates.first_login_at = new Date().toISOString()
        }

        await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)

        // Guardar timestamp en cookie para no volver a actualizar en 5 min
        response.cookies.set('_ls_upd', ahora.toString(), {
          httpOnly: true,
          sameSite: 'lax',
          maxAge:   60 * 5, // 5 minutos
          path:     '/',
        })
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|api/auth).*)'],
}
