// RUTA: app/teacher/speaking/page.tsx
// Historial de grabaciones de speaking de los alumnos del docente (todos los cursos).

export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import SpeakingHistoryClient, { type SpeakingHistoryItem } from '@/components/teacher/SpeakingHistoryClient'

export const metadata = { title: 'Audios de Speaking' }

// Límite de intentos recientes a revisar, para no sobrecargar la función serverless.
const MAX_ATTEMPTS = 300

export default async function TeacherSpeakingPage() {
  const profile  = await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  // 1. Cursos del docente
  const { data: courses } = await sb
    .from('courses')
    .select('id, name')
    .eq('teacher_id', profile.id)
    .eq('is_active', true)
    .order('name')

  const courseList = courses ?? []
  const courseIds  = courseList.map((c: any) => c.id)

  if (courseIds.length === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Audios de Speaking" subtitle="Historial de grabaciones de tus alumnos" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="card text-center py-12 max-w-lg mx-auto">
            <p className="text-3xl mb-2">📚</p>
            <p className="font-medium text-gray-700">Sin cursos asignados</p>
            <p className="text-sm text-gray-400 mt-1">
              El director o coordinación te asignará cursos próximamente.
            </p>
          </div>
        </main>
      </div>
    )
  }

  // 2. Alumnos inscriptos en esos cursos (2-step: fetch IDs first, then filter)
  const { data: enrollments } = await sb
    .from('enrollments')
    .select('course_id, profiles(id, first_name, last_name)')
    .in('course_id', courseIds)

  const courseNameById: Record<string, string> = {}
  for (const c of courseList) courseNameById[c.id] = c.name

  const studentCourseMap: Record<string, { name: string; courseId: string; courseName: string }> = {}
  for (const e of enrollments ?? []) {
    if (!e.profiles) continue
    studentCourseMap[e.profiles.id] = {
      name:       `${e.profiles.first_name} ${e.profiles.last_name}`,
      courseId:   e.course_id,
      courseName: courseNameById[e.course_id] ?? '—',
    }
  }
  const studentIds = Object.keys(studentCourseMap)

  if (studentIds.length === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Audios de Speaking" subtitle="Historial de grabaciones de tus alumnos" />
        <main className="flex-1 overflow-y-auto p-6">
          <SpeakingHistoryClient items={[]} courses={courseList} />
        </main>
      </div>
    )
  }

  // 3. Intentos de esos alumnos (más recientes primero, acotado por MAX_ATTEMPTS)
  const { data: attempts } = await sb
    .from('attempts')
    .select('id, student_id, evaluation_id, submitted_at, evaluations(title)')
    .in('student_id', studentIds)
    .in('status', ['submitted', 'graded', 'timed_out'])
    .order('submitted_at', { ascending: false })
    .limit(MAX_ATTEMPTS)

  const attemptIds = (attempts ?? []).map((a: any) => a.id)
  const attemptById: Record<string, any> = {}
  for (const a of attempts ?? []) attemptById[a.id] = a

  let items: SpeakingHistoryItem[] = []

  if (attemptIds.length > 0) {
    // 4. Respuestas con grabación de audio
    const { data: answers } = await sb
      .from('answers')
      .select('id, attempt_id, question_id, audio_path, manual_score, questions(body, points)')
      .in('attempt_id', attemptIds)
      .not('audio_path', 'is', null)

    const answerAttemptIds = Array.from(new Set((answers ?? []).map((a: any) => a.attempt_id)))

    // 5. Score automático (speaking_responses), 2-step para evitar filtro cruzado
    const { data: speakingResponses } = answerAttemptIds.length > 0
      ? await sb
          .from('speaking_responses')
          .select('attempt_id, question_id, auto_score')
          .in('attempt_id', answerAttemptIds)
      : { data: [] }

    const autoScoreByKey: Record<string, number | null> = {}
    for (const sr of speakingResponses ?? []) {
      autoScoreByKey[`${sr.attempt_id}_${sr.question_id}`] = sr.auto_score
    }

    items = (answers ?? [])
      .map((ans: any) => {
        const attempt = attemptById[ans.attempt_id]
        if (!attempt) return null
        const studentInfo = studentCourseMap[attempt.student_id]
        if (!studentInfo) return null

        return {
          answerId:        ans.id,
          attemptId:       attempt.id,
          studentId:       attempt.student_id,
          studentName:     studentInfo.name,
          courseId:        studentInfo.courseId,
          courseName:      studentInfo.courseName,
          evaluationId:    attempt.evaluation_id,
          evaluationTitle: attempt.evaluations?.title ?? 'Evaluación',
          questionBody:    ans.questions?.body ?? '',
          audioPath:       ans.audio_path,
          submittedAt:     attempt.submitted_at,
          manualScore:     ans.manual_score,
          autoScore:       autoScoreByKey[`${ans.attempt_id}_${ans.question_id}`] ?? null,
          maxPoints:       ans.questions?.points ?? 10,
        } as SpeakingHistoryItem
      })
      .filter((it: SpeakingHistoryItem | null): it is SpeakingHistoryItem => it !== null)
      .sort((a: SpeakingHistoryItem, b: SpeakingHistoryItem) =>
        new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime()
      )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Audios de Speaking"
        subtitle={`${items.length} grabación${items.length !== 1 ? 'es' : ''} de tus alumnos`}
      />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <SpeakingHistoryClient items={items} courses={courseList} />
        </div>
      </main>
    </div>
  )
}
