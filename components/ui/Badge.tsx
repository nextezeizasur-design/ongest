interface BadgeProps {
  variant: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray'
  children: React.ReactNode
  size?: 'sm' | 'md'
}

const VARIANTS = {
  green:  'bg-green-100  text-green-800',
  red:    'bg-red-100    text-red-800',
  amber:  'bg-amber-100  text-amber-800',
  blue:   'bg-blue-100   text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  gray:   'bg-gray-100   text-gray-600',
}

export default function Badge({ variant, children, size = 'md' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
    } ${VARIANTS[variant]}`}>
      {children}
    </span>
  )
}
