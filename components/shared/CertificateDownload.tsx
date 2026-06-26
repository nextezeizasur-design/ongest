'use client'
// components/shared/CertificateDownload.tsx
// Genera y descarga el certificado del alumno usando certificate-generator (browser)

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  attemptId:  string
  studentId:  string
  evalTitle:  string
  orgName?:   string
}

export default function CertificateDownload({
  attemptId,
  studentId,
  evalTitle,
  orgName = 'Next English Institute',
}: Props) {
  const supabase  = createClient()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [cert,    setCert]    = useState<any | null>(null)

  // Cargar certificado existente al montar
  useEffect(() => {
    async function load() {
      const { data } = await (supabase as any)
        .from('certificates')
        .select('*')
        .eq('attempt_id', attemptId)
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('issued_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setCert(data)
    }
    load()
  }, [attemptId, studentId])

  async function handleDownload() {
    setLoading(true)
    setError(null)

    try {
      let certData = cert

      // Si no hay certificado en DB, emitirlo primero
      if (!certData) {
        const res  = await fetch('/api/certificates/issue', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ attempt_id: attemptId }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'No se pudo emitir el certificado.')
          return
        }

        // Buscar el certificado recién creado
        const { data: newCert } = await (supabase as any)
          .from('certificates')
          .select('*')
          .eq('attempt_id', attemptId)
          .eq('student_id', studentId)
          .order('issued_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!newCert) {
          setError('No se pudo obtener el certificado. Intentá más tarde.')
          return
        }
        certData = newCert
        setCert(newCert)
      }

      // Generar PDF en el browser con los datos del certificado
      const { generateCertificate } = await import('@/lib/certificate-generator')
      await generateCertificate({
        studentName: certData.student_name,
        evalTitle:   certData.eval_title,
        score:       certData.score,
        passed:      certData.passed,
        cefrLevel:   certData.cefr_level ?? null,
        issuedBy:    certData.issued_by ?? orgName,
        orgName,
        verifyHash:  certData.verify_hash,
        issuedAt:    certData.issued_at,
      })
    } catch (err: any) {
      console.error('Error generando certificado:', err)
      setError('Error al generar el certificado. Intentá más tarde.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl flex-shrink-0">
            🏆
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Certificado de aprobación</p>
            <p className="text-xs text-gray-400">{evalTitle}</p>
          </div>
        </div>
        <button
          onClick={handleDownload}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 hover:opacity-90 transition-opacity flex-shrink-0"
          style={{ backgroundColor: '#642f8d' }}
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generando…
            </>
          ) : (
            '⬇ Descargar'
          )}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  )
}
