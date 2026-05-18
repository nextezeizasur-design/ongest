import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/api/auth']

const ROLE_HOME: Record<string, string> = {
  director:    '/director',
  coordinator: '/coordinator',
  secretary:   '/secretary',
  teacher:     '/teacher',
  student:     '/exam',
}

const ROLE_ALLOWED: Record<string, string[]> = {
  '/director':    ['director'],
  '/coordinator': ['director', 'coordinator'],
  '/secretary':   ['director', 'coordinator', 'secretary'],
  '/teacher':     ['director', 'coordinator', 'teacher'],
  '/exam':        ['director', 'coordinator', 'secretary', 'teacher', 'student'],
  '/results':     ['director', 'coordinator', 'secretary', 'teacher', 'student'],
}

async function getUserRole(supabase: any, userId: string): Promise<string> {
  // Obtener role_id del perfil y luego buscar el nombre del rol
  const { data: profile } = await supabase
    .from('profiles')
    .select('role_id')
    .eq('id', userId)
    .single()

  if (!profile?.role_id) return 'student'

  const { data: role } = await supabase
    .from('roles')
    .select('name')
    .eq('id', profile.role_id)
    .single()

  return role?.name ?? 'student'
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cs: { name: string; value: string; options?: CookieOptions }[]) {
          cs.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cs.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as CookieOptions)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Rutas públicas
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    if (user && pathname === '/login') {
      const role = await getUserRole(supabase, user.id)
      return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/exam', request.url))
    }
    return response
  }

  // Sin sesión → login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Verificar acceso por segmento de ruta
  const segment = '/' + pathname.split('/')[1]
  const allowed = ROLE_ALLOWED[segment]

  if (allowed) {
    const role = await getUserRole(supabase, user.id)
    if (!allowed.includes(role)) {
      return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/exam', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)'],
}
