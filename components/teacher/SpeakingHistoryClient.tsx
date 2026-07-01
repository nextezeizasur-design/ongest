'use client'

// components/teacher/SpeakingHistoryClient.tsx
// Historial de grabaciones de speaking de todos los cursos del docente.
// El audio se firma (signed URL) recién al hacer clic en "Reproducir",
// para no golpear Storage con cientos de requests al cargar la página.

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface SpeakingHistoryItem {
  answerId:      string
  attemptId:     string
  studentId:     string
  studentName:   string
  courseId:      string
  courseName:    string
  evaluationId:  string
  evaluationTitle: string
  questionBody:  string
  audioPath:     string
  submittedAt:   string | null
  manualScore:   number | null
  autoScore:     number | null
  maxPoints:     number
}

interface Props {
  items:   SpeakingHistoryItem[]
  courses: { id: string; name: string }[]
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function SpeakingHistoryClient({ items, courses }: Props) {
  const supabase = createClient()
  const sb = supabase as any

  const [search, setSearch]           = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [playing, setPlaying]         = useState<Record<string, string>>({})   // answerId -> signedUrl
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null)
  const [audioError, setAudioError]   = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    return items.filter(it => {
      if (courseFilter && it.courseId !== courseFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!it.studentName.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [items, courseFilter, search])

  async function playAudio(answerId: string, audioPath: string) {
    if (playing[answerId]) return // ya está cargado
    setLoadingAudio(answerId)
    setAudioError(prev => ({ ...prev, [answerId]: false }))

    const { data, error } = await sb
      .storage
      .from('speaking-recordings')
      .createSignedUrl(audioPath, 3600) // 1 hora

    if (error || !data?.signedUrl) {
      setAudioError(prev => ({ ...prev, [answerId]: true }))
    } else {
      setPlaying(prev => ({ ...prev, [answerId]: data.signedUrl }))
    }
    setLoadingAudio(null)
  }

  if (items.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-3xl mb-2">🎙️</p>
        <p className="font-medium text-gray-700">Todavía no hay grabaciones de speaking</p>
        <p className="text-sm text-gray-400 mt-1">
          Van a aparecer acá apenas tus alumnos rindan un examen con preguntas de speaking.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar alumno…"
          className="input flex-1"
        />
        {courses.length > 1 && (
          <select
            value={courseFilter}
            onChange={e => setCourseFilter(e.target.value)}
            className="input sm:w-56"
          >
            <option value="">Todos mis cursos</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <p className="text-xs text-gray-400">
        {filtered.length} grabación{filtered.length !== 1 ? 'es' : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="card text-center py-10 text-gray-400 text-sm">
          Ningún resultado con esos filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const isLoadingThis = loadingAudio === item.answerId
            const signedUrl     = playing[item.answerId]
            const hasError      = audioError[item.answerId]
            const score         = item.manualScore ?? item.autoScore

            return (
              <div key={item.answerId} className="card space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                        style={{ background: '#642f8d' }}
                      >
                        {item.studentName[0]}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{item.studentName}</p>
                      <span className="text-xs text-gray-400">· {item.courseName}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">{item.evaluationTitle}</span>
                      {' — '}{item.questionBody}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(item.submittedAt)}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {score != null ? (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        score >= 60 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {item.manualScore != null ? 'Corregido' : 'Auto'} · {Math.round(score)}%
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                        Sin puntaje
                      </span>
                    )}
                    <a
                      href={`/teacher/results/${item.attemptId}`}
                      className="text-xs font-medium hover:underline flex-shrink-0"
                      style={{ color: '#642f8d' }}
                    >
                      Ver intento →
                    </a>
                  </div>
                </div>

                {/* Reproductor lazy */}
                {signedUrl ? (
                  <audio controls autoPlay className="w-full" src={signedUrl} preload="none" />
                ) : hasError ? (
                  <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                    ⚠️ No se pudo cargar el audio. Probá de nuevo.
                  </p>
                ) : (
                  <button
                    onClick={() => playAudio(item.answerId, item.audioPath)}
                    disabled={isLoadingThis}
                    className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
                  >
                    {isLoadingThis ? (
                      <>
                        <span className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                        Cargando…
                      </>
                    ) : (
                      <>▶ Reproducir grabación</>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
