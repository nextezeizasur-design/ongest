'use client'

// RUTA: components/teacher/TeacherCourseCards.tsx

import { useState } from 'react'
import Link from 'next/link'
import CefrPill from '@/components/ui/CefrPill'

interface Course {
  id:             string
  name:           string
  join_code?:     string | null
  schedule_days?: string | null
  schedule_time?: string | null
  cefr_levels?:   { code: string; label: string } | null
}

interface Props {
  courses:          Course[]
  alumnosPorCurso:  Record<string, number>
  grabsPorCurso:    Record<string, number>
}

function JoinCodeBadge({ code }: { code?: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!code) return null

  function handleCopy() {
    navigator.clipboard.writeText(code!)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 mt-2 mb-3 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
      <span className="text-xs text-purple-500 font-medium">Código de ingreso:</span>
      <span className="font-mono font-bold text-purple-800 tracking-widest text-sm">{code}</span>
      <button
        onClick={handleCopy}
        className="ml-auto text-xs px-2 py-0.5 rounded font-medium transition-colors"
        style={{ backgroundColor: copied ? '#16a34a' : '#642f8d', color: 'white' }}
      >
        {copied ? '✓ Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

export default function TeacherCourseCards({ courses, alumnosPorCurso, grabsPorCurso }: Props) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {courses.map(c => {
        const alumnos = alumnosPorCurso[c.id] ?? 0
        const grabs   = grabsPorCurso[c.id]   ?? 0

        return (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">

            <div className="p-5 flex-1">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold text-gray-900 text-base leading-snug">{c.name}</h3>
                {c.cefr_levels && <CefrPill code={c.cefr_levels.code as any} />}
              </div>

              <div className="space-y-1.5 mb-3">
                {c.schedule_days && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-base">📅</span>
                    <span>{c.schedule_days}</span>
                  </div>
                )}
                {c.schedule_time && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-base">🕐</span>
                    <span>{c.schedule_time}</span>
                  </div>
                )}
              </div>

              <JoinCodeBadge code={c.join_code} />

              <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.7}>
                    <circle cx="8" cy="6" r="3"/>
                    <path d="M2 18c0-4 2.7-6 6-6s6 2 6 6"/>
                    <path d="M14 9a2.5 2.5 0 0 0 0-5M18 18c0-3-1.5-4.5-4-5.5"/>
                  </svg>
                  <span><strong className="text-gray-900">{alumnos}</strong> alumno{alumnos !== 1 ? 's' : ''}</span>
                </div>
                {grabs > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span>📹</span>
                    <span><strong className="text-gray-900">{grabs}</strong> grabación{grabs !== 1 ? 'es' : ''}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 grid grid-cols-2 divide-x divide-gray-100">
              <Link
                href={`/teacher/courses/${c.id}?tab=recordings`}
                className="flex items-center justify-center gap-2 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-purple-700 transition-colors rounded-bl-2xl"
              >
                <span>📹</span> Grabaciones
              </Link>
              <Link
                href={`/teacher/courses/${c.id}?tab=materials`}
                className="flex items-center justify-center gap-2 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-purple-700 transition-colors rounded-br-2xl"
              >
                <span>📚</span> Material
              </Link>
            </div>

            <Link
              href={`/teacher/courses/${c.id}`}
              className="block text-center text-xs text-gray-400 hover:text-purple-700 py-2 border-t border-gray-100 transition-colors rounded-b-2xl hover:bg-gray-50"
            >
              Ver detalle del curso →
            </Link>
          </div>
        )
      })}
    </div>
  )
}
