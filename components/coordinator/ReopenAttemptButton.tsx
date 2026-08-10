'use client'

// components/coordinator/ReopenAttemptButton.tsx
// Reabre el intento de UN alumno puntual (visible solo para director/coordinator,
// que son los únicos roles que renderizan las pantallas donde se usa este botón).
// El chequeo de permisos real vive en el RPC reopen_attempt (SECURITY DEFINER),
// este botón es solo la UI.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ReopenAttemptButton({
  attemptId,
  studentName,
}: {
  attemptId: string
  studentName: string
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleReopen() {
    if (!window.confirm(
      `¿Reabrir el intento de ${studentName}? Se borran sus respuestas y la corrección actual, y vuelve a poder rendir la evaluación desde cero.`
    )) return

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await (supabase as any).rpc('reopen_attempt', { p_attempt_id: attemptId })
    setLoading(false)

    const result = Array.isArray(data) ? data[0] : data
    if (error || !result?.ok) {
      alert(result?.error_msg || error?.message || 'No se pudo reabrir el intento.')
      return
    }
    router.refresh()
  }

  return (
    <button
      onClick={handleReopen}
      disabled={loading}
      className="text-xs font-medium text-amber-600 hover:text-amber-800 disabled:opacity-60"
    >
      {loading ? 'Reabriendo…' : '🔓 Reabrir'}
    </button>
  )
}
