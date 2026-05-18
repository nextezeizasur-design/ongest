'use client'

// components/shared/StudentRadarCard.tsx
// Muestra el radar de UN alumno específico
// Usado en: panel docente, detalle de alumno en coordinator/director

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SkillRadar from '@/components/shared/SkillRadar'
import type { SkillScore } from '@/components/shared/SkillRadar'

interface StudentRadarCardProps {
  studentId:   string
  studentName: string
  compact?:    boolean   // modo compacto para tablas
}

export default function StudentRadarCard({
  studentId,
  studentName,
  compact = false,
}: StudentRadarCardProps) {
  const supabase = createClient()
  const [skills, setSkills]   = useState<SkillScore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await (supabase as any).rpc('get_student_radar', {
        p_student_id: studentId,
      })
      setSkills(data ?? [])
      setLoading(false)
    }
    load()
  }, [studentId])

  const hasData = skills.some(s => s.score_pct > 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        Sin evaluaciones completadas
      </div>
    )
  }

  if (compact) {
    // Versión compacta: solo barras horizontales sin radar SVG
    return (
      <div className="space-y-1.5">
        {skills.filter(s => s.score_pct > 0).map(s => (
          <div key={s.skill} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20 flex-shrink-0">{s.label}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${s.score_pct}%`,
                  backgroundColor: s.score_pct >= 60 ? '#16a34a' : '#dc2626',
                }}
              />
            </div>
            <span className={`text-xs font-bold w-8 text-right ${
              s.score_pct >= 60 ? 'text-green-600' : 'text-red-500'
            }`}>
              {Math.round(s.score_pct)}%
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-1 text-sm">
        Radar de habilidades
      </h3>
      <p className="text-xs text-gray-400 mb-4">{studentName}</p>
      <SkillRadar
        skills={skills}
        size={220}
        showLegend={true}
        className="mx-auto"
      />
    </div>
  )
}
