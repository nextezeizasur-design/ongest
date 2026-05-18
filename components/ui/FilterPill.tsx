interface FilterPillProps {
  href: string
  active: boolean
  children: React.ReactNode
}

export default function FilterPill({ href, active, children }: FilterPillProps) {
  return (
    <a
      href={href}
      className="rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap"
      style={
        active
          ? { background: '#642f8d', color: '#fff' }
          : { background: '#fff', border: '1px solid #e5e7eb', color: '#6b7280' }
      }
    >
      {children}
    </a>
  )
}
