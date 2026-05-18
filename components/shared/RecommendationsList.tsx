'use client'

// components/shared/RecommendationsList.tsx
// Muestra las recomendaciones activas del alumno
// Usado en: /results/recommendations y post-examen

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Recommendation {
  id: string
  skill: string
  score_pct: number
  title: string
  body: string
  resource_url: string | null
  resource_label: string | null
  priority: number
  is_read: boolean
  evaluation_title: string | null
  created_at: string
}

const SKILL_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  grammar:    { emoji: '📝', label: 'Grammar',    color: '#3b6d11', bg: '#eaf3de' },
  listening:  { emoji: '🎧', label: 'Listening',  color: '#185fa5', bg: '#e6f1fb' },
  reading:    { emoji: '📖', label: 'Reading',    color: '#854f0b', bg: '#faeeda' },
  writing:    { emoji: '✏️', label: 'Writing',    color: '#993556', bg: '#fbeaf0' },
  vocabulary: { emoji: '📚', label: 'Vocabulary', color: '#642f8d', bg: '#f5eefb' },
  general:    { emoji: '⭐', label: 'General',    color: '#5f5e5a', bg: '#f1efe8' },
}

const PRIORITY_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: 'Prioridad alta',  color: '#dc2626' },
  2: { label: 'Prioridad media', color: '#d97706' },
  3: { label: 'Prioridad baja',  color: '#6b7280' },
}

interface Props {
  studentId?:   string   // si no se pasa, usa el usuario actual
  compact?:     boolean  // modo compacto para panel docente
  attemptId?:   string   // filtrar por intento específico
  maxItems?:    number
}

export default function RecommendationsList({
  studentId,
  compact   = false,
  attemptId,
  maxItems  = 10,
}: Props) {
  const supabase = createClient()

  const [recs, setRecs]       = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      let id = studentId

      if (!id) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        id = user.id
      }

      let query = (supabase as any)
        .from('v_student_active_recommendations')
        .select('*')
        .eq('student_id', id)
        .limit(maxItems)

      if (attemptId) {
        query = query.eq('attempt_id', attemptId)
      }

      const { data } = await query
      setRecs(data ?? [])
      setLoading(false)
    }
    load()
  }, [studentId, attemptId])

  async function markRead(id: string) {
    await supabase
      .from('student_recommendations')
      .update({ is_read: true })
      .eq('id', id)
    setRecs(prev => prev.map(r => r.id === id ? { ...r, is_read: true } : r))
  }

  async function dismiss(id: string) {
    await supabase
      .from('student_recommendations')
      .update({ is_dismissed: true })
      .eq('id', id)
    setRecs(prev => prev.filter(r => r.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (recs.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-2">✅</div>
        <p className="text-sm font-medium text-gray-700">Sin recomendaciones pendientes</p>
        <p className="text-xs text-gray-400 mt-1">
          ¡Buen trabajo! Tu rendimiento está en nivel aceptable.
        </p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {recs.slice(0, 3).map(rec => {
          const skill = SKILL_CONFIG[rec.skill] ?? SKILL_CONFIG.general
          return (
            <div
              key={rec.id}
              className="flex items-start gap-3 p-3 rounded-xl border border-gray-100"
              style={{ backgroundColor: skill.bg }}
            >
              <span className="text-base flex-shrink-0">{skill.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: skill.color }}>
                  {rec.title}
                </p>
                <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{rec.body}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {Math.round(rec.score_pct)}%
              </span>
            </div>
          )
        })}
        {recs.length > 3 && (
          <p className="text-xs text-center text-gray-400">
            +{recs.length - 3} recomendaciones más
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {recs.map(rec => {
        const skill    = SKILL_CONFIG[rec.skill] ?? SKILL_CONFIG.general
        const priority = PRIORITY_LABEL[rec.priority] ?? PRIORITY_LABEL[2]

        return (
          <div
            key={rec.id}
            className={`rounded-2xl border p-5 transition-all ${
              !rec.is_read ? 'border-purple-200' : 'border-gray-200'
            }`}
            style={{ backgroundColor: rec.is_read ? 'white' : skill.bg }}
            onClick={() => !rec.is_read && markRead(rec.id)}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                  style={{ backgroundColor: skill.bg, border: `1px solid ${skill.color}30` }}
                >
                  {skill.emoji}
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: skill.color }}>
                      {skill.label}
                    </span>
                    <span className="text-xs font-medium" style={{ color: priority.color }}>
                      {priority.label}
                    </span>
                    {!rec.is_read && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: '#642f8d', color: 'white' }}
                      >
                        Nuevo
                      </span>
                    )}
                  </div>
                  {rec.evaluation_title && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Luego de: {rec.evaluation_title}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className="text-sm font-bold"
                  style={{ color: rec.score_pct >= 60 ? '#16a34a' : '#dc2626' }}
                >
                  {Math.round(rec.score_pct)}%
                </span>
                <button
                  onClick={e => { e.stopPropagation(); dismiss(rec.id) }}
                  className="text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none"
                  title="Descartar"
                >
                  ×
                </button>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-900 mb-1">{rec.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">{rec.body}</p>

            {rec.resource_url && (
              <a
                href={rec.resource_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                style={{
                  borderColor: skill.color + '40',
                  color: skill.color,
                  backgroundColor: skill.bg,
                }}
                onClick={e => e.stopPropagation()}
              >
                🔗 {rec.resource_label ?? 'Ver recurso'}
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
