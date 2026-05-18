// app/teacher/evaluations/[id]/assets/page.tsx
import EvaluationAssetsPage from '@/components/shared/EvaluationAssetsPage'

export default function TeacherAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  return <EvaluationAssetsPage params={params} backHref="/teacher/evaluations" />
}
