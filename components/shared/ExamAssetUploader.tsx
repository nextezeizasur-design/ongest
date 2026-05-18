'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ExamAsset {
  id: string
  pdf_url: string | null
  audio_url: string | null
  pdf_filename: string | null
  audio_filename: string | null
  type: 'raw' | 'structured'
}

interface ExamAssetUploaderProps {
  evaluationId: string
  onSaved?: (asset: ExamAsset) => void
}

export default function ExamAssetUploader({ evaluationId, onSaved }: ExamAssetUploaderProps) {
  const supabase = createClient()

  const [existing, setExisting]   = useState<ExamAsset | null>(null)
  const [pdfFile, setPdfFile]     = useState<File | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState('')
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)

  const pdfRef   = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)

  // Cargar asset existente
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('exam_assets')
        .select('*')
        .eq('evaluation_id', evaluationId)
        .maybeSingle()
      if (data) setExisting(data)
    }
    load()
  }, [evaluationId])

  async function handleUpload() {
    if (!pdfFile && !audioFile) return
    setError('')
    setSuccess(false)
    setUploading(true)

    try {
      const fd = new FormData()
      fd.append('evaluation_id', evaluationId)
      if (pdfFile)   fd.append('pdf',   pdfFile)
      if (audioFile) fd.append('audio', audioFile)

      setProgress(pdfFile && audioFile ? 'Subiendo PDF y audio…' : pdfFile ? 'Subiendo PDF…' : 'Subiendo audio…')

      const res  = await fetch('/api/evaluations/upload-assets', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Error al subir archivos.')
        return
      }

      setExisting(json.asset)
      setPdfFile(null)
      setAudioFile(null)
      setSuccess(true)
      onSaved?.(json.asset)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message ?? 'Error de red.')
    } finally {
      setUploading(false)
      setProgress('')
    }
  }

  const hasChanges = !!pdfFile || !!audioFile

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Archivos del examen</h3>
          <p className="text-xs text-gray-400 mt-0.5">PDF y audio para los alumnos</p>
        </div>
        {existing && (
          <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
            ✓ Archivos cargados
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">

        {/* ── PDF ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📄 Examen PDF
          </label>

          {existing?.pdf_url && !pdfFile && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 mb-2">
              <span className="text-2xl">📋</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {existing.pdf_filename ?? 'exam.pdf'}
                </p>
                <p className="text-xs text-gray-400">Actualmente cargado</p>
              </div>
              <a
                href={existing.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-600 hover:underline whitespace-nowrap"
              >
                Ver PDF →
              </a>
            </div>
          )}

          <div
            onClick={() => pdfRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
              pdfFile
                ? 'border-purple-400 bg-purple-50'
                : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
            }`}
          >
            {pdfFile ? (
              <div>
                <p className="font-medium text-purple-700 text-sm">{pdfFile.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{(pdfFile.size / 1024).toFixed(0)} KB · listo para subir</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">
                  {existing?.pdf_url ? 'Reemplazar PDF' : 'Subir PDF'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Máx. 20MB</p>
              </div>
            )}
            <input
              ref={pdfRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {pdfFile && (
            <button onClick={() => setPdfFile(null)} className="text-xs text-red-400 hover:text-red-600 mt-1">
              Quitar
            </button>
          )}
        </div>

        {/* ── Audio ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            🎧 Audio de Listening
          </label>

          {existing?.audio_url && !audioFile && (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 mb-2">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🎵</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {existing.audio_filename ?? 'audio.mp3'}
                  </p>
                  <p className="text-xs text-gray-400">Actualmente cargado</p>
                </div>
              </div>
              <audio controls className="w-full h-10" src={existing.audio_url}>
                Tu navegador no soporta audio HTML5.
              </audio>
            </div>
          )}

          <div
            onClick={() => audioRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
              audioFile
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            {audioFile ? (
              <div>
                <p className="font-medium text-blue-700 text-sm">{audioFile.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{(audioFile.size / 1024).toFixed(0)} KB · listo para subir</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">
                  {existing?.audio_url ? 'Reemplazar audio' : 'Subir audio'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">MP3, WAV, OGG · Máx. 50MB</p>
              </div>
            )}
            <input
              ref={audioRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a"
              className="hidden"
              onChange={e => setAudioFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {audioFile && (
            <button onClick={() => setAudioFile(null)} className="text-xs text-red-400 hover:text-red-600 mt-1">
              Quitar
            </button>
          )}
        </div>

        {/* ── Feedback ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
            ✅ Archivos guardados correctamente
          </div>
        )}

        {/* ── Botón subir ── */}
        <button
          onClick={handleUpload}
          disabled={!hasChanges || uploading}
          className="w-full py-2.5 text-sm text-white font-semibold rounded-xl transition-all disabled:opacity-40 hover:opacity-90"
          style={{ backgroundColor: '#642f8d' }}
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {progress}
            </span>
          ) : (
            `⬆️ Guardar archivos`
          )}
        </button>
      </div>
    </div>
  )
}
