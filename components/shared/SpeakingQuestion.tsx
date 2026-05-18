'use client'

// components/shared/SpeakingQuestion.tsx
// Pregunta de speaking con Web Speech API + MediaRecorder
// Graba audio real → sube a Supabase Storage → guarda audio_path en answers

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateSpeakingScore } from '@/lib/speaking-score'

interface SpeakingQuestionProps {
  questionId:      string
  attemptId:       string
  studentId:       string
  questionBody:    string
  expectedAnswer?: string
  keywords?:       string[]
  timeLimitSec?:   number
  onAnswered?:     (transcript: string, score: number) => void
  savedTranscript?: string
}

type RecordState = 'idle' | 'recording' | 'processing' | 'done' | 'error' | 'unsupported'

function detectBrowser(): 'chrome' | 'edge' | 'safari' | 'firefox' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('edg/'))   return 'edge'
  if (ua.includes('chrome')) return 'chrome'
  if (ua.includes('safari')) return 'safari'
  if (ua.includes('firefox'))return 'firefox'
  return 'other'
}

const SUPPORTED_BROWSERS = ['chrome', 'edge']

export default function SpeakingQuestion({
  questionId,
  attemptId,
  studentId,
  questionBody,
  expectedAnswer,
  keywords        = [],
  timeLimitSec    = 60,
  onAnswered,
  savedTranscript,
}: SpeakingQuestionProps) {
  const supabase = createClient()

  const [state, setState]               = useState<RecordState>('idle')
  const [transcript, setTranscript]     = useState(savedTranscript ?? '')
  const [interimText, setInterimText]   = useState('')
  const [score, setScore]               = useState<number | null>(null)
  const [feedback, setFeedback]         = useState('')
  const [keywordsFound, setKeywordsFound] = useState<string[]>([])
  const [timeLeft, setTimeLeft]         = useState(timeLimitSec)
  const [useTextFallback, setUseTextFallback] = useState(false)
  const [fallbackText, setFallbackText] = useState(savedTranscript ?? '')
  const [browser, setBrowser]           = useState<string>('other')
  const [browserWarningDismissed, setBrowserWarningDismissed] = useState(false)
  const [uploadError, setUploadError]   = useState<string | null>(null)
  const [savedAudioUrl, setSavedAudioUrl] = useState<string | null>(null)

  const recognitionRef  = useRef<any>(null)
  const timerRef        = useRef<NodeJS.Timeout | null>(null)
  const finalTextRef    = useRef('')
  // ── MediaRecorder para grabar audio real ──
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    const b = detectBrowser()
    setBrowser(b)
    if (!isSupported) setState('unsupported')
    if (savedTranscript) setState('done')
  }, [])

  // ── Iniciar grabación ─────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!isSupported) { setUseTextFallback(true); return }

    setUploadError(null)

    // 1. Pedir permiso de micrófono y arrancar MediaRecorder
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []

      // Elegir el mejor codec disponible
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg'

      const recorder = new MediaRecorder(stream, { mimeType })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.start(200) // chunk cada 200ms
      mediaRecorderRef.current = recorder
    } catch (err) {
      console.error('MediaRecorder error:', err)
      // Si falla el micrófono, seguimos solo con transcripción
    }

    // 2. Arrancar Web Speech API para transcripción en tiempo real
    const SpeechRecognition = (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous      = true
    recognition.interimResults  = true
    recognition.lang            = 'en-US'
    recognition.maxAlternatives = 1
    finalTextRef.current = ''

    recognition.onresult = (event: any) => {
      let interim = ''
      let final   = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += text + ' '
        } else {
          interim += text
        }
      }
      if (final) finalTextRef.current += final
      setInterimText(interim)
      setTranscript(finalTextRef.current)
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') setState('error')
      else stopRecording()
    }

    recognition.onend = () => {
      // onend puede dispararse solo — stopRecording maneja el cierre correcto
    }

    recognition.start()
    recognitionRef.current = recognition

    setState('recording')
    setTimeLeft(timeLimitSec)

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopRecording()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [isSupported, timeLimitSec])

  // ── Detener grabación ─────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

    // Detener Speech Recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    // Detener MediaRecorder — cuando se llama stop(), ondataavailable dispara el último chunk
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    // Detener el stream del micrófono
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    setInterimText('')
    setState('processing')

    // Esperar 600ms para que MediaRecorder entregue el último chunk
    setTimeout(() => {
      processAndUpload(finalTextRef.current.trim())
    }, 600)
  }, [])

  // ── Procesar transcripción + subir audio ──────────────────────────────────
  async function processAndUpload(text: string) {
    const finalText = text || transcript

    if (!finalText.trim() && audioChunksRef.current.length === 0) {
      setState('idle')
      return
    }

    // Calcular score de la transcripción
    const result = finalText.trim()
      ? calculateSpeakingScore(finalText, expectedAnswer ?? null, keywords)
      : { auto_score: 0, feedback: '', keywords_found: [], similarity_pct: 0 }

    setScore(result.auto_score)
    setFeedback(result.feedback)
    setKeywordsFound(result.keywords_found)

    // ── Subir audio a Storage ──────────────────────────────────────────────
    let audioPath: string | null = null

    if (audioChunksRef.current.length > 0) {
      try {
        const mimeType  = audioChunksRef.current[0].type || 'audio/webm'
        const ext       = mimeType.includes('ogg') ? 'ogg' : 'webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        const filePath  = `${studentId}/${attemptId}/${questionId}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('speaking-recordings')
          .upload(filePath, audioBlob, {
            contentType:  mimeType,
            upsert:       true,  // sobreescribe si ya existe (re-grabación)
          })

        if (uploadErr) {
          console.error('Upload error:', uploadErr)
          setUploadError('No se pudo subir la grabación. La transcripción sí fue guardada.')
        } else {
          audioPath = filePath
          // Generar URL pública temporal para mostrársela al alumno
          const { data: signed } = await supabase.storage
            .from('speaking-recordings')
            .createSignedUrl(filePath, 300) // 5 min para preview
          if (signed?.signedUrl) setSavedAudioUrl(signed.signedUrl)
        }
      } catch (err) {
        console.error('Storage error:', err)
        setUploadError('Error al subir el audio.')
      }
    }

    // ── Guardar en speaking_responses ──────────────────────────────────────
    await (supabase as any).from('speaking_responses').upsert({
      attempt_id:     attemptId,
      question_id:    questionId,
      student_id:     studentId,
      transcript:     finalText,
      auto_score:     result.auto_score,
      keywords_found: result.keywords_found,
      similarity_pct: result.similarity_pct,
    }, { onConflict: 'attempt_id,question_id' })

    // ── Guardar en answers (con audio_path) ────────────────────────────────
    const answerRow: Record<string, any> = {
      attempt_id:  attemptId,
      question_id: questionId,
      text_answer: finalText || null,
      is_correct:  result.auto_score >= 60,
    }
    if (audioPath) answerRow.audio_path = audioPath

    await (supabase as any).from('answers').upsert(
      answerRow,
      { onConflict: 'attempt_id,question_id' }
    )

    audioChunksRef.current = [] // limpiar chunks
    setState('done')
    onAnswered?.(finalText, result.auto_score)
  }

  // ── Fallback texto ────────────────────────────────────────────────────────
  async function submitFallback() {
    if (!fallbackText.trim()) return
    setState('processing')
    await processAndUpload(fallbackText)
  }

  function reset() {
    setState('idle')
    setTranscript('')
    setInterimText('')
    setScore(null)
    setFeedback('')
    setKeywordsFound([])
    setFallbackText('')
    setUploadError(null)
    setSavedAudioUrl(null)
    finalTextRef.current = ''
    audioChunksRef.current = []
  }

  // ── RENDER ────────────────────────────────────────────────────────────────

  const browserNotSupported = !SUPPORTED_BROWSERS.includes(browser)

  // Fallback texto
  if (state === 'unsupported' || useTextFallback) {
    return (
      <div className="space-y-3">
        {state === 'unsupported' ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">🎤</span>
              <div>
                <p className="text-sm font-semibold text-red-800 mb-1">
                  Grabación de voz no disponible
                </p>
                <p className="text-sm text-red-700">
                  Tu navegador no soporta grabación de voz. Escribí tu respuesta en inglés.
                  Recomendamos usar <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-sm text-blue-800">
              Escribí tu respuesta en inglés. El docente la revisará.
            </p>
          </div>
        )}

        {state === 'done' ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1.5">
              Tu respuesta guardada
            </p>
            <p className="text-sm text-gray-800 leading-relaxed">{fallbackText || transcript}</p>
          </div>
        ) : (
          <>
            <textarea
              rows={5}
              value={fallbackText}
              onChange={e => setFallbackText(e.target.value)}
              placeholder="Write your answer in English…"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button
              onClick={submitFallback}
              disabled={!fallbackText.trim() || state === 'processing'}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#642f8d' }}
            >
              {state === 'processing' ? 'Guardando…' : 'Guardar respuesta'}
            </button>
          </>
        )}

        {state !== 'unsupported' && state !== 'done' && (
          <button
            onClick={() => setUseTextFallback(false)}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            ← Volver a grabar
          </button>
        )}
      </div>
    )
  }

  // Idle — listo para grabar
  if (state === 'idle') {
    return (
      <div className="space-y-4">

        {/* Aviso preventivo de browser */}
        {browserNotSupported && !browserWarningDismissed && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 mb-1">
                  Tu navegador puede no ser compatible
                </p>
                <p className="text-sm text-amber-800">
                  La grabación funciona mejor en <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>.
                  Detectamos <strong>{browser === 'safari' ? 'Safari' : browser === 'firefox' ? 'Firefox' : 'otro navegador'}</strong>.
                </p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button
                    onClick={() => setUseTextFallback(true)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                    style={{ backgroundColor: '#642f8d' }}
                  >
                    Escribir mi respuesta
                  </button>
                  <button
                    onClick={() => setBrowserWarningDismissed(true)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-amber-400 text-amber-800 hover:bg-amber-100 transition-colors"
                  >
                    Intentar grabar igual
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 text-sm text-purple-800">
          <p className="font-medium mb-1">Respuesta oral</p>
          <p>Hacé click en el botón para grabar tu respuesta en voz alta. Tenés <strong>{timeLimitSec} segundos</strong>.</p>
          <p className="text-xs text-purple-600 mt-1">🎙 Tu voz será grabada para que el docente pueda escucharla.</p>
        </div>

        <button
          onClick={startRecording}
          className="w-full py-6 rounded-2xl border-2 border-dashed transition-all hover:border-purple-400 hover:bg-purple-50 group"
          style={{ borderColor: '#642f8d40' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
              style={{ backgroundColor: '#642f8d' }}
            >
              <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8">
                <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4z"/>
                <path d="M19 10a1 1 0 012 0 9 9 0 01-18 0 1 1 0 012 0 7 7 0 0014 0z"/>
                <path d="M12 19v4M10 23h4"/>
              </svg>
            </div>
            <span className="text-base font-semibold" style={{ color: '#642f8d' }}>
              Tocar para grabar
            </span>
            <span className="text-xs text-gray-400">
              Hasta {timeLimitSec} segundos · inglés · audio guardado para el docente
            </span>
          </div>
        </button>

        <button
          onClick={() => setUseTextFallback(true)}
          className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
        >
          Preferís escribir tu respuesta →
        </button>
      </div>
    )
  }

  // Grabando
  if (state === 'recording') {
    return (
      <div className="space-y-4">
        <button
          onClick={stopRecording}
          className="w-full py-6 rounded-2xl border-2 transition-all"
          style={{ borderColor: '#dc2626', backgroundColor: '#fef2f2' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#dc2626' }}
              >
                <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-75" />
              <div className="absolute -inset-2 rounded-full border border-red-300 animate-ping opacity-50"
                style={{ animationDelay: '0.3s' }} />
            </div>
            <span className="text-base font-semibold text-red-700">
              Grabando… Tocá para detener
            </span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-mono font-bold text-red-600">
                {timeLeft}s restantes
              </span>
            </div>
          </div>
        </button>

        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 min-h-[80px]">
          <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">
            Transcripción en tiempo real
          </p>
          <p className="text-sm text-gray-800 leading-relaxed">
            {transcript}
            <span className="text-gray-400 italic">{interimText}</span>
            {!transcript && !interimText && (
              <span className="text-gray-300 italic">Esperando tu voz…</span>
            )}
          </p>
        </div>
      </div>
    )
  }

  // Procesando
  if (state === 'processing') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#642f8d', borderTopColor: 'transparent' }} />
        <p className="text-sm text-gray-500">Guardando tu grabación…</p>
      </div>
    )
  }

  // Done — respuesta guardada
  if (state === 'done') {
    return (
      <div className="space-y-3">

        {/* Error de subida (no crítico) */}
        {uploadError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-700">⚠️ {uploadError}</p>
          </div>
        )}

        {/* Score automático */}
        {score !== null && (
          <div className={`rounded-xl p-4 border ${
            score >= 60 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`text-2xl font-bold ${score >= 60 ? 'text-green-700' : 'text-amber-700'}`}>
                {Math.round(score)}%
              </div>
              <div>
                <p className={`text-sm font-medium ${score >= 60 ? 'text-green-800' : 'text-amber-800'}`}>
                  {score >= 60 ? 'Buena respuesta' : 'Respuesta registrada'}
                </p>
                <p className={`text-xs ${score >= 60 ? 'text-green-600' : 'text-amber-600'}`}>
                  {feedback}
                </p>
              </div>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {keywords.map(kw => {
                  const found = keywordsFound.some(f => f.toLowerCase() === kw.toLowerCase())
                  return (
                    <span key={kw} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      found ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500 line-through'
                    }`}>
                      {kw}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Preview de audio para el alumno */}
        {savedAudioUrl && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">
              🎵 Tu grabación
            </p>
            <audio controls className="w-full" src={savedAudioUrl} preload="metadata" />
            <p className="text-xs text-gray-400 mt-1.5">
              ✓ Audio guardado — el docente podrá escucharlo al corregir.
            </p>
          </div>
        )}

        {/* Transcripción */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1.5">
            Tu respuesta grabada
          </p>
          <p className="text-sm text-gray-800 leading-relaxed">{transcript || fallbackText}</p>
        </div>

        <p className="text-xs text-center text-gray-400">
          El docente revisará tu grabación y dejará feedback.
        </p>

        <button
          onClick={reset}
          className="w-full py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
        >
          Volver a grabar
        </button>
      </div>
    )
  }

  return null
}
