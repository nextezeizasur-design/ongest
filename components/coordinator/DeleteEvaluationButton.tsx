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
  const [errorMsg, setErrorMsg] = useState('')
  const router  = useRouter()

  async function handleDelete() {
    const isDraft = status === 'draft'
    const msg = isDraft
      ? `¿Eliminar el borrador "${title}"? Esta acción no se puede deshacer.`
      : `¿Eliminar la evaluación publicada "${title}"?\n\nSe eliminarán también todos los intentos e historial de alumnos. Esta acción es IRREVERSIBLE.`

    if (!window.confirm(msg)) return
    if (!isDraft && !window.confirm('¿Confirmás que querés eliminar permanentemente esta evaluación y todo su historial?')) return

    setLoading(true)
    setErrorMsg('')
    const supabase = createClient()
    const { error, count } = await (supabase as any)
      .from('evaluations')
      .delete({ count: 'exact' })
      .eq('id', evalId)
    setLoading(false)

    if (error) {
      console.error('[delete evaluation] Error:', error)
      setErrorMsg('No se pudo eliminar la evaluación. Puede tener intentos de alumnos asociados que lo impiden. Contactá a soporte técnico.')
      window.alert('No se pudo eliminar la evaluación.\n\n' + (error.message ?? 'Error desconocido.'))
      return
    }

    if (!count) {
      setErrorMsg('No se eliminó nada — es posible que no tengas permiso sobre esta evaluación.')
      window.alert('No se eliminó nada. Es posible que no tengas permiso sobre esta evaluación.')
      return
    }

    router.push(backHref)
    router.refresh()
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleDelete}
        disabled={loading}
        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
      >
        {loading ? 'Eliminando…' : '🗑️ Eliminar'}
      </button>
      {errorMsg && <p className="text-[11px] text-red-500 max-w-[220px] text-right">{errorMsg}</p>}
    </div>
  )
}
