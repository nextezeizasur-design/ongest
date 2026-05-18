'use client'

// components/coordinator/DeleteEvaluationButton.tsx
// Botón para eliminar una evaluación (borrador o publicada)
// Requiere confirmación doble para publicadas

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  evalId:   string
  status:   string
  title:    string
  backHref: string
}

export default function DeleteEvaluationButton({ evalId, status, title, backHref }: Props) {
  const [loading, setLoading] = useState(false)
  const router  = useRouter()

  async function handleDelete() {
    const isDraft = status === 'draft'
    const msg = isDraft
      ? `¿Eliminar el borrador "${title}"? Esta acción no se puede deshacer.`
      : `¿Eliminar la evaluación publicada "${title}"?\n\nSe eliminarán también todos los intentos e historial de alumnos. Esta acción es IRREVERSIBLE.`

    if (!window.confirm(msg)) return
    if (!isDraft && !window.confirm('¿Confirmás que querés eliminar permanentemente esta evaluación y todo su historial?')) return

    setLoading(true)
    const supabase = createClient()
    await (supabase as any).from('evaluations').delete().eq('id', evalId)
    setLoading(false)
    router.push(backHref)
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
    >
      {loading ? 'Eliminando…' : '🗑️ Eliminar'}
    </button>
  )
}
