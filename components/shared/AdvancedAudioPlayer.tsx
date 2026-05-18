'use client'

// components/shared/AdvancedAudioPlayer.tsx
// Reproductor de audio avanzado para exámenes de Listening
// - Control de velocidad: 0.5x / 0.75x / 1x / 1.25x
// - Repetición de fragmento activo
// - Sincronización con pregunta actual (timestamps)
// - Límite de reproducciones configurable
// - Log de reproducciones en DB

import { useRef, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface QuestionTimestamp {
  questionId:   string
  startSec:     number
  endSec:       number | null
  label:        string   // ej: "Pregunta 3"
}

interface AdvancedAudioPlayerProps {
  audioUrl:           string
  attemptId?:         string
  evaluationId?:      string
  studentId?:         string
  timestamps?:        QuestionTimestamp[]   // segmentos por pregunta
  activeQuestionId?:  string               // pregunta actualmente visible
  maxPlays?:          number | null        // null = ilimitado
  speedLocked?:       boolean              // forzar 1x
  examMode?:          boolean              // ocultar controles avanzados
  onPlayCountChange?: (count: number) => void
}

const SPEEDS = [0.5, 0.75, 1, 1.25]

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AdvancedAudioPlayer({
  audioUrl,
  attemptId,
  evaluationId,
  studentId,
  timestamps       = [],
  activeQuestionId,
  maxPlays         = null,
  speedLocked      = false,
  examMode         = false,
  onPlayCountChange,
}: AdvancedAudioPlayerProps) {
  const supabase   = createClient()
  const audioRef   = useRef<HTMLAudioElement>(null)

  const [isPlaying, setIsPlaying]       = useState(false)
  const [currentTime, setCurrentTime]   = useState(0)
  const [duration, setDuration]         = useState(0)
  const [speed, setSpeed]               = useState(1)
  const [playCount, setPlayCount]       = useState(0)
  const [activeSegment, setActiveSegment] = useState<QuestionTimestamp | null>(null)
  const [isLooping, setIsLooping]       = useState(false)
  const [loadError, setLoadError]       = useState(false)

  const playStartRef   = useRef<number | null>(null)
  const loggedRef      = useRef<Set<string>>(new Set())

  // Sincronizar con la pregunta activa
  useEffect(() => {
    if (!activeQuestionId || !timestamps.length) return
    const seg = timestamps.find(t => t.questionId === activeQuestionId)
    if (seg) {
      setActiveSegment(seg)
      // No saltar automáticamente — solo si el usuario hace click en "Ir al fragmento"
    }
  }, [activeQuestionId, timestamps])

  // Control de velocidad
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speedLocked ? 1 : speed
    }
  }, [speed, speedLocked])

  // Actualizar tiempo actual
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)

    // Si hay un segmento activo y looping, volver al inicio del segmento
    if (isLooping && activeSegment?.endSec !== null && activeSegment?.endSec !== undefined) {
      if (audio.currentTime >= activeSegment.endSec) {
        audio.currentTime = activeSegment.startSec
      }
    }
  }, [isLooping, activeSegment])

  function handleLoadedMetadata() {
    if (audioRef.current) setDuration(audioRef.current.duration)
  }

  function handleEnded() {
    setIsPlaying(false)
    logPlay(0, duration, true)
  }

  // Registrar reproducción en DB
  async function logPlay(start: number, end: number, completed: boolean) {
    if (!attemptId || !evaluationId || !studentId) return

    const key = `${activeSegment?.questionId ?? 'global'}_${start}`
    if (loggedRef.current.has(key)) return
    loggedRef.current.add(key)

    await (supabase as any).from('audio_play_log').insert({
      attempt_id:    attemptId,
      student_id:    studentId,
      evaluation_id: evaluationId,
      question_id:   activeSegment?.questionId ?? null,
      start_sec:     start,
      end_sec:       end,
      speed,
      completed,
    })

    const newCount = playCount + 1
    setPlayCount(newCount)
    onPlayCountChange?.(newCount)
  }

  async function togglePlay() {
    const audio = audioRef.current
    if (!audio) return

    // Verificar límite de reproducciones
    if (!isPlaying && maxPlays !== null && playCount >= maxPlays) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      if (playStartRef.current !== null) {
        logPlay(playStartRef.current, audio.currentTime, false)
        playStartRef.current = null
      }
    } else {
      await audio.play()
      setIsPlaying(true)
      playStartRef.current = audio.currentTime
    }
  }

  // Ir al segmento de la pregunta activa
  function jumpToSegment() {
    if (!activeSegment || !audioRef.current) return
    audioRef.current.currentTime = activeSegment.startSec
    if (!isPlaying) {
      audioRef.current.play()
      setIsPlaying(true)
      playStartRef.current = activeSegment.startSec
    }
  }

  // Reproducir solo el segmento activo
  async function playSegment() {
    if (!activeSegment || !audioRef.current) return
    if (maxPlays !== null && playCount >= maxPlays) return

    const audio = audioRef.current
    audio.currentTime = activeSegment.startSec
    await audio.play()
    setIsPlaying(true)
    playStartRef.current = activeSegment.startSec

    // Detener al final del segmento
    if (activeSegment.endSec !== null) {
      const checkEnd = setInterval(() => {
        if (!audioRef.current) { clearInterval(checkEnd); return }
        if (audioRef.current.currentTime >= (activeSegment.endSec ?? Infinity)) {
          if (!isLooping) {
            audioRef.current.pause()
            setIsPlaying(false)
            logPlay(activeSegment.startSec, activeSegment.endSec!, true)
            clearInterval(checkEnd)
          }
        }
      }, 100)
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const t = Number(e.target.value)
    if (audioRef.current) audioRef.current.currentTime = t
    setCurrentTime(t)
  }

  function changeSpeed(s: number) {
    if (speedLocked) return
    setSpeed(s)
  }

  const canPlay = maxPlays === null || playCount < maxPlays
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  // Calcular posición del segmento activo en la barra
  const segStart = activeSegment && duration > 0
    ? (activeSegment.startSec / duration) * 100 : null
  const segEnd = activeSegment?.endSec && duration > 0
    ? (activeSegment.endSec / duration) * 100 : null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={() => setLoadError(true)}
        preload="metadata"
      />

      {loadError ? (
        <div className="p-4 text-center text-sm text-gray-400">
          No se pudo cargar el audio.
          <a href={audioUrl} target="_blank" rel="noopener noreferrer"
            className="ml-2 text-purple-600 underline">
            Descargar
          </a>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100"
            style={{ background: '#f5eefb' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#642f8d' }}>
              <svg viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                <path d="M9.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L13.586 10 9.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#642f8d' }}>
                Audio — Listening
              </p>
              {maxPlays !== null && (
                <p className="text-xs" style={{ color: '#8b5cf6' }}>
                  {playCount}/{maxPlays} reproducciones usadas
                </p>
              )}
            </div>
            {activeSegment && (
              <div className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ backgroundColor: '#642f8d20', color: '#642f8d' }}>
                {activeSegment.label}
              </div>
            )}
          </div>

          {/* Controles principales */}
          <div className="px-4 py-4">
            {/* Barra de progreso con segmento resaltado */}
            <div className="relative mb-3">
              {/* Segmento activo resaltado */}
              {segStart !== null && segEnd !== null && (
                <div
                  className="absolute top-0 bottom-0 rounded-full pointer-events-none"
                  style={{
                    left:             `${segStart}%`,
                    width:            `${segEnd - segStart}%`,
                    backgroundColor:  '#642f8d30',
                    height:           '100%',
                  }}
                />
              )}
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full"
                style={{ accentColor: '#642f8d' }}
              />
            </div>

            {/* Tiempo */}
            <div className="flex justify-between text-xs text-gray-400 mb-4">
              <span>{formatTime(currentTime)}</span>
              <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
            </div>

            {/* Botones de control */}
            <div className="flex items-center justify-center gap-3">
              {/* Retroceder 5s */}
              <button
                onClick={() => {
                  if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 5)
                }}
                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-500"
                title="Retroceder 5 segundos"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 110 14H9a1 1 0 110-2h2a5 5 0 100-10H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/>
                </svg>
              </button>

              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                disabled={!canPlay && !isPlaying}
                className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#642f8d' }}
                title={!canPlay ? 'Límite de reproducciones alcanzado' : isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 20 20" fill="white" className="w-5 h-5">
                    <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="white" className="w-5 h-5">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                  </svg>
                )}
              </button>

              {/* Adelantar 5s */}
              <button
                onClick={() => {
                  if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 5)
                }}
                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-500"
                title="Adelantar 5 segundos"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M12.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H9a5 5 0 100 10h2a1 1 0 110 2H9a7 7 0 110-14h5.586l-2.293-2.293a1 1 0 010-1.414z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Controles avanzados */}
          {!examMode && (
            <div className="px-4 pb-4 space-y-3">
              {/* Velocidad */}
              {!speedLocked && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-16 flex-shrink-0">Velocidad</span>
                  <div className="flex gap-1.5">
                    {SPEEDS.map(s => (
                      <button
                        key={s}
                        onClick={() => changeSpeed(s)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          speed === s
                            ? 'text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        style={speed === s ? { backgroundColor: '#642f8d' } : {}}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Segmento activo */}
              {activeSegment && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-purple-100"
                  style={{ backgroundColor: '#f5eefb' }}>
                  <div className="flex-1">
                    <p className="text-xs font-medium" style={{ color: '#642f8d' }}>
                      {activeSegment.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTime(activeSegment.startSec)}
                      {activeSegment.endSec ? ` — ${formatTime(activeSegment.endSec)}` : ' en adelante'}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={playSegment}
                      disabled={!canPlay}
                      className="px-2.5 py-1 text-xs rounded-lg font-medium disabled:opacity-40 transition-all hover:opacity-90 text-white"
                      style={{ backgroundColor: '#642f8d' }}
                      title="Reproducir solo este fragmento"
                    >
                      ▶ Fragmento
                    </button>
                    <button
                      onClick={() => setIsLooping(p => !p)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-all ${
                        isLooping
                          ? 'text-white border-transparent'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                      style={isLooping ? { backgroundColor: '#642f8d' } : {}}
                      title={isLooping ? 'Desactivar loop' : 'Repetir fragmento en loop'}
                    >
                      {isLooping ? '↺ Loop ON' : '↺ Loop'}
                    </button>
                  </div>
                </div>
              )}

              {/* Timestamps navegables */}
              {timestamps.length > 1 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Saltar a pregunta</p>
                  <div className="flex flex-wrap gap-1.5">
                    {timestamps.map(ts => {
                      const isActive = ts.questionId === activeQuestionId
                      return (
                        <button
                          key={ts.questionId}
                          onClick={() => {
                            if (audioRef.current) {
                              audioRef.current.currentTime = ts.startSec
                              setCurrentTime(ts.startSec)
                            }
                            setActiveSegment(ts)
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            isActive
                              ? 'text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          style={isActive ? { backgroundColor: '#642f8d' } : {}}
                        >
                          {ts.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modo examen: solo velocidad */}
          {examMode && !speedLocked && (
            <div className="px-4 pb-3 flex items-center gap-2">
              <span className="text-xs text-gray-400">Velocidad:</span>
              {SPEEDS.map(s => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                    speed === s ? 'text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                  style={speed === s ? { backgroundColor: '#642f8d' } : {}}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}

          {/* Aviso límite */}
          {maxPlays !== null && !canPlay && (
            <div className="mx-4 mb-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
              ⚠️ Alcanzaste el límite de {maxPlays} reproducciones para este audio.
            </div>
          )}
        </>
      )}
    </div>
  )
}
