'use client'

// components/shared/DirectorCoursesClient.tsx
// Lista de cursos en tarjetas con botón Editar — director y coordinator

import { useState } from 'react'
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
  teachers:    Teacher[]
  baseHref:    string
  canDelete?:  boolean
}

export default function DirectorCoursesClient({ courses: initialCourses, counts, teachers, baseHref, canDelete = false }: Props) {
  const [courses, setCourses] = useState<CourseEditData[]>(initialCourses)
  const [editing, setEditing] = useState<CourseEditData | null>(null)

  function handleSaved(updated: CourseEditData) {
    setCourses(prev => prev.map(c => c.id === updated.id ? updated : c))
    setEditing(null)
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map(course => {
          const teacher = course.profiles
          const cefr    = course.cefr_levels
          const count   = counts[course.id] ?? 0

          return (
            <div key={course.id} className="card hover:shadow-sm transition-shadow relative group">

              {/* Área clickeable → detalle */}
              <a href={`${baseHref}/courses/${course.id}`} className="block">
                <div className="mb-3 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate">{course.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {teacher
                        ? `${teacher.first_name} ${teacher.last_name}`
                        : 'Sin docente asignado'}
                    </p>
                  </div>
                  {cefr && <CefrPill code={cefr.code as any} />}
                </div>

                {/* Bibliografía si existe */}
                {course.bibliography && (
                  <p className="text-xs text-gray-500 line-clamp-1 mb-2">
                    📚 {course.bibliography}
                  </p>
                )}

                {course.description && !course.bibliography && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{course.description}</p>
                )}

                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3.5 w-3.5">
                      <circle cx="6" cy="5" r="2.5"/>
                      <path d="M1 14c0-3.5 2.3-5.5 5-5.5s5 2 5 5.5"/>
                      <path d="M12 8a2 2 0 0 0 0-4M15 14c0-2.5-1.3-4-3.5-4.5"/>
                    </svg>
                    <span className="font-medium">{count}</span> alumno{count !== 1 ? 's' : ''}
                  </div>
                  {cefr && <span className="text-xs text-gray-400">{cefr.label}</span>}
                </div>
              </a>

              {/* Botones al pie */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setEditing(course)}
                  className="text-xs font-medium text-amber-600 hover:text-amber-800 flex items-center gap-1"
                >
                  ✏️ Editar
                </button>
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
