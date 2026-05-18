import { formatScore, scoreColor, scoreBarColor } from '@/lib/utils'

interface ScoreBarProps {
  score?: number | null
  showLabel?: boolean
  width?: string
}

export default function ScoreBar({ score, showLabel = true, width = 'w-20' }: ScoreBarProps) {
  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <span className={`text-sm font-bold tabular-nums ${scoreColor(score)}`}>
          {formatScore(score)}
        </span>
      )}
      <div className={`score-bar-bg ${width}`}>
        <div
          className={`score-bar ${scoreBarColor(score)}`}
          style={{ width: `${Math.min(score ?? 0, 100)}%` }}
        />
      </div>
    </div>
  )
}
