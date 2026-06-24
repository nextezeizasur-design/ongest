'use client'

// components/shared/DirectorCoursesClient.tsx

import { useState } from 'react'
import Link from 'next/link'
import CourseEditModal, { type CourseEditData } from '@/components/shared/CourseEditModal'
import CefrPill from '@/components/ui/CefrPill'
import DeleteCourseButton from '@/components/director/DeleteCourseButton'

interface Teacher {
  id:         string
  first_name: string
  last_name:  string
}

interface Props {
  courses:     CourseEditData[]
  counts:      Record<string, number>
  recCounts?:  Record<string, number>
  teachers:    Teacher[]
  baseHref:    string
  canDelete?:  boolean
}

function JoinCodeBadge({ code }: { code?: string }) {
  const [copied, setCopied] = useState(false)
  if (!code) return null

  function handleCopy() {
    navigator.clipboard.writeText(code!)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 mt-3 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
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

export default function DirectorCoursesClient({
  courses: initialCourses,
  counts,
  recCounts = {},
  teachers,
  baseHref,
  canDelete = false,
}: Props) {
  const [courses, setCourses] = useState<CourseEditData[]>(initialCourses)
  const [editing, setEditing] = useState<CourseEditData | null>(null)

  function handleSaved(updated: CourseEditData) {
    setCourses(prev => prev.map(c => c.id === updated.id ? updated : c))
    setEditing(null)
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map(course => {
          const teacher = course.profiles
          const cefr    = course.cefr_levels
          const alumnos = counts[course.id]    ?? 0
          const grabs   = recCounts[course.id] ?? 0

          return (
            <div key={course.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">

              <div className="p-5 flex-1">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-gray-900 text-base leading-snug">{course.name}</h3>
                  {cefr && <CefrPill code={cefr.code as any} />}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {teacher ? (
                    <>
                      <div className="h-6 w-6 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                        style={{ background: '#642f8d' }}>
                        {teacher.first_name[0]}{teacher.last_name[0]}
                      </div>
                      <span className="text-xs text-gray-600">{teacher.first_name} {teacher.last_name}</span>
                    </>
                  ) : (
                    <span className="text-xs text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                      ⚠ Sin docente asignado
                    </span>
                  )}
                </div>

                <div className="space-y-1 mb-3">
                  {course.schedule_days && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>📅</span><span>{course.schedule_days}</span>
                    </div>
                  )}
                  {(course as any).schedule_time && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>🕐</span><span>{(course as any).schedule_time}</span>
                    </div>
                  )}
                </div>

                {/* Código de ingreso para alumnos */}
                <JoinCodeBadge code={(course as any).join_code} />

                <div className="flex items-center gap-4 pt-3 mt-3 border-t border-gray-100">
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

              <div className="border-t border-gray-100 grid grid-cols-3 divide-x divide-gray-100">
                <Link
                  href={`${baseHref}/courses/${course.id}?tab=recordings`}
                  className="flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-purple-700 transition-colors"
                >
                  <span>📹</span> Grabaciones
                </Link>
                <Link
                  href={`${baseHref}/courses/${course.id}?tab=materials`}
                  className="flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-purple-700 transition-colors"
                >
                  <span>📚</span> Material
                </Link>
                <button
                  onClick={() => setEditing(course)}
                  className="flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                >
                  <span>✏️</span> Editar
                </button>
              </div>

              <div className={`border-t border-gray-100 flex ${canDelete ? 'justify-between' : 'justify-center'} items-center px-4 py-2`}>
                <Link
                  href={`${baseHref}/courses/${course.id}`}
                  className="text-xs text-gray-400 hover:text-purple-700 transition-colors"
                >
                  Ver detalle del curso →
                </Link>
                {canDelete && (
                  <DeleteCourseButton courseId={course.id} courseName={course.name} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <CourseEditModal
          course={editing}
          teachers={teachers}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
