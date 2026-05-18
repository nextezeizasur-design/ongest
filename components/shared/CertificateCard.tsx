'use client'

// components/shared/CertificateCard.tsx

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Certificate {
  id:           string
  eval_title:   string
  score:        number
  passed:       boolean
  cefr_level:   string | null
  issued_by:    string
  verify_hash:  string
  issued_at:    string
  student_name: string
}

interface CertificateCardProps {
  studentId:  string
  attemptId?: string
  orgName?:   string
}

export default function CertificateCard({
  studentId,
  attemptId,
  orgName = 'Next English Institute',
}: CertificateCardProps) {
  const supabase = createClient()

  const [certs,      setCerts]      = useState<Certificate[]>([])
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      let query = (supabase as any)
        .from('certificates')
        .select('*')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('issued_at', { ascending: false })

      if (attemptId) query = query.eq('attempt_id', attemptId)

      const { data } = await query
      setCerts(data ?? [])
      setLoading(false)
    }
    load()
  }, [studentId, attemptId])

  async function handleDownload(cert: Certificate) {
    setGenerating(cert.id)
    try {
      const { generateCertificate } = await import('@/lib/certificate-generator')
      await generateCertificate({
        studentName: cert.student_name,
        evalTitle:   cert.eval_title,
        score:       cert.score,
        passed:      cert.passed,
        cefrLevel:   cert.cefr_level,
        issuedBy:    cert.issued_by,
        orgName,
        verifyHash:  cert.verify_hash,
        issuedAt:    cert.issued_at,
      })
    } catch (err) {
      console.error('Error generando certificado:', err)
    } finally {
      setGenerating(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-6">
      <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (certs.length === 0) return null

  return (
    <div className="space-y-3">
      {certs.map(cert => (
        <div
          key={cert.id}
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: cert.passed ? '#d4b96640' : '#e5e7eb' }}
        >
          {/* Header */}
          <div
            className="px-5 py-3 flex items-center gap-3"
            style={{
              background: cert.passed
                ? 'linear-gradient(135deg, #642f8d 0%, #4e2470 100%)'
                : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
            }}
          >
            <span className="text-2xl">{cert.passed ? '🎓' : '📄'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">
                {cert.passed ? 'Certificado de Aprobación' : 'Constancia de Evaluación'}
              </p>
              <p className="text-white/70 text-xs">{orgName}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {/* Badge aprobado/desaprobado */}
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                cert.passed
                  ? 'bg-green-400/30 text-green-100'
                  : 'bg-red-400/30 text-red-100'
              }`}>
                {cert.passed ? 'Aprobado' : 'Desaprobado'}
              </span>
              {cert.cefr_level && (
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {cert.cefr_level}
                </span>
              )}
            </div>
          </div>

          {/* Contenido */}
          <div className={`px-5 py-4 ${cert.passed ? 'bg-amber-50/30' : 'bg-gray-50'}`}>
            <p className="font-semibold text-gray-900 text-sm">{cert.eval_title}</p>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              <span className="text-xs text-gray-500">
                Puntaje:{' '}
                <strong className={cert.passed ? 'text-green-600' : 'text-red-500'}>
                  {Math.round(cert.score)}%
                </strong>
              </span>
              <span className="text-xs text-gray-500">
                Emitido:{' '}
                {new Date(cert.issued_at).toLocaleDateString('es-AR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                })}
              </span>
            </div>

            {/* Nota aclaratoria si desaprobó */}
            {!cert.passed && (
              <p className="mt-2 text-xs text-gray-400 italic">
                Esta constancia certifica la participación en la evaluación, sin alcanzar el puntaje mínimo de aprobación.
              </p>
            )}

            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button
                onClick={() => handleDownload(cert)}
                disabled={generating === cert.id}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: cert.passed ? '#642f8d' : '#6b7280' }}
              >
                {generating === cert.id ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generando…
                  </>
                ) : (
                  '⬇ Descargar'
                )}
              </button>

              <a
                href={`/verify/${cert.verify_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                🔗 Verificar
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
