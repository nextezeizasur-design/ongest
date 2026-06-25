// app/exam/results/[attemptId]/page.tsx
// Issue 5: Alumno puede ver corrección y feedback del docente

export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import Badge from '@/components/ui/Badge'
import CertificateDownload from '@/components/shared/CertificateDownload'

export default async function StudentResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>
}) {
  const { attemptId } = await params
  const profile  = await requireRole('student')
  const supabase = await createClient()
  const sb       = supabase as any

  // Cargar intento con evaluación
  const { data: attempt } = await sb
    .from('attempts')
    .select(`
      id, score, passed, status, submitted_at,
      evaluations ( id, title, pass_score, description )
    `)
    .eq('id', attemptId)
    .eq('student_id', profile.id)
    .single()

  if (!attempt) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-400">Resultado no encontrado.</p>
      </div>
    )
  }

  // Cargar respuestas con preguntas, opciones y feedback del docente
  const { data: answers } = await sb
    .from('answers')
    .select(`
      id,
      question_id,
      option_id,
      text_answer,
      manual_score,
      feedback_text,
      grader_note,
      is_correct,
      points_earned,
      questions (
        id, body, q_type, points, sort_order,
        options ( id, body, is_correct )
      )
    `)
    .eq('attempt_id', attemptId)
    .order('questions(sort_order)', { ascending: true })

  const eval_ = attempt.evaluations
  const score = attempt.score ?? 0
  const passed = attempt.passed ?? false

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Resultado del examen"
        subtitle={eval_?.title ?? ''}
        actions={
          <a href="/exam" className="btn-outline text-sm">← Mis evaluaciones</a>
        }
      />

      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 max-w-3xl mx-auto w-full">

        {/* Score card */}
        <div className="card text-center">
          <div className={`text-6xl font-bold mb-2 ${passed ? 'text-green-600' : 'text-red-500'}`}>
            {Math.round(score)}%
          </div>
          <div className="flex justify-center mb-3">
            <Badge variant={passed ? 'green' : 'red'}>
              {passed ? '✅ Aprobado' : '❌ No aprobado'}
            </Badge>
          </div>
          {eval_?.pass_score && (
            <p className="text-xs text-gray-400">Puntaje mínimo: {eval_.pass_score}%</p>
          )}
          {attempt.status === 'submitted' && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <p className="text-sm text-amber-800">
                ⏳ Algunas respuestas están pendientes de corrección por el docente.
                El puntaje puede cambiar.
              </p>
            </div>
          )}
        </div>

        {/* Certificado si aprobó */}
        {passed && (
          <CertificateDownload
            attemptId={attemptId}
            studentId={profile.id}
            evalTitle={eval_?.title ?? ''}
          />
        )}

        {/* Detalle de respuestas */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Detalle de respuestas</h2>
          </div>

          <div className="divide-y divide-gray-100">
            {(answers ?? [])
              .sort((a: any, b: any) =>
                (a.questions?.sort_order ?? 0) - (b.questions?.sort_order ?? 0)
              )
              .map((ans: any, idx: number) => {
                const q = ans.questions
                if (!q) return null

                const isMC = q.q_type === 'multiple_choice' || q.q_type === 'true_false'
                const isOpen = ['short_answer', 'essay', 'speaking'].includes(q.q_type)

                // Para MC: encontrar la opción seleccionada y la correcta
                const selectedOption = isMC
                  ? (q.options ?? []).find((o: any) => o.id === ans.option_id)
                  : null
                const correctOption = isMC
                  ? (q.options ?? []).find((o: any) => o.is_correct === true)
                  : null
                const isCorrect = isMC && selectedOption?.is_correct === true

                return (
                  <div key={ans.id} className="p-5">
                    {/* Encabezado pregunta */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <span className="text-xs text-gray-400">Pregunta {idx + 1}</span>
                        <p className="text-sm font-medium text-gray-900 mt-0.5">{q.body}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {isMC && (
                          <Badge variant={isCorrect ? 'green' : 'red'}>
                            {isCorrect ? 'Correcta' : 'Incorrecta'}
                          </Badge>
                        )}
                        {isOpen && ans.manual_score !== null && ans.manual_score !== undefined && (
                          <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                            {ans.manual_score} / {q.points} pts
                          </span>
                        )}
                        {isOpen && ans.manual_score === null && ans.manual_score === undefined && !ans.grader_note && !(ans.points_earned > 0) && (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                            Pendiente
                          </span>
                        )}
                        {isOpen && !['speaking'].includes(q.q_type) && (ans.grader_note || ans.points_earned > 0) && (
                          <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                            {ans.points_earned ?? 0} / {q.points} pts
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Respuesta del alumno */}
                    {isMC && (
                      <div className="space-y-1.5">
                        {(q.options ?? []).map((opt: any) => {
                          const isSelected = opt.id === ans.option_id
                          const isRight    = opt.is_correct === true
                          let style = 'border-gray-200 bg-gray-50 text-gray-600'
                          if (isSelected && isRight)  style = 'border-green-400 bg-green-50 text-green-800'
                          if (isSelected && !isRight) style = 'border-red-400 bg-red-50 text-red-800'
                          if (!isSelected && isRight) style = 'border-green-300 bg-green-50 text-green-700'

                          return (
                            <div key={opt.id}
                              className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${style}`}>
                              <span>
                                {isSelected && isRight  && '✅ '}
                                {isSelected && !isRight && '❌ '}
                                {!isSelected && isRight && '✔ '}
                              </span>
                              {opt.body}
                              {isSelected && <span className="ml-auto text-xs opacity-70">Tu respuesta</span>}
                              {!isSelected && isRight && <span className="ml-auto text-xs opacity-70">Respuesta correcta</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Respuesta abierta */}
                    {isOpen && (
                      <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700">
                        {ans.text_answer
                          ? <p className="whitespace-pre-line">{ans.text_answer}</p>
                          : <p className="text-gray-400 italic">Sin respuesta</p>
                        }
                      </div>
                    )}

                    {/* Comentario del docente — grader_note (short/essay) o feedback_text (speaking) */}
                    {(ans.grader_note || ans.feedback_text) && (
                      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                        <p className="text-xs font-semibold text-blue-700 mb-1">
                          💬 Comentario del docente
                        </p>
                        <p className="text-sm text-blue-900 whitespace-pre-line">
                          {ans.grader_note || ans.feedback_text}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>

      </main>
    </div>
  )
}
