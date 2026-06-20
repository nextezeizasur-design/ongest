'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RoleName } from '@/types'

/* ── Icons ── */
const I = {
  grid:   <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg>,
  users:  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="8" cy="6" r="3"/><path d="M2 18c0-4 2.7-6 6-6s6 2 6 6"/><path d="M14 9a2.5 2.5 0 0 0 0-5M18 18c0-3-1.5-4.5-4-5.5"/></svg>,
  book:   <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M4 2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M9 2v16M7 7h2M7 11h2"/></svg>,
  doc:    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}><rect x="3" y="1" width="14" height="18" rx="2"/><path d="M7 6h6M7 10h5M7 14h3"/></svg>,
  chart:  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}><polyline points="2,15 7,9 11,12 18,4"/><path d="M2 18h16"/></svg>,
  check:  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}><polyline points="3,10 8,15 17,5"/></svg>,
  user:   <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="10" cy="6" r="4"/><path d="M3 18c0-4 3-7 7-7s7 3 7 7"/></svg>,
  course: <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M10 2L2 6.5l8 4 8-4L10 2z"/><path d="M2 13.5l8 4 8-4M2 10l8 4 8-4"/></svg>,
  logout: <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M13 3h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4"/><polyline points="9,14 13,10 9,6"/><line x1="13" y1="10" x2="3" y2="10"/></svg>,
  star:   <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/></svg>,
}

interface NavItem { href: string; label: string; icon: React.ReactNode }

const NAV: Record<RoleName, NavItem[]> = {
  director: [
    { href: '/director',               label: 'Dashboard',          icon: I.grid  },
    { href: '/director/students',      label: 'Alumnos',            icon: I.users },
    { href: '/director/courses',       label: 'Cursos',             icon: I.book  },
    { href: '/director/evaluations',   label: 'Evaluaciones',       icon: I.doc   },
    { href: '/director/reports',       label: 'Reportes',           icon: I.chart },
    { href: '/director/users',         label: 'Usuarios',           icon: I.user  },
    { href: '/director/question-bank', label: 'Banco de preguntas', icon: I.book  },
    { href: '/director/analytics',     label: 'Analytics',          icon: I.chart },
    { href: '/director/audit',         label: 'Actividad',          icon: I.check },
  ],
  coordinator: [
    { href: '/coordinator',               label: 'Dashboard',          icon: I.grid  },
    { href: '/coordinator/evaluations',   label: 'Evaluaciones',       icon: I.doc   },
    { href: '/coordinator/results',       label: 'Correcciones',       icon: I.check },
    { href: '/coordinator/courses',       label: 'Cursos',             icon: I.book  },
    { href: '/coordinator/question-bank', label: 'Banco de preguntas', icon: I.book  },
  ],
  secretary: [
    { href: '/secretary',          label: 'Dashboard', icon: I.grid  },
    { href: '/secretary/students', label: 'Alumnos',   icon: I.users },
    { href: '/secretary/courses',  label: 'Cursos',    icon: I.book  },
  ],
  teacher: [
    { href: '/teacher',               label: 'Dashboard',          icon: I.grid  },
    { href: '/teacher/evaluations',   label: 'Evaluaciones',       icon: I.doc   },
    { href: '/teacher/results',       label: 'Correcciones',       icon: I.check },
    { href: '/teacher/courses',       label: 'Mis cursos',         icon: I.book  },
    { href: '/teacher/question-bank', label: 'Banco de preguntas', icon: I.book  },
  ],
  student: [
    { href: '/exam/mi-curso',             label: 'Mi Curso',        icon: I.course },
    { href: '/exam',                      label: 'Mis exámenes',    icon: I.doc    },
    { href: '/results',                   label: 'Mis notas',       icon: I.star   },
    { href: '/results/radar',             label: 'Mi radar',        icon: '📊'     },
    { href: '/results/recommendations',   label: 'Recomendaciones', icon: '💡'     },
    { href: '/results/report',            label: 'Mi reporte',      icon: '📄'     },
    { href: '/results/certificates',      label: 'Mis certificados', icon: '🎓'   },
    { href: '/results/recordings',        label: 'Grabaciones',     icon: '📹'     },
  ],
}

const ROLE_LABEL: Record<RoleName, string> = {
  director:    'Director',
  coordinator: 'Coordinación',
  secretary:   'Secretaría',
  teacher:     'Docente',
  student:     'Alumno',
}

interface SidebarProps {
  role:  RoleName
  name:  string
  email: string
}

export default function Sidebar({ role, name, email }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const items    = NAV[role] ?? []
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [loggingOut, setLoggingOut]               = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <aside className="flex h-screen w-[220px] flex-col border-r border-gray-200 bg-white flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, #642f8d 0%, #4e2470 100%)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.7} className="h-5 w-5">
              <path d="M12 2L3 7l9 5 9-5-9-5z"/>
              <path d="M3 17l9 5 9-5"/>
              <path d="M3 12l9 5 9-5"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">Next English</p>
            <p className="text-[10px] text-gray-400">Evaluaciones</p>
          </div>
        </div>

        {/* Role badge */}
        <div className="px-4 py-2.5 border-b border-gray-100">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: '#f5eefb', color: '#642f8d' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#642f8d' }} />
            {ROLE_LABEL[role]}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {items.map(item => {
            const active = pathname === item.href ||
              (item.href !== '/' + role &&
               item.href !== '/exam' &&
               pathname.startsWith(item.href + '/'))
            return (
              <Link key={item.href} href={item.href}
                className={`nav-link ${active ? 'active' : ''}`}>
                {item.icon}
                <span>{item.label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: '#642f8d' }} />}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-100 p-3 space-y-1">
          {/* Link explícito a Mi perfil */}
          <Link
            href="/profile"
            className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
              pathname === '/profile'
                ? 'text-white'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
            style={pathname === '/profile' ? { background: '#642f8d' } : {}}
          >
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.7}>
              <circle cx="10" cy="6" r="4"/>
              <path d="M3 18c0-4 3-7 7-7s7 3 7 7"/>
            </svg>
            Mi perfil
          </Link>

          {/* Avatar + logout */}
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ background: '#642f8d' }}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-900">{name}</p>
              <p className="truncate text-[10px] text-gray-400">{email}</p>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              title="Cerrar sesión"
              className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
            >
              {I.logout}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Modal confirmación logout ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            {/* Icono */}
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full mx-auto"
              style={{ background: '#f5eefb' }}>
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none" stroke="#642f8d" strokeWidth={1.7}>
                <path d="M13 3h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4"/>
                <polyline points="9,14 13,10 9,6"/>
                <line x1="13" y1="10" x2="3" y2="10"/>
              </svg>
            </div>

            <h3 className="text-center text-base font-semibold text-gray-900 mb-1">
              ¿Cerrar sesión?
            </h3>
            <p className="text-center text-sm text-gray-500 mb-6">
              Tendrás que volver a ingresar con tus datos.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-70"
                style={{ background: loggingOut ? '#9b6cbe' : '#642f8d' }}
              >
                {loggingOut ? 'Saliendo…' : 'Sí, salir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
