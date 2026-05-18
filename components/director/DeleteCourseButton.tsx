'use client'

// components/director/DeleteCourseButton.tsx
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  courseId:   string
  courseName: string
}

export default function DeleteCourseButton({ courseId, courseName }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const ok = window.confirm(
      `¿Eliminar el curso "${courseName}"?\n\nLos alumnos serán desvinculados. Esta acción no se puede deshacer.`
    )
    if (!ok) return

    setLoading(true)

    const supabase = createClient()
    const { error } = await (supabase as any)
      .from('courses')
      .update({ is_active: false })
      .eq('id', courseId)

    if (error) {
      alert('Error al eliminar: ' + error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    window.location.reload()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="opacity-0 group-hover:opacity-100 transition-all text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 bg-white font-medium disabled:opacity-40 flex-shrink-0"
      title={`Eliminar ${courseName}`}
    >
      {loading ? '…' : '🗑️ Eliminar'}
    </button>
  )
}
