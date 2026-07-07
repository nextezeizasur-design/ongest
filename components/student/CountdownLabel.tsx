'use client'

// components/student/CountdownLabel.tsx
// Contador en vivo hasta una fecha objetivo (ej: apertura de un examen).
// Se actualiza cada 30s y, al llegar a cero, refresca la página para
// que el examen pase a estar disponible sin que el alumno recargue a mano.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Remaining {
  days: number
  hours: number
  minutes: number
  expired: boolean
}

function computeRemaining(target: string): Remaining {
  const diffMs = new Date(target).getTime() - Date.now()
  if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, expired: true }

  const totalMinutes = Math.floor(diffMs / 60_000)
  return {
    days:    Math.floor(totalMinutes / 1440),
    hours:   Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
    expired: false,
  }
}

function formatRemaining(r: Remaining): string {
  if (r.expired) return 'ya disponible'
  // Más de 1 día: mostramos días + horas (los minutos ya no aportan claridad)
  if (r.days > 0)  return `${r.days} día${r.days !== 1 ? 's' : ''} y ${r.hours} h`
  // Menos de 1 día pero más de 1 hora: horas + minutos
  if (r.hours > 0) return `${r.hours} h ${r.minutes} min`
  // Menos de 1 hora: solo minutos
  return `${r.minutes} min`
}

interface CountdownLabelProps {
  /** Fecha ISO objetivo (ej: available_from) */
  target: string
  /** Texto antes del contador, ej: "en " */
  prefix?: string
  className?: string
  /** Si true (default), refresca la página automáticamente al llegar a 0 */
  autoRefreshOnUnlock?: boolean
}

export default function CountdownLabel({
  target,
  prefix = '',
  className,
  autoRefreshOnUnlock = true,
}: CountdownLabelProps) {
  const router = useRouter()
  const [remaining, setRemaining] = useState<Remaining>(() => computeRemaining(target))
  const alreadyRefreshed = useRef(false)

  useEffect(() => {
    const tick = () => {
      const r = computeRemaining(target)
      setRemaining(r)
      if (r.expired && autoRefreshOnUnlock && !alreadyRefreshed.current) {
        alreadyRefreshed.current = true
        router.refresh()
      }
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [target, router, autoRefreshOnUnlock])

  return <span className={className}>{prefix}{formatRemaining(remaining)}</span>
}
