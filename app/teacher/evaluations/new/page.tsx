// app/teacher/evaluations/new/page.tsx
// Reutiliza el componente del coordinator con redirect al dashboard del docente

import NewEvaluationPage from '@/app/coordinator/evaluations/new/page'

export default function TeacherNewEvaluationPage() {
  return <NewEvaluationPage redirectTo="/teacher/evaluations" />
}
