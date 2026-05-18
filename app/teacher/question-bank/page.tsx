// app/teacher/question-bank/page.tsx
import { requireRole } from '@/lib/auth'
import TopBar from '@/components/layout/TopBar'
import QuestionBankPage from '@/components/shared/QuestionBankPage'

export const metadata = { title: 'Banco de preguntas' }

export default async function TeacherQuestionBank() {
  await requireRole(['director', 'coordinator', 'teacher'] as any)
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Banco de preguntas" subtitle="Buscá y reutilizá preguntas existentes" />
      <main className="flex-1 overflow-y-auto p-6">
        <QuestionBankPage />
      </main>
    </div>
  )
}
