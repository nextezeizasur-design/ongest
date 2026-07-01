'use client'

// components/director/InstitutionalReportButton.tsx
// Genera el reporte institucional en PDF (100% browser-side, mismo patrón que ReportButton).

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  organizationId: string
}

export default function InstitutionalReportButton({ organizationId }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleGenerate() {
    setLoading(true)
    setError('')

    try {
      const sb = supabase as any

      const [{ data: org }, { data: students }, { data: evals }] = await Promise.all([
        sb.from('organizations').select('name').eq('id', organizationId).single(),
        sb.from('v_student_stats').select('*').eq('organization_id', organizationId),
        sb.from('v_evaluation_stats').select('*').eq('organization_id', organizationId),
      ])

      const allStudents = students ?? []
      const allEvals     = evals ?? []

      // ── KPIs institucionales ──
      const withAttempts = allStudents.filter((s: any) => s.total_attempts > 0)
      const avgScore = withAttempts.length > 0
        ? withAttempts.reduce((a: number, s: any) => a + (s.avg_score ?? 0), 0) / withAttempts.length
        : null

      const totalAttempts = allStudents.reduce((a: number, s: any) => a + (s.total_attempts ?? 0), 0)
      const totalPassed   = allStudents.reduce((a: number, s: any) => a + (s.passed_count ?? 0), 0)
      const passRate = totalAttempts > 0 ? (totalPassed / totalAttempts) * 100 : null

      const atRiskStudents = allStudents
        .filter((s: any) => (s.avg_score ?? 100) < 60 && s.total_attempts > 0)
        .sort((a: any, b: any) => (a.avg_score ?? 0) - (b.avg_score ?? 0))

      // ── Por nivel CEFR ──
      const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
      const byLevel = CEFR.map(code => {
        const group = allStudents.filter((s: any) => s.cefr_code === code && s.total_attempts > 0)
        const avg = group.length > 0
          ? Math.round(group.reduce((a: number, s: any) => a + (s.avg_score ?? 0), 0) / group.length)
          : null
        return { code, count: group.length, avg }
      }).filter(l => l.count > 0)

      // ── Evaluaciones con menor rendimiento ──
      const worstEvals = allEvals
        .filter((e: any) => e.avg_score != null)
        .sort((a: any, b: any) => (a.avg_score ?? 0) - (b.avg_score ?? 0))
        .slice(0, 8)

      const { generateInstitutionalReport } = await import('@/lib/report-generator')

      await generateInstitutionalReport({
        org: { name: org?.name ?? 'Instituto' },
        kpis: {
          total_students: allStudents.length,
          avg_score:      avgScore,
          pass_rate:      passRate,
          at_risk_count:  atRiskStudents.length,
        },
        by_level: byLevel,
        at_risk_students: atRiskStudents.map((s: any) => ({
          first_name:  s.first_name,
          last_name:   s.last_name,
          course_name: s.course_name,
          avg_score:   s.avg_score,
        })),
        worst_evaluations: worstEvals.map((e: any) => ({
          title:           e.title,
          completed_count: e.completed_count,
          avg_score:       e.avg_score,
          cefr_code:       e.cefr_code,
        })),
        generated_at: new Date().toISOString(),
      })

    } catch (err: any) {
      setError(err.message ?? 'Error generando el reporte.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: '#642f8d' }}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Generando PDF…
          </>
        ) : (
          <>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
            Exportar reporte institucional
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
