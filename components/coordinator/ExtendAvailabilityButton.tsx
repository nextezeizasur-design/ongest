'use client'

// components/coordinator/ExtendAvailabilityButton.tsx
// Permite a director/coordinador extender (o reabrir, si ya venció) la fecha
// "Vence" de una evaluación sin tener que pasar por la edición completa —
// que además está bloqueada una vez que la evaluación empezó a rendirse.
// Solo cambia available_until; no toca preguntas, cursos asignados ni status.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'

const QUICK_OPTIONS = [
  { label: '+1 día',    days: 1 },
  { label: '+3 días',   days: 3 },
  { label: '+1 semana', days: 7 },
  { label: '+1 mes',    days: 30 },
]

// Formato requerido por <input type="datetime-local"> en hora local del navegador
function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function ExtendAvailabilityButton({
  evalId,
  currentUntil,
  isClosed,
}: {
  evalId: string
  currentUntil: string | null
  isClosed: boolean
}) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [customValue, setCustomValue] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return toLocalInputValue(d)
  })
  const router = useRouter()

  async function applyNewDate(newDate: Date, confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await (supabase as any)
      .from('evaluations')
      .update({ available_until: newDate.toISOString() })
      .eq('id', evalId)
    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }
    setOpen(false)
    router.refresh()
  }

  function handleQuickOption(days: number) {
    const newDate = new Date()
    newDate.setDate(newDate.getDate() + days)
    applyNewDate(
      newDate,
      `¿${isClosed ? 'Reabrir' : 'Extender'} esta evaluación hasta el ${formatDateTime(newDate.toISOString())}? Todos los alumnos asignados van a poder rendirla (o volver a intentarla, según su límite de intentos) hasta esa fecha.`
    )
  }

  function handleCustomApply() {
    const newDate = new Date(customValue)
    if (isNaN(newDate.getTime())) {
      alert('Fecha inválida.')
      return
    }
    applyNewDate(
      newDate,
      `¿${isClosed ? 'Reabrir' : 'Extender'} esta evaluación hasta el ${formatDateTime(newDate.toISOString())}? Todos los alumnos asignados van a poder rendirla (o volver a intentarla, según su límite de intentos) hasta esa fecha.`
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium underline decoration-dotted"
        style={{ color: isClosed ? '#642f8d' : undefined }}
      >
        {isClosed ? '🔓 Reabrir evaluación' : '✏️ Extender vencimiento'}
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 space-y-3">
      <p className="text-xs font-medium text-gray-700">
        {isClosed ? 'Reabrir hasta…' : 'Extender vencimiento hasta…'}
      </p>

      <div className="flex flex-wrap gap-2">
        {QUICK_OPTIONS.map(opt => (
          <button
            key={opt.days}
            onClick={() => handleQuickOption(opt.days)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-purple-200 bg-white text-xs font-medium text-gray-700 hover:bg-purple-100 disabled:opacity-60"
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-purple-100">
        <input
          type="datetime-local"
          value={customValue}
          onChange={e => setCustomValue(e.target.value)}
          className="input text-xs py-1.5 flex-1 min-w-[180px]"
        />
        <button
          onClick={handleCustomApply}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-60"
          style={{ background: '#642f8d' }}
        >
          {loading ? 'Aplicando…' : 'Aplicar'}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={loading}
          className="text-xs font-medium text-gray-400 hover:text-gray-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
