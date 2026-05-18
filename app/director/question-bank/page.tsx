// app/director/question-bank/page.tsx
import { requireRole } from '@/lib/auth'
import TopBar from '@/components/layout/TopBar'
import QuestionBankPage from '@/components/shared/QuestionBankPage'

export const metadata = { title: 'Banco de preguntas' }

export default async function DirectorQuestionBank() {
  await requireRole('director')
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Banco de preguntas" subtitle="Preguntas reutilizables de la organización" />
      <main className="flex-1 overflow-y-auto p-6">
        <QuestionBankPage />
      </main>
    </div>
  )
}
