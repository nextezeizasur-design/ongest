import type { CefrCode } from '@/types'

interface CefrPillProps {
  code?: CefrCode | string | null
  showLabel?: boolean
  label?: string
}

export default function CefrPill({ code, showLabel = false, label }: CefrPillProps) {
  if (!code) return <span className="text-gray-400">—</span>
  return (
    <span className={`cefr-pill cefr-${code}`}>
      {code}{showLabel && label ? ` · ${label}` : ''}
    </span>
  )
}
