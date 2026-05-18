'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function PublishButton({ evalId }: { evalId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handlePublish() {
    if (!window.confirm('¿Publicar esta evaluación? Los alumnos podrán verla inmediatamente.')) return
    setLoading(true)
    const supabase = createClient()
    await (supabase as any)
      .from('evaluations')
      .update({ status: 'published' })
      .eq('id', evalId)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handlePublish}
      disabled={loading}
      className="btn-brand text-xs py-1.5 px-3 disabled:opacity-60"
    >
      {loading ? 'Publicando…' : 'Publicar'}
    </button>
  )
}
