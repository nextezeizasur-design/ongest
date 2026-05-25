'use client'
// RUTA: components/coordinator/CohortHeatmap.tsx
//
// Heatmap de cohorte: tabla Alumno × Evaluación
// Cada celda muestra el puntaje con color según aprobado/desaprobado/pendiente.
// Permite filtrar por curso cuando hay varios.

import { useState } from 'react'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface HeatmapStudent {
  id:         string
  first_name: string
  last_name:  string
  course_id:  string
  course_name: string
}

export interface HeatmapEval {
  id:         string
  title:      string
  pass_score: number
  course_ids: string[]   // cursos a los que está asignada
}

export interface HeatmapAttempt {
  student_id:    string
  evaluation_id: string
  score:         number | null
  passed:        boolean | null
  status:        string   // submitted | graded | in_progress | timed_out | flagged
}

interface Props {
  students: HeatmapStudent[]
  evals:    HeatmapEval[]
  attempts: HeatmapAttempt[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellStyle(attempt: HeatmapAttempt | undefined, passScore: number): {
  bg: string; text: string; label: string; title: string
} {
  if (!attempt) {
    return { bg: 'bg-gray-50', text: 'text-gray-300', label: '—', title: 'Sin intentar' }
  }

  if (attempt.status === 'in_progress') {
    return { bg: 'bg-blue-50', text: 'text-blue-500', label: '…', title: 'En progreso' }
  }

  if (attempt.status === 'submitted') {
    return { bg: 'bg-amber-50', text: 'text-amber-600', label: '✓', title: 'Entregado — pendiente de corrección' }
  }

  if (attempt.status === 'timed_out') {
    return { bg: 'bg-orange-50', text: 'text-orange-500', label: 'T', title: 'Tiempo agotado' }
  }

  if (attempt.status === 'flagged') {
    return { bg: 'bg-purple-50', text: 'text-purple-500', label: '⚑', title: 'Marcado para revisión' }
  }

  // graded
  const score = attempt.score ?? 0
  if (attempt.passed) {
    return {
      bg:    score >= 80 ? 'bg-green-100' : 'bg-green-50',
      text:  score >= 80 ? 'text-green-700' : 'text-green-600',
      label: `${Math.round(score)}%`,
      title: `Aprobado — ${Math.round(score)}%`,
    }
  } else {
    return {
      bg:    score >= passScore * 0.75 ? 'bg-amber-50' : 'bg-red-50',
      text:  score >= passScore * 0.75 ? 'text-amber-700' : 'text-red-600',
      label: `${Math.round(score)}%`,
      title: `Desaprobado — ${Math.round(score)}%`,
    }
  }
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function CohortHeatmap({ students, evals, attempts }: Props) {
  // Cursos únicos para el filtro
  const courses = Array.from(
    new Map(students.map(s => [s.course_id, s.course_name])).entries()
  ).map(([id, name]) => ({ id, name }))

  const [selectedCourse, setSelectedCourse] = useState<string>(
    courses.length > 0 ? courses[0].id : ''
  )

  // Filtrar alumnos y evaluaciones según curso seleccionado
  const filteredStudents = students
    .filter(s => s.course_id === selectedCourse)
    .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`))

  const filteredEvals = evals
    .filter(e => e.course_ids.includes(selectedCourse))

  // Índice de intentos para lookup O(1)
  const attemptIndex = new Map(
    attempts.map(a => [`${a.student_id}:${a.evaluation_id}`, a])
  )

  // Stats del curso seleccionado
  const gradedAttempts = attempts.filter(a =>
    a.status === 'graded' &&
    filteredStudents.some(s => s.id === a.student_id) &&
    filteredEvals.some(e => e.id === a.evaluation_id)
  )
  const approvedCount  = gradedAttempts.filter(a => a.passed).length
  const totalGraded    = gradedAttempts.length
  const approvalRate   = totalGraded > 0 ? Math.round((approvedCount / totalGraded) * 100) : null

  // Alumnos en riesgo: tienen al menos un intento graded desaprobado y ninguno aprobado
  const atRisk = filteredStudents.filter(s => {
    const studentAttempts = gradedAttempts.filter(a => a.student_id === s.id)
    return studentAttempts.length > 0 && studentAttempts.every(a => !a.passed)
  })

  if (filteredStudents.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Heatmap de cohorte</h2>
        </div>
        <p className="text-sm text-gray-400 text-center py-6">
          No hay alumnos inscriptos en ningún curso.
        </p>
      </div>
    )
  }

  return (
    <div className="card p-0 overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Heatmap de cohorte</h2>
          {approvalRate !== null && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              approvalRate >= 70 ? 'bg-green-100 text-green-700' :
              approvalRate >= 50 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-600'
            }`}>
              {approvalRate}% aprobación
            </span>
          )}
          {atRisk.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
              ⚠ {atRisk.length} en riesgo
            </span>
          )}
        </div>

        {/* Selector de curso */}
        {courses.length > 1 && (
          <select
            value={selectedCourse}
            onChange={e => setSelectedCourse(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-1"
            style={{ '--tw-ring-color': '#642f8d' } as any}
          >
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      {filteredEvals.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8 px-5">
          No hay evaluaciones asignadas a este curso.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 border-b border-gray-100 sticky left-0 bg-gray-50 min-w-[160px]">
                  Alumno
                </th>
                {filteredEvals.map(ev => (
                  <th
                    key={ev.id}
                    className="px-2 py-2.5 font-medium text-gray-500 border-b border-gray-100 text-center min-w-[80px] max-w-[100px]"
                    title={ev.title}
                  >
                    <a
                      href={`/coordinator/evaluations/${ev.id}`}
                      className="hover:underline block truncate max-w-[90px]"
                      style={{ color: '#642f8d' }}
                    >
                      {ev.title.length > 14 ? ev.title.slice(0, 13) + '…' : ev.title}
                    </a>
                    <span className="text-gray-300 font-normal">≥{ev.pass_score}%</span>
                  </th>
                ))}
                <th className="px-3 py-2.5 font-medium text-gray-500 border-b border-gray-100 text-center min-w-[64px]">
                  Promedio
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map((student, si) => {
                // Calcular promedio del alumno (solo graded)
                const studentGraded = filteredEvals
                  .map(ev => attemptIndex.get(`${student.id}:${ev.id}`))
                  .filter(a => a?.status === 'graded' && a.score !== null)

                const avg = studentGraded.length > 0
                  ? Math.round(studentGraded.reduce((acc, a) => acc + (a!.score ?? 0), 0) / studentGraded.length)
                  : null

                const isAtRisk = atRisk.some(s => s.id === student.id)

                return (
                  <tr
                    key={student.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                      isAtRisk ? 'bg-red-50/30' : si % 2 === 0 ? '' : 'bg-gray-50/20'
                    }`}
                  >
                    {/* Nombre del alumno */}
                    <td className="px-4 py-2 sticky left-0 bg-inherit">
                      <div className="flex items-center gap-2">
                        {isAtRisk && (
                          <span className="text-red-400 text-xs flex-shrink-0" title="En riesgo">⚠</span>
                        )}
                        <a
                          href={`/teacher/students/${student.id}`}
                          className="font-medium text-gray-800 hover:underline truncate max-w-[140px] block"
                          title={`${student.first_name} ${student.last_name}`}
                        >
                          {student.last_name}, {student.first_name}
                        </a>
                      </div>
                    </td>

                    {/* Celda por evaluación */}
                    {filteredEvals.map(ev => {
                      const attempt = attemptIndex.get(`${student.id}:${ev.id}`)
                      const { bg, text, label, title } = cellStyle(attempt, ev.pass_score)

                      return (
                        <td key={ev.id} className="px-1 py-1.5 text-center">
                          {attempt && attempt.status === 'graded' ? (
                            <a
                              href={`/coordinator/results/${attempt.student_id}`}
                              title={title}
                              className={`inline-flex items-center justify-center w-14 h-7 rounded-md text-xs font-semibold transition-opacity hover:opacity-80 ${bg} ${text}`}
                            >
                              {label}
                            </a>
                          ) : (
                            <span
                              title={title}
                              className={`inline-flex items-center justify-center w-14 h-7 rounded-md text-xs font-medium ${bg} ${text}`}
                            >
                              {label}
                            </span>
                          )}
                        </td>
                      )
                    })}

                    {/* Promedio del alumno */}
                    <td className="px-3 py-1.5 text-center">
                      {avg !== null ? (
                        <span className={`inline-flex items-center justify-center w-12 h-7 rounded-md text-xs font-bold ${
                          avg >= 60 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {avg}%
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Leyenda ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
        <span className="text-xs text-gray-400 font-medium">Leyenda:</span>
        {[
          { bg: 'bg-green-100', text: 'text-green-700', label: 'Aprobado ≥80%' },
          { bg: 'bg-green-50',  text: 'text-green-600', label: 'Aprobado' },
          { bg: 'bg-amber-50',  text: 'text-amber-700', label: 'Cerca del límite' },
          { bg: 'bg-red-50',    text: 'text-red-600',   label: 'Desaprobado' },
          { bg: 'bg-amber-50',  text: 'text-amber-600', label: '✓ Entregado' },
          { bg: 'bg-gray-50',   text: 'text-gray-300',  label: '— Sin intentar' },
        ].map(item => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center w-8 h-5 rounded text-xs font-semibold ${item.bg} ${item.text}`}>
              {item.label.split(' ')[0]}
            </span>
            <span className="text-xs text-gray-400">{item.label}</span>
          </span>
        ))}
      </div>

    </div>
  )
}
