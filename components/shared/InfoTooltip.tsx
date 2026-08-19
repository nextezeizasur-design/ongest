'use client'

// components/shared/InfoTooltip.tsx
// Ícono "ⓘ" que al tocar/clickear muestra una explicación corta en un
// popover. Pensado para aclarar cómo se calcula una métrica (ej. por qué
// "Promedio general" y "Promedio institucional" pueden mostrar números
// distintos) sin ocupar espacio permanente en la UI. Funciona en mobile
// (tap) y desktop (click) — no depende de :hover.

import { useEffect, useRef, useState } from 'react'

interface InfoTooltipProps {
  text: string
  /** Alineación del popover respecto al ícono. Default: 'left' */
  align?: 'left' | 'right'
}

export default function InfoTooltip({ text, align = 'left' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="Cómo se calcula este dato"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        className="ml-1 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border border-gray-300 text-[9px] font-semibold leading-none text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
      >
        i
      </button>

      {open && (
        <span
          className={`absolute top-5 z-20 w-56 rounded-lg border border-gray-200 bg-white p-2.5 text-left text-[11px] leading-snug text-gray-600 shadow-lg
            ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {text}
        </span>
      )}
    </span>
  )
}
