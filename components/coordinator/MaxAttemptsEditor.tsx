'use client'

// components/coordinator/MaxAttemptsEditor.tsx
// Permite a director/coordinador subir manualmente el límite general de
// intentos de un examen. El default siempre es 1 — esto es la única forma
// de cambiarlo, y solo lo ven las pantallas de director/coordinator.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function MaxAttemptsEditor({
  evalId,
  value,
}: {
  evalId: string
  value: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(value))
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSave() {
    const n = parseInt(draft, 10)
    if (!Number.isFinite(n) || n < 1) {
      alert('El máximo de intentos tiene que ser 1 o más.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await (supabase as any)
      .from('evaluations')
      .update({ max_attempts: n })
      .eq('id', evalId)
    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(String(value)); setEditing(true) }}
        className="font-medium text-gray-900 hover:text-purple-700 underline decoration-dotted"
        title="Cambiar máximo de intentos"
      >
        {value} ✏️
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        className="input text-sm w-14 py-0.5 px-1.5"
        autoFocus
      />
      <button onClick={handleSave} disabled={loading}
        className="text-xs font-medium text-green-700 hover:text-green-900 disabled:opacity-60">
        {loading ? '...' : '✓'}
      </button>
      <button onClick={() => setEditing(false)} disabled={loading}
        className="text-xs font-medium text-gray-400 hover:text-gray-600">
        ✕
      </button>
    </div>
  )
}
