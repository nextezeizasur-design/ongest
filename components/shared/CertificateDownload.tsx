'use client'
// components/shared/CertificateDownload.tsx
// Issue 6: Botón de descarga de certificados para alumnos

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  attemptId:  string
  studentId:  string
  evalTitle:  string
}

export default function CertificateDownload({ attemptId, studentId, evalTitle }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [certUrl, setCertUrl] = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  async function fetchCertificate() {
    setLoading(true)
    setError(null)

    try {
      const sb = supabase as any

      // Buscar certificado en DB
      const { data: cert } = await sb
        .from('certificates')
        .select('id, file_path, issued_at')
        .eq('attempt_id', attemptId)
        .eq('student_id', studentId)
        .maybeSingle()

      if (!cert?.file_path) {
        // Solicitar emisión si no existe
        const res = await fetch('/api/certificates/issue', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ attempt_id: attemptId }),
        })
        const data = await res.json()
        if (data.file_path) {
          await downloadFromStorage(data.file_path)
        } else {
          setError('No se pudo generar el certificado. Intentá más tarde.')
        }
        return
      }

      await downloadFromStorage(cert.file_path)
    } catch (err) {
      setError('Error al obtener el certificado.')
    } finally {
      setLoading(false)
    }
  }

  async function downloadFromStorage(filePath: string) {
    const sb = supabase as any

    // Generar URL firmada (válida por 60 segundos)
    const { data: signed, error: signErr } = await sb
      .storage
      .from('certificates')
      .createSignedUrl(filePath, 60)

    if (signErr || !signed?.signedUrl) {
      // Si no hay bucket de storage, usar URL pública directa
      const { data: publicData } = sb
        .storage
        .from('certificates')
        .getPublicUrl(filePath)

      if (publicData?.publicUrl) {
        triggerDownload(publicData.publicUrl)
      } else {
        setError('No se pudo generar el enlace de descarga.')
      }
      return
    }

    setCertUrl(signed.signedUrl)
    triggerDownload(signed.signedUrl)
  }

  function triggerDownload(url: string) {
    const a = document.createElement('a')
    a.href     = url
    a.download = `certificado-${evalTitle.replace(/\s+/g, '-').toLowerCase()}.pdf`
    a.target   = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
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

        <div className="flex gap-2 flex-shrink-0">
          {certUrl && (
            <a
              href={certUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Ver →
            </a>
          )}
          <button
            onClick={fetchCertificate}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#642f8d' }}
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generando…
              </>
            ) : (
              <>
                ⬇ Descargar
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  )
}
