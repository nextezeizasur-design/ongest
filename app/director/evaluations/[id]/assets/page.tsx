// app/director/evaluations/[id]/assets/page.tsx
import EvaluationAssetsPage from '@/components/shared/EvaluationAssetsPage'

export default function DirectorAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  return <EvaluationAssetsPage params={params} backHref="/director/evaluations" />
}
