'use client'

// components/coordinator/PublishResultsButton.tsx
// Publica el resultado de UN intento ya auto-corregido (evaluación 100%
// objetiva, status='graded' pero results_published_at aún null) — hasta
// que alguien del staff aprieta este botón, el alumno no ve nota, no ve
// aprobado/desaprobado, y no puede descargar certificado ni constancia.
//
// Reutiliza /api/certificates/issue: cuando el caller es staff, esa misma
// llamada marca results_published_at y emite el certificado. Después
// dispara la notificación in-app + email al alumno.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PublishResultsButton({
  attemptId,
  studentName,
}: {
  attemptId: string
  studentName: string
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handlePublish() {
    if (!window.confirm(
      `¿Publicar el resultado de ${studentName}? A partir de ahora va a poder ver su nota y descargar el certificado/constancia.`
    )) return

    setLoading(true)
    try {
      const res = await fetch('/api/certificates/issue', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ attempt_id: attemptId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data?.error ?? 'No se pudo publicar el resultado.')
        setLoading(false)
        return
      }

      // Notificar al alumno (fire & forget — no bloquea la publicación si falla)
      fetch('/api/notifications/exam-graded', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ attempt_id: attemptId }),
      }).catch(() => {})

      router.refresh()
    } catch (err) {
      console.error('Error publicando resultado:', err)
      alert('No se pudo publicar el resultado. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handlePublish}
      disabled={loading}
      className="text-xs font-medium hover:opacity-80 disabled:opacity-60"
      style={{ color: '#642f8d' }}
    >
      {loading ? 'Publicando…' : '📤 Publicar resultado'}
    </button>
  )
}
