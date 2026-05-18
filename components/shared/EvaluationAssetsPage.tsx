'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ExamAssetUploader from '@/components/shared/ExamAssetUploader'
import TimestampEditor from '@/components/coordinator/TimestampEditor'

interface Evaluation {
  id: string
  title: string
  status: string
  cefr_level_id: number | null
}

interface AssetsPageProps {
  params: Promise<{ id: string }>
  backHref: string
}

export default function EvaluationAssetsPage({ params, backHref }: AssetsPageProps) {
  const { id: evaluationId } = use(params)
  const router   = useRouter()
  const supabase = createClient()

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [loading, setLoading]       = useState(true)
  const [audioUrl, setAudioUrl]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: evalData }, { data: assetData }] = await Promise.all([
        supabase
          .from('evaluations')
          .select('id, title, status, cefr_level_id')
          .eq('id', evaluationId)
          .single(),
        (supabase as any)
          .from('exam_assets')
          .select('audio_url')
          .eq('evaluation_id', evaluationId)
          .maybeSingle(),
      ])
      setEvaluation(evalData)
      setAudioUrl(assetData?.audio_url ?? null)
      setLoading(false)
    }
    load()
  }, [evaluationId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Evaluación no encontrada.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push(backHref)}
          className="text-gray-400 hover:text-gray-600 transition-colors mt-1"
        >
          ←
        </button>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
            Archivos del examen
          </p>
          <h1 className="text-xl font-bold text-gray-900">{evaluation.title}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${
            evaluation.status === 'published'
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {evaluation.status === 'published' ? 'Publicado' : 'Borrador'}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800 font-medium mb-1">¿Cómo funciona?</p>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Subí el PDF del examen impreso para que los alumnos lo lean.</li>
          <li>Subí el audio MP3 para las secciones de Listening.</li>
          <li>Los alumnos verán el PDF embebido y podrán reproducir el audio.</li>
          <li>Podrán escribir sus respuestas directamente en la plataforma.</li>
        </ul>
      </div>

      {/* Uploader */}
      <ExamAssetUploader
        evaluationId={evaluationId}
        onSaved={(asset) => {
          if (asset.audio_url) setAudioUrl(asset.audio_url)
        }}
      />

      {/* Timestamps por pregunta — solo si hay audio cargado */}
      {audioUrl && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Sincronización de audio</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Marcá en qué segundo del audio corresponde cada pregunta.
              Los alumnos podrán reproducir el fragmento exacto mientras responden.
            </p>
          </div>
          <div className="p-5">
            <TimestampEditor
              evaluationId={evaluationId}
              audioUrl={audioUrl}
            />
          </div>
        </div>
      )}

      {/* Volver */}
      <button
        onClick={() => router.push(backHref)}
        className="w-full py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
      >
        ← Volver a la evaluación
      </button>
    </div>
  )
}
