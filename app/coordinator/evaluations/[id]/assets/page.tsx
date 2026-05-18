// ─────────────────────────────────────────────────────────────
// app/coordinator/evaluations/[id]/assets/page.tsx
// ─────────────────────────────────────────────────────────────
import EvaluationAssetsPage from '@/components/shared/EvaluationAssetsPage'

export default function CoordinatorAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <EvaluationAssetsPage
      params={params}
      backHref="/coordinator/evaluations"
    />
  )
}
