'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ReportButtonProps {
  studentId:    string
  studentName?: string
  size?:        'sm' | 'md'
}

export default function ReportButton({ studentId, studentName, size = 'md' }: ReportButtonProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleGenerate() {
    setLoading(true)
    setError('')

    try {
      const sb = supabase as any

      // ── 1. Cargar datos del alumno ──
      const { data: profile } = await sb
        .from('profiles')
        .select(`
          id, first_name, last_name, email,
          organizations(name),
          enrollments(
            courses(name, cefr_levels(code))
          )
        `)
        .eq('id', studentId)
        .single()

      if (!profile) throw new Error('No se encontró el perfil del alumno.')

      const course   = profile.enrollments?.[0]?.courses
      const orgName  = profile.organizations?.name ?? 'Next English Institute'

      // ── 2. Cargar intentos ──
      const { data: attempts } = await sb
        .from('attempts')
        .select('score, passed, submitted_at, evaluations(title, pass_score)')
        .eq('student_id', studentId)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(20)

      // ── 3. Cargar radar de habilidades ──
      const { data: skillsRaw } = await sb.rpc('get_student_radar', {
        p_student_id: studentId,
      })

      // ── 4. Cargar recomendaciones activas ──
      const { data: recsRaw } = await sb
        .from('v_student_active_recommendations')
        .select('title, body, skill')
        .eq('student_id', studentId)
        .limit(4)

      // ── 5. Importar jsPDF dinámicamente ──
      const { generateStudentReport } = await import('@/lib/report-generator')

      // ── 6. Generar PDF ──
      await generateStudentReport({
        student: {
          first_name:  profile.first_name,
          last_name:   profile.last_name,
          email:       profile.email,
          course_name: course?.name ?? 'Sin curso asignado',
          cefr_code:   course?.cefr_levels?.code ?? null,
        },
        org: { name: orgName },
        attempts: (attempts ?? []).map((a: any) => ({
          evaluation_title: a.evaluations?.title ?? 'Evaluación',
          score:            a.score,
          passed:           a.passed,
          submitted_at:     a.submitted_at,
          pass_score:       a.evaluations?.pass_score ?? 60,
        })),
        skills: (skillsRaw ?? []).map((s: any) => ({
          skill:     s.skill,
          label:     s.label,
          score_pct: s.score_pct,
        })),
        recommendations: (recsRaw ?? []).map((r: any) => ({
          title: r.title,
          body:  r.body,
          skill: r.skill,
        })),
        generated_at: new Date().toISOString(),
      })

    } catch (err: any) {
      setError(err.message ?? 'Error generando el reporte.')
    } finally {
      setLoading(false)
    }
  }

  const isSmall = size === 'sm'

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className={`inline-flex items-center gap-2 font-medium rounded-xl border transition-all hover:opacity-90 disabled:opacity-50 ${
          isSmall
            ? 'px-3 py-1.5 text-xs border-gray-300 text-gray-600 hover:bg-gray-50'
            : 'px-4 py-2.5 text-sm border-gray-200 text-white'
        }`}
        style={!isSmall ? { backgroundColor: '#642f8d' } : {}}
      >
        {loading ? (
          <>
            <span className={`border-2 border-t-transparent rounded-full animate-spin ${
              isSmall ? 'w-3 h-3 border-gray-500' : 'w-4 h-4 border-white'
            }`} />
            Generando PDF…
          </>
        ) : (
          <>
            <svg viewBox="0 0 20 20" fill="currentColor" className={isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'}>
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
            {isSmall ? 'PDF' : `Descargar reporte${studentName ? ` de ${studentName}` : ''}`}
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
