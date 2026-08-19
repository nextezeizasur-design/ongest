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
      // Importante: avg_score viene de v_student_stats calculado SOLO con
      // intentos 'graded' (regla unificada con Dashboard/Reportes). Un
      // alumno con exámenes entregados pero aún sin corregir tiene
      // total_attempts > 0 pero avg_score = null — no cuenta como un 0,
      // simplemente todavía no tiene nota. Por eso filtramos por
      // avg_score != null (alumnos con al menos una corrección real) en
      // vez de por total_attempts > 0 (que incluye pendientes).
      const withGradedAttempts = allStudents.filter((s: any) => s.avg_score != null)
      const avgScore = withGradedAttempts.length > 0
        ? withGradedAttempts.reduce((a: number, s: any) => a + s.avg_score, 0) / withGradedAttempts.length
        : null

      // Tasa de aprobación: numerador y denominador en la misma base
      // (ambos ya vienen de v_student_stats calculados solo sobre 'graded').
      const totalGraded = allStudents.reduce((a: number, s: any) => a + (s.passed_count ?? 0) + (s.failed_count ?? 0), 0)
      const totalPassed = allStudents.reduce((a: number, s: any) => a + (s.passed_count ?? 0), 0)
      const passRate = totalGraded > 0 ? (totalPassed / totalGraded) * 100 : null

      const atRiskStudents = allStudents
        .filter((s: any) => (s.avg_score ?? 100) < 60 && s.total_attempts > 0)
        .sort((a: any, b: any) => (a.avg_score ?? 0) - (b.avg_score ?? 0))

      // ── Por nivel CEFR ──
      // Mismo criterio: solo alumnos con al menos una corrección real.
      const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
      const byLevel = CEFR.map(code => {
        const group = allStudents.filter((s: any) => s.cefr_code === code && s.avg_score != null)
        const avg = group.length > 0
          ? Math.round(group.reduce((a: number, s: any) => a + s.avg_score, 0) / group.length)
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
