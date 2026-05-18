// app/verify/[hash]/page.tsx
// Página pública — no requiere login
// Cualquiera puede verificar la autenticidad de un certificado

import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Verificar certificado' }

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ hash: string }>
}) {
  const { hash } = await params
  const supabase  = await createClient()

  const { data: cert } = await (supabase as any)
    .from('certificates')
    .select('*')
    .eq('verify_hash', hash)
    .eq('is_active', true)
    .maybeSingle()

  const isValid  = !!cert
  const passed   = cert?.passed ?? true   // default true para retrocompatibilidad
  const docTitle = passed ? 'Certificado de Logro' : 'Constancia de Evaluación'
  const headerBg = passed
    ? 'linear-gradient(135deg, #642f8d 0%, #4e2470 100%)'
    : 'linear-gradient(135deg, #4b5563 0%, #374151 100%)'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full overflow-hidden">

        {/* Header */}
        <div
          className="px-8 py-6 text-white text-center"
          style={{ background: isValid ? headerBg : '#dc2626' }}
        >
          <div className="text-4xl mb-2">
            {!isValid ? '❌' : passed ? '✅' : '📄'}
          </div>
          <h1 className="text-xl font-bold">
            {!isValid
              ? 'Certificado No Encontrado'
              : `${docTitle} Válido`
            }
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {!isValid
              ? 'El código no corresponde a ningún certificado activo'
              : passed
                ? 'Este certificado de aprobación es auténtico'
                : 'Esta constancia de participación es auténtica'
            }
          </p>
        </div>

        <div className="p-8">
          {isValid ? (
            <div className="space-y-4">

              {/* Nombre del alumno */}
              <div
                className="border rounded-xl p-4 text-center"
                style={{
                  background: passed ? '#f0fdf4' : '#f9fafb',
                  borderColor: passed ? '#bbf7d0' : '#e5e7eb',
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide mb-1"
                  style={{ color: passed ? '#16a34a' : '#6b7280' }}>
                  {passed ? 'Alumno certificado' : 'Alumno evaluado'}
                </p>
                <p className="text-2xl font-bold"
                  style={{ color: passed ? '#14532d' : '#1f2937' }}>
                  {cert.student_name}
                </p>
              </div>

              {/* Badge aprobado/desaprobado */}
              <div className="flex justify-center">
                <span
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold"
                  style={{
                    background: passed ? '#dcfce7' : '#fee2e2',
                    color:      passed ? '#15803d' : '#dc2626',
                  }}
                >
                  {passed ? '✓ Aprobado' : '✗ No aprobó el mínimo requerido'}
                </span>
              </div>

              {/* Datos del certificado */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Evaluación</p>
                  <p className="text-sm font-medium text-gray-900">{cert.eval_title}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Score obtenido</p>
                  <p className="text-sm font-bold"
                    style={{ color: passed ? '#16a34a' : '#dc2626' }}>
                    {cert.score != null ? `${Math.round(cert.score)}%` : '—'}
                  </p>
                </div>
                {cert.cefr_level && (
                  <div className="rounded-xl p-3" style={{ background: '#f5eefb' }}>
                    <p className="text-xs text-gray-400 mb-1">Nivel CEFR</p>
                    <p className="text-sm font-bold" style={{ color: '#642f8d' }}>
                      {cert.cefr_level}
                    </p>
                  </div>
                )}
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Fecha de emisión</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(cert.issued_at).toLocaleDateString('es-AR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Emitido por */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Emitido por</p>
                <p className="text-sm font-medium text-gray-900">{cert.issued_by}</p>
              </div>

              {/* Nota aclaratoria para desaprobados */}
              {!passed && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-700 leading-relaxed">
                    ⚠️ Esta constancia certifica la participación en la evaluación.
                    El puntaje obtenido no alcanzó el mínimo de aprobación.
                  </p>
                </div>
              )}

              {/* Código de verificación */}
              <div className="border border-gray-200 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Código de verificación</p>
                <p className="font-mono text-xs text-gray-600 break-all">{cert.verify_hash}</p>
              </div>

            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm mb-4">
                No se encontró ningún certificado activo con el código:
              </p>
              <p className="font-mono text-xs bg-gray-100 rounded-lg px-4 py-2 text-gray-700 break-all">
                {hash}
              </p>
              <p className="text-xs text-gray-400 mt-4">
                Si creés que es un error, contactá al instituto.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
