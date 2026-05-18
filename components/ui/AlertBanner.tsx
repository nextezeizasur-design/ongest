interface AlertBannerProps {
  type: 'warn' | 'info' | 'ok' | 'danger'
  children: React.ReactNode
}

const STYLES = {
  warn:   { wrap: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-800' },
  info:   { wrap: 'bg-blue-50  border-blue-200',  dot: 'bg-blue-400',  text: 'text-blue-800' },
  ok:     { wrap: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-800' },
  danger: { wrap: 'bg-red-50   border-red-200',   dot: 'bg-red-500',   text: 'text-red-800' },
}

export default function AlertBanner({ type, children }: AlertBannerProps) {
  const s = STYLES[type]
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-3.5 py-2.5 ${s.wrap}`}>
      <span className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${s.dot}`} />
      <p className={`text-xs leading-relaxed ${s.text}`}>{children}</p>
    </div>
  )
}
