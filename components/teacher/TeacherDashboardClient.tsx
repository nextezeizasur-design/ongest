'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import StudentRadarCard from '@/components/shared/StudentRadarCard'
import ReportButton from '@/components/shared/ReportButton'
import ClassRecordings from '@/components/shared/ClassRecordings'

interface Course {
  id: string
  name: string
  cefr_levels?: { code: string; label: string }
}

interface StudentOverview {
  student_id: string
  first_name: string
  last_name: string
  email: string
  cefr_code: string | null
  total_attempts: number
  avg_score: number | null
  avg_score_recent: number | null
  last_attempt_at: string | null
  risk_status: 'ok' | 'at_risk' | 'critical' | 'inactive'
}

interface Alert {
  alert_type: string
  priority: number
  student_id: string | null
  student_name: string | null
  evaluation_id: string | null
  eval_title: string | null
  metric_value: number | null
  message: string
}

interface CourseSummary {
  total_students: number
  active_students: number
  at_risk_students: number
  critical_students: number
  avg_group_score: number | null
  evaluations_count: number
}

interface ProblemQuestion {
  question_id: string
  body: string
  skill: string | null
  topic: string | null
  error_rate_pct: number
  total_answers: number
  evaluation_title: string
}

const RISK_CONFIG = {
  ok:       { label: 'Al día',    color: 'bg-green-100 text-green-800',  dot: 'bg-green-500'  },
  at_risk:  { label: 'En riesgo', color: 'bg-amber-100 text-amber-800',  dot: 'bg-amber-500'  },
  critical: { label: 'Crítico',   color: 'bg-red-100 text-red-800',      dot: 'bg-red-500'    },
  inactive: { label: 'Inactivo',  color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400'   },
}

const ALERT_CONFIG = {
  low_score:     { icon: '📉', label: 'Bajo rendimiento', color: 'border-l-red-500 bg-red-50'    },
  inactive:      { icon: '💤', label: 'Sin actividad',    color: 'border-l-amber-500 bg-amber-50' },
  hard_question: { icon: '❗', label: 'Pregunta difícil', color: 'border-l-blue-500 bg-blue-50'  },
}

interface Props {
  teacherId:      string
  organizationId: string
  courses:        Course[]
}

export default function TeacherDashboardClient({ teacherId, organizationId, courses }: Props) {
  const supabase = createClient()
  const sb       = supabase as any

  const [selectedCourse, setSelectedCourse] = useState<string>(courses[0]?.id ?? '')
  const [students, setStudents]             = useState<StudentOverview[]>([])
  const [alerts, setAlerts]                 = useState<Alert[]>([])
  const [summary, setSummary]               = useState<CourseSummary | null>(null)
  const [problems, setProblems]             = useState<ProblemQuestion[]>([])
  const [loading, setLoading]               = useState(true)
  const [loadError, setLoadError]           = useState<string | null>(null)
  const [activeTab, setActiveTab]           = useState<'overview' | 'alerts' | 'questions' | 'recordings'>('overview')
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedCourse) {
      setLoading(false)
      return
    }
    loadData()
  }, [selectedCourse])

  async function loadData() {
    setLoading(true)
    setLoadError(null)

    try {
      const [studentsRes, alertsRes, summaryRes, problemsRes] = await Promise.all([
        sb.from('v_teacher_student_overview')
          .select('*')
          .eq('course_id', selectedCourse)
          .order('risk_status')
          .order('avg_score_recent', { ascending: true }),
        sb.rpc('get_teacher_alerts', {
          p_course_id:       selectedCourse,
          p_organization_id: organizationId,
        }),
        sb.rpc('get_course_summary', { p_course_id: selectedCourse }),
        sb.from('v_problem_questions')
          .select('question_id, body, skill, topic, error_rate_pct, total_answers, evaluation_title')
          .eq('organization_id', organizationId)
          .gte('error_rate_pct', 60)
          .order('error_rate_pct', { ascending: false })
          .limit(10),
      ])

      if (studentsRes.error) throw new Error(studentsRes.error.message)

      setStudents(studentsRes.data ?? [])
      setAlerts(alertsRes.data ?? [])
      setSummary(summaryRes.data?.[0] ?? null)
      setProblems(problemsRes.data ?? [])
    } catch (err: any) {
      setLoadError(err.message ?? 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  const criticalAlerts = alerts.filter(a => a.priority === 1)
  const currentCourse  = courses.find(c => c.id === selectedCourse)

  // Sin cursos asignados
  if (courses.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">📚</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Sin cursos asignados</h2>
          <p className="text-sm text-gray-500">
            No tenés cursos asignados aún. El director o coordinador debe asignarte un curso.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Selector de curso */}
      {courses.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCourse(c.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedCourse === c.id
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              style={selectedCourse === c.id ? { backgroundColor: '#642f8d' } : {}}
            >
              {c.name}
              {c.cefr_levels && (
                <span className={`ml-2 text-xs cefr-pill cefr-${c.cefr_levels.code}`}>
                  {c.cefr_levels.code}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Error cargando datos del panel</p>
          <p className="text-red-500 text-sm mb-4">{loadError}</p>
          <p className="text-xs text-gray-500">
            Verificá que el SQL de migración 012 fue ejecutado en Supabase.
          </p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 text-sm text-white rounded-xl hover:opacity-90"
            style={{ backgroundColor: '#642f8d' }}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* Alertas críticas — siempre visibles */}
          {criticalAlerts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
              <p className="text-sm font-semibold text-red-800 flex items-center gap-2">
                🚨 {criticalAlerts.length} alerta{criticalAlerts.length !== 1 ? 's' : ''} crítica{criticalAlerts.length !== 1 ? 's' : ''}
              </p>
              {criticalAlerts.map((a, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-red-700">
                  <span className="flex-shrink-0">•</span>
                  <span>
                    <strong>{a.student_name}</strong>: {a.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Métricas del grupo */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Alumnos',       value: summary.total_students,    color: 'text-gray-900' },
                { label: 'Promedio grupo',value: summary.avg_group_score != null ? `${summary.avg_group_score}%` : '—', color: (summary.avg_group_score ?? 0) >= 60 ? 'text-green-600' : 'text-red-600' },
                { label: 'En riesgo',     value: summary.at_risk_students,  color: summary.at_risk_students > 0 ? 'text-amber-600' : 'text-gray-400' },
                { label: 'Críticos',      value: summary.critical_students, color: summary.critical_students > 0 ? 'text-red-600' : 'text-gray-400' },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-2xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                  <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {[
              { key: 'overview',   label: '👥 Alumnos'    },
              { key: 'alerts',     label: `🔔 Alertas ${alerts.length > 0 ? `(${alerts.length})` : ''}` },
              { key: 'questions',  label: `❗ Preguntas problemáticas ${problems.length > 0 ? `(${problems.length})` : ''}` },
              { key: 'recordings', label: '📹 Grabaciones' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === t.key
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Overview alumnos */}
          {activeTab === 'overview' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Alumno</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Estado</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Promedio</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Últimos 3</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Intentos</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Habilidades</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">
                        No hay alumnos en este curso
                      </td>
                    </tr>
                  ) : (
                    students.map(s => {
                      const risk     = RISK_CONFIG[s.risk_status]
                      const isExpand = expandedStudent === s.student_id
                      return (
                        <>
                          <tr
                            key={s.student_id}
                            className={`hover:bg-gray-50 transition-colors ${
                              s.risk_status === 'critical' ? 'bg-red-50/50' :
                              s.risk_status === 'at_risk'  ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${risk.dot}`} />
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {s.first_name} {s.last_name}
                                  </p>
                                  <p className="text-xs text-gray-400">{s.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${risk.color}`}>
                                {risk.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-semibold ${
                                (s.avg_score ?? 0) >= 60 ? 'text-green-700' :
                                (s.avg_score ?? 0) > 0   ? 'text-red-600'   : 'text-gray-400'
                              }`}>
                                {s.avg_score != null ? `${s.avg_score}%` : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-semibold ${
                                (s.avg_score_recent ?? 0) >= 60 ? 'text-green-700' :
                                (s.avg_score_recent ?? 0) > 0   ? 'text-red-600'   : 'text-gray-400'
                              }`}>
                                {s.avg_score_recent != null ? `${s.avg_score_recent}%` : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{s.total_attempts}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setExpandedStudent(isExpand ? null : s.student_id)}
                                className="text-xs text-purple-600 hover:underline"
                              >
                                {isExpand ? 'Ocultar ▲' : 'Ver radar ▼'}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <ReportButton
                                  studentId={s.student_id}
                                  size="sm"
                                />
                                <a
                                  href={`/teacher/students/${s.student_id}`}
                                  className="text-xs font-medium hover:underline"
                                  style={{ color: '#642f8d' }}
                                >
                                  Ver →
                                </a>
                              </div>
                            </td>
                          </tr>
                          {isExpand && (
                            <tr key={`${s.student_id}-radar`}>
                              <td colSpan={7} className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                                <StudentRadarCard
                                  studentId={s.student_id}
                                  studentName={`${s.first_name} ${s.last_name}`}
                                  compact={true}
                                />
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab: Alertas */}
          {activeTab === 'alerts' && (
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="font-medium text-gray-700">Sin alertas activas</p>
                  <p className="text-sm text-gray-400 mt-1">Todos los alumnos están al día</p>
                </div>
              ) : (
                alerts.map((a, i) => {
                  const cfg = ALERT_CONFIG[a.alert_type as keyof typeof ALERT_CONFIG] ?? ALERT_CONFIG.inactive
                  return (
                    <div
                      key={i}
                      className={`rounded-2xl border-l-4 p-4 ${cfg.color}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl flex-shrink-0">{cfg.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              {cfg.label}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              a.priority === 1 ? 'bg-red-100 text-red-700' :
                              a.priority === 2 ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {a.priority === 1 ? 'Crítico' : a.priority === 2 ? 'Alto' : 'Medio'}
                            </span>
                          </div>
                          {a.student_name && (
                            <p className="font-semibold text-gray-900 text-sm">{a.student_name}</p>
                          )}
                          {a.eval_title && (
                            <p className="text-xs text-gray-500 mb-1">📋 {a.eval_title}</p>
                          )}
                          <p className="text-sm text-gray-700">{a.message}</p>
                        </div>
                        {a.metric_value != null && (
                          <span className={`text-xl font-bold flex-shrink-0 ${
                            a.metric_value >= 60 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {Math.round(a.metric_value)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Tab: Preguntas problemáticas */}
          {activeTab === 'questions' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {problems.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="font-medium text-gray-700">Sin preguntas problemáticas</p>
                  <p className="text-sm text-gray-400 mt-1">Todas las preguntas tienen tasa de error aceptable</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Pregunta</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Evaluación</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Skill</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Tasa de error</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Respuestas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {problems.map(p => (
                      <tr key={p.question_id} className={`hover:bg-gray-50 ${
                        p.error_rate_pct >= 80 ? 'bg-red-50/50' :
                        p.error_rate_pct >= 60 ? 'bg-amber-50/30' : ''
                      }`}>
                        <td className="px-4 py-3">
                          <p className="text-gray-800 line-clamp-2">{p.body}</p>
                          {p.topic && (
                            <span className="text-xs text-gray-400 italic">{p.topic}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{p.evaluation_title}</td>
                        <td className="px-4 py-3">
                          {p.skill && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              {p.skill}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold text-base ${
                            p.error_rate_pct >= 80 ? 'text-red-600' :
                            p.error_rate_pct >= 60 ? 'text-amber-600' : 'text-gray-600'
                          }`}>
                            {Math.round(p.error_rate_pct)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{p.total_answers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {/* Tab: Grabaciones */}
          {activeTab === 'recordings' && selectedCourse && (
            <ClassRecordings
              courseId={selectedCourse}
              courseName={currentCourse?.name ?? 'Curso'}
              canUpload={true}
            />
          )}
        </>
      )}
    </main>
  )
}
