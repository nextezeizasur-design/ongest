'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdvancedAudioPlayer from '@/components/shared/AdvancedAudioPlayer'

interface ExamAsset {
  pdf_url: string | null
  audio_url: string | null
  pdf_filename: string | null
  audio_filename: string | null
}

interface QuestionWithTimestamp {
  id: string
  sort_order: number
  audio_start_sec: number | null
  audio_end_sec: number | null
}

interface ExamAssetViewerProps {
  evaluationId:      string
  attemptId?:        string
  studentId?:        string
  activeQuestionId?: string
  maxAudioPlays?:    number | null
  audioSpeedLocked?: boolean
  onAnswerChange?:   (key: string, val: string) => void
}

export default function ExamAssetViewer({
  evaluationId,
  attemptId,
  studentId,
  activeQuestionId,
  maxAudioPlays    = null,
  audioSpeedLocked = false,
  onAnswerChange,
}: ExamAssetViewerProps) {
  const supabase = createClient()

  const [asset, setAsset]         = useState<ExamAsset | null>(null)
  const [questions, setQuestions] = useState<QuestionWithTimestamp[]>([])
  const [loading, setLoading]     = useState(true)
  const [pdfView, setPdfView]     = useState<'embed' | 'link'>('embed')
  const [answers, setAnswers]     = useState<Record<string, string>>({})
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: assetData }, { data: qData }] = await Promise.all([
        (supabase as any)
          .from('exam_assets')
          .select('pdf_url, audio_url, pdf_filename, audio_filename')
          .eq('evaluation_id', evaluationId)
          .maybeSingle(),
        (supabase as any)
          .from('questions')
          .select('id, sort_order, audio_start_sec, audio_end_sec')
          .eq('evaluation_id', evaluationId)
          .order('sort_order'),
      ])
      setAsset(assetData)
      setQuestions(qData ?? [])
      setLoading(false)
    }
    load()
  }, [evaluationId])

  useEffect(() => {
    if (!attemptId || Object.keys(answers).length === 0) return
    const t = setTimeout(saveAnswers, 1500)
    return () => clearTimeout(t)
  }, [answers])

  async function saveAnswers() {
    if (!attemptId) return
    setSaving(true)
    for (const [key, val] of Object.entries(answers)) {
      if (!val.trim()) continue
      await (supabase as any).from('answers').upsert(
        { attempt_id: attemptId, question_id: key, text_answer: val, option_id: null },
        { onConflict: 'attempt_id,question_id' }
      )
    }
    setSaving(false)
    setSaveMsg('Guardado ✓')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  function handleAnswer(key: string, val: string) {
    setAnswers(prev => ({ ...prev, [key]: val }))
    onAnswerChange?.(key, val)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!asset || (!asset.pdf_url && !asset.audio_url)) return null

  const timestamps = questions
    .filter(q => q.audio_start_sec !== null)
    .map((q, i) => ({
      questionId: q.id,
      startSec:   q.audio_start_sec!,
      endSec:     q.audio_end_sec,
      label:      `P${i + 1}`,
    }))

  return (
    <div className="space-y-4">

      {asset.audio_url && (
        <AdvancedAudioPlayer
          audioUrl={asset.audio_url}
          attemptId={attemptId}
          evaluationId={evaluationId}
          studentId={studentId}
          timestamps={timestamps}
          activeQuestionId={activeQuestionId}
          maxPlays={maxAudioPlays}
          speedLocked={audioSpeedLocked}
          examMode={true}
        />
      )}

      {asset.pdf_url && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-lg">📄</span>
              <span className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
                {asset.pdf_filename ?? 'examen.pdf'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPdfView(v => v === 'embed' ? 'link' : 'embed')}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {pdfView === 'embed' ? '↗ Nueva pestaña' : '← Ver aquí'}
              </button>
              <a href={asset.pdf_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors">
                ⬇ Descargar
              </a>
            </div>
          </div>
          {pdfView === 'embed' ? (
            <div style={{ height: '600px' }}>
              <iframe
                src={`${asset.pdf_url}#toolbar=1&navpanes=0`}
                className="w-full h-full border-0"
                title="Examen PDF"
              />
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="text-5xl mb-4">📋</div>
              <a href={asset.pdf_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-white rounded-xl hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#642f8d' }}>
                Abrir PDF ↗
              </a>
            </div>
          )}
        </div>
      )}

      {asset.pdf_url && attemptId && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Tus respuestas</h3>
            {saving && <span className="text-xs text-gray-400">Guardando…</span>}
            {saveMsg && <span className="text-xs text-green-600">{saveMsg}</span>}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
              <div key={num} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-1">
                  {num}
                </span>
                <input
                  type="text"
                  value={answers[`raw_answer_${num}`] ?? ''}
                  onChange={e => handleAnswer(`raw_answer_${num}`, e.target.value)}
                  placeholder={`Respuesta ${num}…`}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400 transition-colors"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
