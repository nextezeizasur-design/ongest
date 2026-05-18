import { getInitials } from '@/lib/utils'

interface AvatarProps {
  firstName: string
  lastName: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
}

export default function Avatar({ firstName, lastName, size = 'md' }: AvatarProps) {
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white ${SIZES[size]}`}
      style={{ background: '#642f8d' }}
    >
      {getInitials(firstName, lastName)}
    </div>
  )
}
