'use client'

// components/coordinator/ImportUploadClient.tsx
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ImportReviewClient from '@/components/coordinator/ImportReviewClient'

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const PUBLISHERS  = [
  'Macmillan Language Hub',
  'Next English Institute',
  'Oxford Solutions',
  'Cambridge Prepare',
  'Otro',
]

const SKILL_COLOR: Record<string, string> = {
  grammar: '#642f8d', vocabulary: '#0f6e56', reading: '#185fa5',
  writing: '#854f0b', listening: '#993556',
}

interface Props {
  orgId:    string
  backHref: string
}

export default function ImportUploadClient({ orgId, backHref }: Props) {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [file,         setFile]         = useState<File | null>(null)
  const [cefrLevel,    setCefrLevel]    = useState('')
  const [publisher,    setPublisher]    = useState('Macmillan Language Hub')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [questions,    setQuestions]    = useState<any[] | null>(null)
  const [typeSummary,  setTypeSummary]  = useState<Record<string, number>>({})
  const [skillSummary, setSkillSummary] = useState<Record<string, number>>({})

  async function handleUpload() {
    if (!file) { setError('Seleccioná un archivo PDF.'); return }
    setLoading(true)
    setError(null)

    const form = new FormData()
    form.append('file',       file)
    form.append('cefr_level', cefrLevel)
    form.append('publisher',  publisher)

    try {
      const res  = await fetch('/api/evaluations/import', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error procesando el PDF.')
        return
      }

      setQuestions(data.questions ?? [])
      setTypeSummary(data.type_summary ?? {})
      setSkillSummary(data.skill_summary ?? {})
    } catch (err: any) {
      setError(err.message ?? 'Error de red.')
    } finally {
      setLoading(false)
    }
  }

  // ── Paso 2: Revisión ──
  if (questions !== null) {
    return (
      <div className="space-y-4">
        {/* Resumen */}
        {Object.keys(skillSummary).length > 0 && (
          <div className="card">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              Resumen de detección
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(skillSummary).map(([skill, cnt]) => (
                <span
                  key={skill}
                  className="text-xs px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: SKILL_COLOR[skill] ?? '#642f8d' }}
                >
                  {skill} ({cnt})
                </span>
              ))}
              {Object.entries(typeSummary).map(([type, cnt]) => (
                <span key={type} className="badge badge-gray text-xs">
                  {type.replace(/_/g, ' ')} ({cnt})
                </span>
              ))}
            </div>
          </div>
        )}

        <ImportReviewClient
          initialQuestions={questions}
          orgId={orgId}
          cefrLevel={cefrLevel || null}
          publisher={publisher}
          onComplete={() => router.push(backHref)}
        />

        <button
          onClick={() => setQuestions(null)}
          className="btn-outline w-full text-sm"
        >
          ← Volver a subir otro PDF
        </button>
      </div>
    )
  }

  // ── Paso 1: Upload ──
  return (
    <div className="space-y-4">

      {/* Zona de drop */}
      <div
        className={`card border-2 border-dashed cursor-pointer transition-colors ${
          file ? 'border-purple-300 bg-purple-50/30' : 'border-gray-200 hover:border-purple-300'
        }`}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) { setFile(f); setError(null) }
          }}
        />
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          {file ? (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: '#f5eefb' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#642f8d" strokeWidth={1.5} className="h-6 w-6">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <path d="M14 2v6h6M9 13h6M9 17h4"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(file.size / 1024).toFixed(0)} KB · Hacé clic para cambiar
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.5} className="h-6 w-6">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Subir PDF</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Macmillan, Oxford, Cambridge, Next English · Máx. 10MB
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Opciones */}
      <div className="card space-y-4">
        <div>
          <label className="label">Editorial / Fuente</label>
          <select value={publisher} onChange={e => setPublisher(e.target.value)} className="input">
            {PUBLISHERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Nivel CEFR (opcional)</label>
          <div className="flex gap-2 flex-wrap mt-1">
            <button
              onClick={() => setCefrLevel('')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                cefrLevel === ''
                  ? 'bg-gray-800 text-white border-transparent'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              Sin nivel
            </button>
            {CEFR_LEVELS.map(l => (
              <button
                key={l}
                onClick={() => setCefrLevel(l)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  cefrLevel === l
                    ? 'text-white border-transparent'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
                style={cefrLevel === l ? { backgroundColor: '#642f8d' } : {}}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tip */}
      <div className="rounded-xl bg-purple-50 border border-purple-100 px-4 py-3 text-xs text-purple-800 space-y-1">
        <p className="font-medium">💡 Para mejores resultados</p>
        <p>El PDF debe tener texto seleccionable (no escaneado). Los ejercicios con secciones A/B/C y ítems numerados 1–10 se detectan automáticamente.</p>
        <p>Las respuestas correctas <strong>no</strong> se detectan — vas a poder marcarlas en el paso siguiente.</p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          ⚠ {error}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="btn-brand w-full py-3 text-sm disabled:opacity-40"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Procesando PDF…
          </span>
        ) : (
          'Procesar PDF →'
        )}
      </button>
    </div>
  )
}
