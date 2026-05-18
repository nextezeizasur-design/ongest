interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  subColor?: 'green' | 'red' | 'amber' | 'gray'
  icon?: React.ReactNode
  delay?: number
}

const SUB_COLOR = {
  green: 'text-green-600',
  red:   'text-red-600',
  amber: 'text-amber-600',
  gray:  'text-gray-400',
}

export default function StatCard({ label, value, sub, subColor = 'gray', icon, delay = 0 }: StatCardProps) {
  const delays = ['', 'delay-1', 'delay-2', 'delay-3', 'delay-4']

  return (
    <div className={`card animate-fade-up ${delays[delay] ?? ''}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {icon && <span className="text-gray-300">{icon}</span>}
      </div>
      <p className="mt-2 text-3xl font-semibold text-gray-900 leading-none">{value}</p>
      {sub && (
        <p className={`mt-1.5 text-xs ${SUB_COLOR[subColor]}`}>{sub}</p>
      )}
    </div>
  )
}
