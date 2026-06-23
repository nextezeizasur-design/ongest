// RUTA: next-ezeiza/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

const RUTAS_PUBLICAS = ['/login', '/join']

const INICIO_POR_ROL: Record<string, string> = {
  director:    '/director',
  coordinator: '/students',
  secretary:   '/students',
  teacher:     '/courses',
  student:     '/exam',
}

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
  if (!user && !RUTAS_PUBLICAS.includes(pathname)) {
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

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
