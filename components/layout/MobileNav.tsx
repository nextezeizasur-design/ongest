'use client'

// components/layout/MobileNav.tsx
// Barra de navegación inferior para alumnos en mobile
// Se muestra solo en pantallas < 768px

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/exam',                    label: 'Exámenes',       icon: '📋' },
  { href: '/results',                 label: 'Notas',          icon: '⭐' },
  { href: '/results/radar',           label: 'Radar',          icon: '📊' },
  { href: '/results/recommendations', label: 'Tips',           icon: '💡' },
  { href: '/results/certificates',    label: 'Certificados',   icon: '🎓' },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-pb">
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href ||
            (item.href !== '/exam' && item.href !== '/results' && pathname.startsWith(item.href)) ||
            (item.href === '/results' && pathname === '/results')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-purple-700' : 'text-gray-400'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className={`text-[10px] font-medium ${active ? 'text-purple-700' : 'text-gray-400'}`}>
                {item.label}
              </span>
              {active && (
                <span
                  className="absolute top-0 h-0.5 w-8 rounded-full"
                  style={{ backgroundColor: '#642f8d' }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
