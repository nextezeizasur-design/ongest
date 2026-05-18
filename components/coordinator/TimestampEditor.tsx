'use client'

// components/coordinator/TimestampEditor.tsx
// Permite al coordinador/docente asignar timestamps de audio
// a cada pregunta de una evaluación con sección de Listening

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Question {
  id: string
  body: string
  sort_order: number
  audio_start_sec: number | null
  audio_end_sec: number | null
}

interface TimestampEditorProps {
  evaluationId: string
  audioUrl:     string
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TimestampEditor({ evaluationId, audioUrl }: TimestampEditorProps) {
  const supabase = createClient()
  const audioRef = useRef<HTMLAudioElement>(null)

  const [questions, setQuestions]   = useState<Question[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]     = useState(0)
  const [isPlaying, setIsPlaying]   = useState(false)
  const [saving, setSaving]         = useState<string | null>(null)
  const [saved, setSaved]           = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await (supabase as any)
        .from('questions')
        .select('id, body, sort_order, audio_start_sec, audio_end_sec')
        .eq('evaluation_id', evaluationId)
        .order('sort_order')
      setQuestions(data ?? [])
    }
    load()
  }, [evaluationId])

  function handleTimeUpdate() {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
  }

  async function setTimestamp(qId: string, field: 'audio_start_sec' | 'audio_end_sec', value: number | null) {
    setQuestions(prev => prev.map(q =>
      q.id === qId ? { ...q, [field]: value } : q
    ))

    setSaving(qId)
    await (supabase as any)
      .from('questions')
      .update({ [field]: value })
      .eq('id', qId)
    setSaving(null)
    setSaved(qId)
    setTimeout(() => setSaved(null), 2000)
  }

  function jumpTo(sec: number) {
    if (audioRef.current) {
      audioRef.current.currentTime = sec
      setCurrentTime(sec)
    }
  }

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        controls
        className="w-full"
        style={{ height: '40px' }}
      />

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Tiempo actual: <strong className="font-mono">{formatTime(currentTime)}</strong></span>
        <span>Duración: <strong className="font-mono">{formatTime(duration)}</strong></span>
      </div>

      <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
        💡 Reproducí el audio, pausalo en el momento que empieza cada pregunta y hacé click en "Marcar inicio".
        Repetí para el final de cada segmento.
      </p>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold text-white"
                style={{ backgroundColor: '#642f8d' }}>
                {i + 1}
              </span>
              <p className="text-sm text-gray-700 flex-1 line-clamp-2">{q.body}</p>
              {saving === q.id && (
                <span className="text-xs text-gray-400">Guardando…</span>
              )}
              {saved === q.id && (
                <span className="text-xs text-green-600">✓ Guardado</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Inicio */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600">Inicio</label>
                  {q.audio_start_sec !== null && (
                    <button
                      onClick={() => q.audio_start_sec !== null && jumpTo(q.audio_start_sec)}
                      className="text-xs text-purple-600 hover:underline"
                    >
                      ▶ {formatTime(q.audio_start_sec ?? 0)}
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setTimestamp(q.id, 'audio_start_sec', currentTime)}
                    className="flex-1 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors font-medium"
                  >
                    Marcar inicio ({formatTime(currentTime)})
                  </button>
                  {q.audio_start_sec !== null && (
                    <button
                      onClick={() => setTimestamp(q.id, 'audio_start_sec', null)}
                      className="px-2 text-xs text-red-400 hover:text-red-600"
                      title="Quitar"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Fin */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600">Fin</label>
                  {q.audio_end_sec !== null && (
                    <button
                      onClick={() => q.audio_end_sec !== null && jumpTo(q.audio_end_sec)}
                      className="text-xs text-purple-600 hover:underline"
                    >
                      ▶ {formatTime(q.audio_end_sec ?? 0)}
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setTimestamp(q.id, 'audio_end_sec', currentTime)}
                    className="flex-1 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors font-medium"
                  >
                    Marcar fin ({formatTime(currentTime)})
                  </button>
                  {q.audio_end_sec !== null && (
                    <button
                      onClick={() => setTimestamp(q.id, 'audio_end_sec', null)}
                      className="px-2 text-xs text-red-400 hover:text-red-600"
                      title="Quitar"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
