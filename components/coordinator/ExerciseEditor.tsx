'use client'

// components/coordinator/ExerciseEditor.tsx
// Editor estructurado para crear ejercicios tipo Macmillan directamente en la plataforma
// Tipos: Match, Put in order, Underline/Choose, Find the error, Complete, Writing

import { useState } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ExerciseType =
  | 'match'        // Match sentence halves — col. izquierda + col. derecha
  | 'order'        // Put the words in correct order
  | 'underline'    // Underline/Choose the correct word  (A / B inline)
  | 'error'        // Find the error and correct it
  | 'complete'     // Complete the sentences
  | 'writing'      // Free writing prompt
  | 'reading'      // Texto + preguntas de comprensión
  | 'listening'    // Audio + consigna + preguntas T/F o múltiple opción

export interface ExerciseQuestion {
  id:          string
  body:        string                               // ítem principal
  options:     { body: string; is_correct: boolean }[]  // opciones (Match col. derecha, Underline, etc.)
  q_type:      'multiple_choice' | 'short_answer' | 'essay'
  skill:       string
  points:      number
  explanation: string
}

export interface Exercise {
  type:        ExerciseType
  instruction: string          // consigna completa
  skill:       string
  points:      number          // puntos por ítem
  items:       ExerciseQuestion[]
}

interface ExerciseEditorProps {
  onAdd:    (questions: ExerciseQuestion[], instruction: string) => void
  onCancel: () => void
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const EXERCISE_TYPES: { type: ExerciseType; label: string; icon: string; desc: string }[] = [
  { type: 'match',     icon: '🔗', label: 'Match',          desc: 'Unir mitades de oraciones o definiciones con palabras' },
  { type: 'order',     icon: '🔀', label: 'Put in order',   desc: 'Ordenar palabras para formar preguntas u oraciones' },
  { type: 'underline', icon: '✏️', label: 'Choose/Underline', desc: 'Elegir la palabra correcta entre dos opciones' },
  { type: 'error',     icon: '🔍', label: 'Find the error', desc: 'Encontrar y corregir el error en cada oración' },
  { type: 'complete',  icon: '✍️', label: 'Complete',       desc: 'Completar oraciones con la palabra correcta' },
  { type: 'writing',   icon: '📝', label: 'Writing',        desc: 'Redacción libre con guías o preguntas orientadoras' },
  { type: 'reading',   icon: '📖', label: 'Reading',        desc: 'Texto de lectura con párrafos y preguntas de comprensión opcionales' },
  { type: 'listening',  icon: '🎧', label: 'Listening',      desc: 'Audio con consigna y preguntas de comprensión auditiva' },
]

const SKILL_OPTIONS = [
  { value: 'grammar',    label: 'Grammar' },
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'reading',    label: 'Reading' },
  { value: 'writing',    label: 'Writing' },
  { value: 'listening',  label: 'Listening' },
]

const DEFAULT_INSTRUCTIONS: Record<ExerciseType, string> = {
  match:     'Match the sentence halves to form full sentences.',
  order:     'Put the words into the correct order to form questions.',
  underline: 'Underline the correct word in italics in each sentence.',
  error:     'For each sentence (1–10), find the error and correct it.',
  complete:  'Complete the sentences with the correct word.',
  writing:   'Write a short paragraph. Use the questions below as a guide.',
  reading:   'Read the text.',
  listening: 'Listen to the audio and answer the questions.',
}

const DEFAULT_SKILL: Record<ExerciseType, string> = {
  match:     'grammar',
  order:     'grammar',
  underline: 'grammar',
  error:     'grammar',
  complete:  'vocabulary',
  writing:   'writing',
  reading:   'reading',
  listening: 'listening',
}

function uid() { return Math.random().toString(36).slice(2, 9) }

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ExerciseEditor({ onAdd, onCancel }: ExerciseEditorProps) {
  const [step,        setStep]        = useState<'type' | 'edit'>('type')
  const [exType,      setExType]      = useState<ExerciseType>('match')
  const [instruction, setInstruction] = useState('')
  const [skill,       setSkill]       = useState('grammar')
  const [points,      setPoints]      = useState(1)

  // Match — cada índice es un par (izquierda, derecha correcta)
  const [matchLeft,       setMatchLeft]       = useState<string[]>(['', '', '', '', ''])
  const [matchRight,      setMatchRight]      = useState<string[]>(['', '', '', '', ''])
  const [matchDistractors, setMatchDistractors] = useState<string[]>(['', ''])

  // Order, Error, Complete — ítems simples
  const [simpleItems, setSimpleItems] = useState<{ id: string; body: string; answer: string }[]>([
    { id: uid(), body: '', answer: '' },
    { id: uid(), body: '', answer: '' },
    { id: uid(), body: '', answer: '' },
  ])

  // Underline — cada ítem tiene dos opciones inline
  const [underlineItems, setUnderlineItems] = useState<{
    id: string; before: string; opt1: string; opt2: string; correct: 0 | 1; after: string
  }[]>([
    { id: uid(), before: 'He lives in', opt1: 'a', opt2: 'an', correct: 0, after: 'house in the city.' },
    { id: uid(), before: '', opt1: '', opt2: '', correct: 0, after: '' },
  ])

  // Writing — preguntas guía
  const [writingPrompts, setWritingPrompts] = useState<string[]>(['What will houses be like?', ''])
  const [writingWordCount, setWritingWordCount] = useState('60–80')

  // Reading
  const [readingTitle,     setReadingTitle]     = useState('')
  const [readingParagraphs, setReadingParagraphs] = useState<{ id: string; label: string; text: string }[]>([
    { id: uid(), label: '', text: '' },
  ])
  const [readingQuestions, setReadingQuestions] = useState<{ id: string; body: string; q_type: 'multiple_choice' | 'short_answer'; options: string[]; correct: number; answer: string }[]>([
    { id: uid(), body: '', q_type: 'short_answer', options: ['', '', '', ''], correct: 0, answer: '' },
  ])
  const [readingHasQuestions, setReadingHasQuestions] = useState(true)

  // Listening
  const [listeningAudioUrl,   setListeningAudioUrl]   = useState('')
  const [listeningAudioFile,  setListeningAudioFile]  = useState<File | null>(null)
  const [listeningQuestions,  setListeningQuestions]  = useState<{
    id: string; body: string; q_type: 'true_false' | 'multiple_choice' | 'short_answer'
    options: string[]; correct: number; answer: string
  }[]>([
    { id: uid(), body: '', q_type: 'true_false',       options: ['True', 'False'], correct: 0, answer: '' },
    { id: uid(), body: '', q_type: 'true_false',       options: ['True', 'False'], correct: 0, answer: '' },
    { id: uid(), body: '', q_type: 'true_false',       options: ['True', 'False'], correct: 0, answer: '' },
  ])

  function handleSelectType(t: ExerciseType) {
    setExType(t)
    setInstruction(DEFAULT_INSTRUCTIONS[t])
    setSkill(DEFAULT_SKILL[t])
    setStep('edit')
  }

  // ── Generar preguntas desde el editor ──────────────────────────────────────

  function buildQuestions(): ExerciseQuestion[] {
    switch (exType) {

      case 'match': {
        // Todas las respuestas correctas + distractores = opciones disponibles para el alumno
        const allRights = matchRight.filter(r => r.trim())
        const distractors = matchDistractors.filter(d => d.trim())

        return matchLeft
          .map((body, i) => {
            if (!body.trim() || !matchRight[i]?.trim()) return null
            // Opciones = todas las derechas + distractores, marcando solo la correcta
            const opts = [
              ...allRights.map((r, j) => ({ body: r.trim(), is_correct: j === i })),
              ...distractors.map(d => ({ body: d.trim(), is_correct: false })),
            ]
            return {
              id:          uid(),
              body:        body.trim(),
              options:     opts,
              q_type:      'multiple_choice' as const,
              skill,
              points,
              explanation: '',
            }
          })
          .filter(Boolean) as ExerciseQuestion[]
      }

      case 'underline': {
        return underlineItems
          .filter(it => it.opt1.trim() && it.opt2.trim())
          .map(it => {
            const fullBody = [it.before.trim(), `${it.opt1} / ${it.opt2}`, it.after.trim()]
              .filter(Boolean).join(' ')
            return {
              id:          uid(),
              body:        fullBody,
              options:     [
                { body: it.opt1.trim(), is_correct: it.correct === 0 },
                { body: it.opt2.trim(), is_correct: it.correct === 1 },
              ],
              q_type:      'multiple_choice' as const,
              skill,
              points,
              explanation: '',
            }
          })
      }

      case 'writing': {
        const prompts = writingPrompts.filter(p => p.trim())
        const body    = [
          instruction,
          prompts.map((p, i) => `${i + 1}. ${p}`).join('\n'),
          `Write ${writingWordCount} words.`,
        ].filter(Boolean).join('\n')
        return [{
          id:          uid(),
          body,
          options:     [],
          q_type:      'essay' as const,
          skill:       'writing',
          points:      points * 5,
          explanation: '',
        }]
      }

      case 'reading': {
        // Primera pregunta: el texto de lectura completo como contexto (short_answer o essay)
        const paragraphsText = readingParagraphs
          .filter(p => p.text.trim())
          .map(p => p.label.trim() ? `${p.label}  ${p.text.trim()}` : p.text.trim())
          .join('\n\n')
        const readingBody = [
          readingTitle.trim() ? readingTitle.trim() : '',
          paragraphsText,
        ].filter(Boolean).join('\n\n')

        const qs: ExerciseQuestion[] = []

        if (readingHasQuestions) {
          // Preguntas de comprensión
          for (const rq of readingQuestions.filter(q => q.body.trim())) {
            const contextBody = `[Reading: ${readingTitle || 'text above'}]\n${rq.body.trim()}`
            if (rq.q_type === 'multiple_choice') {
              const opts = rq.options.filter(o => o.trim())
              qs.push({
                id:          uid(),
                body:        contextBody,
                options:     opts.map((o, i) => ({ body: o.trim(), is_correct: i === rq.correct })),
                q_type:      'multiple_choice',
                skill:       'reading',
                points,
                explanation: '',
              })
            } else {
              qs.push({
                id:          uid(),
                body:        contextBody,
                options:     [],
                q_type:      'short_answer',
                skill:       'reading',
                points,
                explanation: rq.answer.trim(),
              })
            }
          }
        } else {
          // Sin preguntas: el texto entero como una sola essay para leer y responder
          qs.push({
            id:          uid(),
            body:        readingBody,
            options:     [],
            q_type:      'essay',
            skill:       'reading',
            points:      points * 3,
            explanation: '',
          })
        }
        return qs
      }

      case 'listening': {
        const audioRef = listeningAudioFile
          ? `[AUDIO: ${listeningAudioFile.name}]`
          : listeningAudioUrl.trim()
          ? `[AUDIO URL: ${listeningAudioUrl.trim()}]`
          : '[AUDIO PENDIENTE]'

        return listeningQuestions
          .filter(lq => lq.body.trim())
          .map(lq => {
            const body = `${audioRef}\n${lq.body.trim()}`
            if (lq.q_type === 'true_false') {
              return {
                id:          uid(),
                body,
                options:     [
                  { body: 'True',  is_correct: lq.correct === 0 },
                  { body: 'False', is_correct: lq.correct === 1 },
                ],
                q_type:      'multiple_choice' as const,
                skill:       'listening',
                points,
                explanation: lq.answer.trim(),
              }
            }
            if (lq.q_type === 'multiple_choice') {
              const opts = lq.options.filter(o => o.trim())
              return {
                id:          uid(),
                body,
                options:     opts.map((o, i) => ({ body: o.trim(), is_correct: i === lq.correct })),
                q_type:      'multiple_choice' as const,
                skill:       'listening',
                points,
                explanation: lq.answer.trim(),
              }
            }
            return {
              id:          uid(),
              body,
              options:     [],
              q_type:      'short_answer' as const,
              skill:       'listening',
              points,
              explanation: lq.answer.trim(),
            }
          })
      }

      default: {
        // order, error, complete
        return simpleItems
          .filter(it => it.body.trim())
          .map(it => ({
            id:          uid(),
            body:        it.body.trim(),
            options:     [],
            q_type:      'short_answer' as const,
            skill,
            points,
            explanation: it.answer.trim(),
          }))
      }
    }
  }

  function handleAdd() {
    const qs = buildQuestions()
    if (qs.length === 0) return
    onAdd(qs, instruction)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  // Paso 1 — Elegir tipo
  if (step === 'type') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Agregar ejercicio</p>
            <p className="text-xs text-gray-400 mt-0.5">Elegí el tipo de ejercicio a crear</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
              <path d="M4 4l8 8M12 4l-8 8"/>
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {EXERCISE_TYPES.map(et => (
            <button
              key={et.type}
              onClick={() => handleSelectType(et.type)}
              className="text-left rounded-xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50/40 p-3 transition-all group"
            >
              <div className="text-xl mb-1">{et.icon}</div>
              <div className="text-sm font-semibold text-gray-900 group-hover:text-purple-700">{et.label}</div>
              <div className="text-xs text-gray-400 mt-0.5 leading-snug">{et.desc}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Paso 2 — Editor del ejercicio
  const typeInfo = EXERCISE_TYPES.find(t => t.type === exType)!
  const previewCount = exType === 'writing' ? 1
    : exType === 'match' ? matchLeft.filter((l, i) => l.trim() && matchRight[i]?.trim()).length
    : exType === 'underline' ? underlineItems.filter(i => i.opt1.trim() && i.opt2.trim()).length
    : exType === 'reading' ? (readingHasQuestions ? readingQuestions.filter(q => q.body.trim()).length : 1)
    : exType === 'listening' ? listeningQuestions.filter(q => q.body.trim()).length
    : simpleItems.filter(i => i.body.trim()).length

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep('type')} className="text-gray-400 hover:text-gray-600">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
              <path d="M10 4L6 8l4 4"/>
            </svg>
          </button>
          <span className="text-lg">{typeInfo.icon}</span>
          <p className="text-sm font-semibold text-gray-900">{typeInfo.label}</p>
        </div>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
            <path d="M4 4l8 8M12 4l-8 8"/>
          </svg>
        </button>
      </div>

      {/* Consigna + meta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="label text-xs mb-1">Consigna</label>
          <input type="text" value={instruction} onChange={e => setInstruction(e.target.value)}
            className="input text-sm" placeholder="Ej: Match the sentence halves to form full sentences." />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label text-xs mb-1">Habilidad</label>
            <select value={skill} onChange={e => setSkill(e.target.value)} className="input text-xs">
              {SKILL_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs mb-1">Pts / ítem</label>
            <input type="number" min={0.5} max={10} step={0.5} value={points}
              onChange={e => setPoints(parseFloat(e.target.value) || 1)} className="input text-xs" />
          </div>
        </div>
      </div>

      {/* ── Editor por tipo ── */}

      {/* MATCH */}
      {exType === 'match' && (
        <div className="space-y-4">

          {/* Cabecera columnas */}
          <div className="grid grid-cols-[1.5rem_1fr_2rem_1fr_2rem] gap-x-2 items-center">
            <div />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Columna A</p>
            <div />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Columna B (respuesta correcta)</p>
            <div />
          </div>

          {/* Pares */}
          <div className="space-y-2">
            {matchLeft.map((item, i) => (
              <div key={i} className="grid grid-cols-[1.5rem_1fr_2rem_1fr_2rem] gap-x-2 items-center">
                {/* Número */}
                <span className="text-xs text-gray-400 text-right">{i + 1}</span>

                {/* Izquierda */}
                <input
                  type="text"
                  value={item}
                  onChange={e => setMatchLeft(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                  placeholder={`Ej: She is good…`}
                  className="input text-sm"
                />

                {/* Flecha visual */}
                <span className="text-gray-300 text-center select-none">→</span>

                {/* Derecha correcta */}
                <input
                  type="text"
                  value={matchRight[i] ?? ''}
                  onChange={e => setMatchRight(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                  placeholder={`Ej: …at cooking.`}
                  className="input text-sm border-green-200 focus:border-green-400"
                />

                {/* Eliminar fila */}
                <button
                  onClick={() => {
                    setMatchLeft(prev => prev.filter((_, j) => j !== i))
                    setMatchRight(prev => prev.filter((_, j) => j !== i))
                  }}
                  disabled={matchLeft.length <= 2}
                  className="text-gray-300 hover:text-red-500 disabled:opacity-20 flex items-center justify-center"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3.5 w-3.5">
                    <path d="M4 8h8"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Botón agregar par */}
          <button
            onClick={() => {
              setMatchLeft(prev => [...prev, ''])
              setMatchRight(prev => [...prev, ''])
            }}
            className="text-xs text-purple-600 hover:text-purple-800"
          >
            + Agregar par
          </button>

          {/* Distractores opcionales */}
          <div className="rounded-xl border border-dashed border-gray-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-600">Distractores (opcional)</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Opciones falsas que aparecen en la columna B para dificultar el ejercicio
                </p>
              </div>
            </div>
            {matchDistractors.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-red-400 w-4 flex-shrink-0 text-right">✗</span>
                <input
                  type="text"
                  value={d}
                  onChange={e => setMatchDistractors(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                  placeholder={`Distractor ${i + 1}`}
                  className="input text-sm flex-1 border-red-100"
                />
                <button
                  onClick={() => setMatchDistractors(prev => prev.filter((_, j) => j !== i))}
                  disabled={matchDistractors.length <= 1}
                  className="text-gray-300 hover:text-red-500 disabled:opacity-20"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3.5 w-3.5">
                    <path d="M4 8h8"/>
                  </svg>
                </button>
              </div>
            ))}
            <button
              onClick={() => setMatchDistractors(prev => [...prev, ''])}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              + Agregar distractor
            </button>
          </div>

          {/* Preview */}
          {matchLeft.some((l, i) => l.trim() && matchRight[i]?.trim()) && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
              <p className="text-xs font-medium text-gray-500 mb-2">Preview columna B (mezclada para el alumno):</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ...matchRight.filter(r => r.trim()).map(r => ({ text: r, correct: true })),
                  ...matchDistractors.filter(d => d.trim()).map(d => ({ text: d, correct: false })),
                ].sort(() => Math.random() - 0.5).map((opt, i) => (
                  <span
                    key={i}
                    className={`text-xs px-2 py-1 rounded-lg border font-medium ${
                      opt.correct
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {opt.text}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Verde = respuesta real · Rojo = distractor</p>
            </div>
          )}
        </div>
      )}

      {/* UNDERLINE / CHOOSE */}
      {exType === 'underline' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-2">
            Escribí la oración dividida en: texto antes · opción 1 · opción 2 · texto después. Marcá cuál es la correcta.
          </p>
          {underlineItems.map((it, i) => (
            <div key={it.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
                <input type="text" value={it.before}
                  onChange={e => setUnderlineItems(prev => prev.map((x, j) => j === i ? { ...x, before: e.target.value } : x))}
                  placeholder="Texto antes…" className="input text-sm flex-1" />
              </div>
              <div className="flex items-center gap-2 pl-6">
                {/* Opción 1 */}
                <button
                  onClick={() => setUnderlineItems(prev => prev.map((x, j) => j === i ? { ...x, correct: 0 } : x))}
                  className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    it.correct === 0 ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-green-400'
                  }`}
                  title="Marcar como correcta"
                >
                  {it.correct === 0 && (
                    <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth={2} className="h-2.5 w-2.5">
                      <path d="M2 5l2.5 2.5 3.5-4"/>
                    </svg>
                  )}
                </button>
                <input type="text" value={it.opt1}
                  onChange={e => setUnderlineItems(prev => prev.map((x, j) => j === i ? { ...x, opt1: e.target.value } : x))}
                  placeholder="Opción 1" className={`input text-sm w-28 ${it.correct === 0 ? 'border-green-300 bg-green-50' : ''}`} />

                <span className="text-gray-400 text-sm">/</span>

                {/* Opción 2 */}
                <button
                  onClick={() => setUnderlineItems(prev => prev.map((x, j) => j === i ? { ...x, correct: 1 } : x))}
                  className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    it.correct === 1 ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-green-400'
                  }`}
                  title="Marcar como correcta"
                >
                  {it.correct === 1 && (
                    <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth={2} className="h-2.5 w-2.5">
                      <path d="M2 5l2.5 2.5 3.5-4"/>
                    </svg>
                  )}
                </button>
                <input type="text" value={it.opt2}
                  onChange={e => setUnderlineItems(prev => prev.map((x, j) => j === i ? { ...x, opt2: e.target.value } : x))}
                  placeholder="Opción 2" className={`input text-sm w-28 ${it.correct === 1 ? 'border-green-300 bg-green-50' : ''}`} />

                <input type="text" value={it.after}
                  onChange={e => setUnderlineItems(prev => prev.map((x, j) => j === i ? { ...x, after: e.target.value } : x))}
                  placeholder="…resto de la oración" className="input text-sm flex-1" />

                <button onClick={() => setUnderlineItems(prev => prev.filter((_, j) => j !== i))}
                  className="text-gray-300 hover:text-red-500 flex-shrink-0">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
                    <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => setUnderlineItems(prev => [...prev, { id: uid(), before: '', opt1: '', opt2: '', correct: 0, after: '' }])}
            className="text-xs text-purple-600 hover:text-purple-800"
          >
            + Agregar oración
          </button>

          {/* Preview */}
          {underlineItems.some(it => it.opt1 && it.opt2) && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Preview para el alumno:</p>
              {underlineItems.filter(it => it.opt1 && it.opt2).map((it, i) => (
                <p key={it.id} className="text-sm text-gray-800 mb-1">
                  <span className="text-gray-400 mr-1.5">{i + 1}</span>
                  {it.before && `${it.before} `}
                  <span className="italic text-purple-700 font-medium">{it.opt1} / {it.opt2}</span>
                  {it.after && ` ${it.after}`}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ORDER / ERROR / COMPLETE — ítems simples con respuesta */}
      {(exType === 'order' || exType === 'error' || exType === 'complete') && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 mb-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {exType === 'order' ? 'Palabras desordenadas' : exType === 'error' ? 'Oración con error' : 'Oración incompleta'}
            </p>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Respuesta correcta (referencia del docente)
            </p>
          </div>
          {simpleItems.map((it, i) => (
            <div key={it.id} className="grid grid-cols-2 gap-2 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
                <input type="text" value={it.body}
                  onChange={e => setSimpleItems(prev => prev.map((x, j) => j === i ? { ...x, body: e.target.value } : x))}
                  placeholder={
                    exType === 'order' ? 'hot / Japan / is / it / in / ?' :
                    exType === 'error' ? 'These is my laptop on the table.' :
                    'A person from Sudan is ___.'
                  }
                  className="input text-sm flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="text" value={it.answer}
                  onChange={e => setSimpleItems(prev => prev.map((x, j) => j === i ? { ...x, answer: e.target.value } : x))}
                  placeholder={
                    exType === 'order' ? 'Is it hot in Japan?' :
                    exType === 'error' ? 'This is my laptop on the table.' :
                    'Sudanese'
                  }
                  className="input text-sm flex-1"
                />
                <button onClick={() => setSimpleItems(prev => prev.filter((_, j) => j !== i))}
                  disabled={simpleItems.length <= 1}
                  className="text-gray-300 hover:text-red-500 disabled:opacity-20 flex-shrink-0">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
                    <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => setSimpleItems(prev => [...prev, { id: uid(), body: '', answer: '' }])}
            className="text-xs text-purple-600 hover:text-purple-800"
          >
            + Agregar ítem
          </button>
        </div>
      )}


      {/* READING */}
      {exType === 'reading' && (
        <div className="space-y-4">

          {/* Título del texto */}
          <div>
            <label className="label text-xs mb-1">Título del texto (opcional)</label>
            <input type="text" value={readingTitle} onChange={e => setReadingTitle(e.target.value)}
              placeholder="Ej: The best musical experiences" className="input text-sm" />
          </div>

          {/* Párrafos */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Párrafos del texto
            </p>
            {readingParagraphs.map((p, i) => (
              <div key={p.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p.label}
                    onChange={e => setReadingParagraphs(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                    placeholder="Etiqueta (ej: A, B, C)"
                    className="input text-sm w-24 flex-shrink-0"
                  />
                  <span className="text-xs text-gray-400">Etiqueta del párrafo (opcional)</span>
                  {readingParagraphs.length > 1 && (
                    <button
                      onClick={() => setReadingParagraphs(prev => prev.filter((_, j) => j !== i))}
                      className="ml-auto text-gray-300 hover:text-red-500"
                    >
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
                        <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4"/>
                      </svg>
                    </button>
                  )}
                </div>
                <textarea
                  rows={4}
                  value={p.text}
                  onChange={e => setReadingParagraphs(prev => prev.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                  placeholder={`Texto del párrafo ${p.label || i + 1}…`}
                  className="textarea text-sm"
                />
              </div>
            ))}
            <button
              onClick={() => setReadingParagraphs(prev => [...prev, { id: uid(), label: String.fromCharCode(65 + prev.length), text: '' }])}
              className="text-xs text-purple-600 hover:text-purple-800"
            >
              + Agregar párrafo
            </button>
          </div>

          {/* Toggle preguntas */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Preguntas de comprensión</p>
              <p className="text-xs text-gray-400 mt-0.5">Agregá preguntas debajo del texto para que el alumno responda</p>
            </div>
            <button
              type="button"
              onClick={() => setReadingHasQuestions(p => !p)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${readingHasQuestions ? '' : 'bg-gray-200'}`}
              style={readingHasQuestions ? { backgroundColor: '#642f8d' } : {}}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${readingHasQuestions ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Preguntas de comprensión */}
          {readingHasQuestions && (
            <div className="space-y-3">
              {readingQuestions.map((rq, i) => (
                <div key={rq.id} className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 mt-2 w-4 flex-shrink-0">{i + 1}</span>
                    <textarea
                      rows={2}
                      value={rq.body}
                      onChange={e => setReadingQuestions(prev => prev.map((x, j) => j === i ? { ...x, body: e.target.value } : x))}
                      placeholder="Ej: What will be on the first floor of the living towers?"
                      className="textarea text-sm flex-1"
                    />
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {/* Tipo de pregunta */}
                      <select
                        value={rq.q_type}
                        onChange={e => setReadingQuestions(prev => prev.map((x, j) =>
                          j === i ? { ...x, q_type: e.target.value as 'multiple_choice' | 'short_answer' } : x
                        ))}
                        className="input text-xs w-36"
                      >
                        <option value="short_answer">Respuesta corta</option>
                        <option value="multiple_choice">Múltiple opción</option>
                      </select>
                      <button
                        onClick={() => setReadingQuestions(prev => prev.filter((_, j) => j !== i))}
                        disabled={readingQuestions.length <= 1}
                        className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-20 text-right"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {/* Múltiple opción */}
                  {rq.q_type === 'multiple_choice' && (
                    <div className="pl-6 space-y-1.5">
                      {rq.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <button
                            onClick={() => setReadingQuestions(prev => prev.map((x, j) => j === i ? { ...x, correct: oi } : x))}
                            className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                              rq.correct === oi ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-green-400'
                            }`}
                          >
                            {rq.correct === oi && (
                              <svg viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth={2} className="h-2 w-2">
                                <path d="M1.5 4l2 2L6.5 2"/>
                              </svg>
                            )}
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={e => setReadingQuestions(prev => prev.map((x, j) =>
                              j === i ? { ...x, options: x.options.map((o, k) => k === oi ? e.target.value : o) } : x
                            ))}
                            placeholder={`Opción ${String.fromCharCode(65 + oi)}`}
                            className={`input text-xs flex-1 ${rq.correct === oi ? 'border-green-200 bg-green-50' : ''}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Respuesta corta */}
                  {rq.q_type === 'short_answer' && (
                    <div className="pl-6">
                      <input
                        type="text"
                        value={rq.answer}
                        onChange={e => setReadingQuestions(prev => prev.map((x, j) => j === i ? { ...x, answer: e.target.value } : x))}
                        placeholder="Respuesta correcta (referencia del docente)"
                        className="input text-xs w-full"
                      />
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={() => setReadingQuestions(prev => [...prev, {
                  id: uid(), body: '', q_type: 'short_answer', options: ['', '', '', ''], correct: 0, answer: ''
                }])}
                className="text-xs text-purple-600 hover:text-purple-800"
              >
                + Agregar pregunta
              </button>
            </div>
          )}
        </div>
      )}

      {/* LISTENING */}
      {exType === 'listening' && (
        <div className="space-y-4">

          {/* Audio */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Audio</p>
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 space-y-3">
              {/* Subir archivo */}
              <div>
                <label className="label text-xs mb-1">Subir archivo de audio</label>
                <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-gray-200 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                  <span className="text-xl">🎵</span>
                  <div className="flex-1 min-w-0">
                    {listeningAudioFile
                      ? <p className="text-sm text-gray-900 truncate">{listeningAudioFile.name}</p>
                      : <p className="text-sm text-gray-400">Elegir archivo MP3, M4A o WAV…</p>
                    }
                  </div>
                  <input
                    type="file"
                    accept="audio/*"
                    className="sr-only"
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null
                      setListeningAudioFile(f)
                      if (f) setListeningAudioUrl('')
                    }}
                  />
                  <span className="text-xs text-purple-600 font-medium flex-shrink-0">
                    {listeningAudioFile ? 'Cambiar' : 'Elegir'}
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">o</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* URL externa */}
              <div>
                <label className="label text-xs mb-1">URL del audio (Google Drive, Dropbox, etc.)</label>
                <input
                  type="url"
                  value={listeningAudioUrl}
                  onChange={e => { setListeningAudioUrl(e.target.value); setListeningAudioFile(null) }}
                  placeholder="https://drive.google.com/..."
                  className="input text-sm"
                />
              </div>

              {/* Preview del audio si hay URL */}
              {listeningAudioUrl.trim() && (
                <audio controls className="w-full rounded-lg" src={listeningAudioUrl.trim()}>
                  Tu navegador no soporta audio.
                </audio>
              )}
            </div>
          </div>

          {/* Preguntas */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preguntas</p>
            {listeningQuestions.map((lq, i) => (
              <div key={lq.id} className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 mt-2 w-4 flex-shrink-0">{i + 1}</span>
                  <textarea
                    rows={2}
                    value={lq.body}
                    onChange={e => setListeningQuestions(prev => prev.map((x, j) => j === i ? { ...x, body: e.target.value } : x))}
                    placeholder="Ej: It's hot where Dimitra is staying now."
                    className="textarea text-sm flex-1"
                  />
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <select
                      value={lq.q_type}
                      onChange={e => setListeningQuestions(prev => prev.map((x, j) =>
                        j === i ? { ...x, q_type: e.target.value as any } : x
                      ))}
                      className="input text-xs w-36"
                    >
                      <option value="true_false">True / False</option>
                      <option value="multiple_choice">Múltiple opción</option>
                      <option value="short_answer">Respuesta corta</option>
                    </select>
                    <button
                      onClick={() => setListeningQuestions(prev => prev.filter((_, j) => j !== i))}
                      disabled={listeningQuestions.length <= 1}
                      className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-20 text-right"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {/* True / False */}
                {lq.q_type === 'true_false' && (
                  <div className="pl-6 flex gap-4">
                    {['True', 'False'].map((opt, oi) => (
                      <button
                        key={oi}
                        onClick={() => setListeningQuestions(prev => prev.map((x, j) => j === i ? { ...x, correct: oi } : x))}
                        className={`flex items-center gap-1.5 text-sm px-3 py-1 rounded-lg border-2 transition-colors ${
                          lq.correct === oi
                            ? 'border-green-500 bg-green-50 text-green-700 font-medium'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {lq.correct === oi && (
                          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                            <path d="M2 5l2 2L8 2.5"/>
                          </svg>
                        )}
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Múltiple opción */}
                {lq.q_type === 'multiple_choice' && (
                  <div className="pl-6 space-y-1.5">
                    {lq.options.slice(0, 4).map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button
                          onClick={() => setListeningQuestions(prev => prev.map((x, j) => j === i ? { ...x, correct: oi } : x))}
                          className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                            lq.correct === oi ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {lq.correct === oi && (
                            <svg viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth={2} className="h-2 w-2">
                              <path d="M1.5 4l2 2L6.5 2"/>
                            </svg>
                          )}
                        </button>
                        <input
                          type="text"
                          value={opt}
                          onChange={e => setListeningQuestions(prev => prev.map((x, j) =>
                            j === i ? { ...x, options: x.options.map((o, k) => k === oi ? e.target.value : o) } : x
                          ))}
                          placeholder={`Opción ${String.fromCharCode(65 + oi)}`}
                          className={`input text-xs flex-1 ${lq.correct === oi ? 'border-green-200 bg-green-50' : ''}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Respuesta corta */}
                {lq.q_type === 'short_answer' && (
                  <div className="pl-6">
                    <input
                      type="text"
                      value={lq.answer}
                      onChange={e => setListeningQuestions(prev => prev.map((x, j) => j === i ? { ...x, answer: e.target.value } : x))}
                      placeholder="Respuesta correcta (referencia del docente)"
                      className="input text-xs w-full"
                    />
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={() => setListeningQuestions(prev => [...prev, {
                id: uid(), body: '', q_type: 'true_false', options: ['True', 'False'], correct: 0, answer: ''
              }])}
              className="text-xs text-purple-600 hover:text-purple-800"
            >
              + Agregar pregunta
            </button>
          </div>
        </div>
      )}

      {/* WRITING */}
      {exType === 'writing' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preguntas guía (opcionales)</p>
            {writingPrompts.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-4">•</span>
                <input type="text" value={p}
                  onChange={e => setWritingPrompts(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                  placeholder={`Pregunta guía ${i + 1}`} className="input text-sm flex-1" />
                <button onClick={() => setWritingPrompts(prev => prev.filter((_, j) => j !== i))}
                  disabled={writingPrompts.length <= 1}
                  className="text-gray-300 hover:text-red-500 disabled:opacity-20">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
                    <path d="M4 8h8"/>
                  </svg>
                </button>
              </div>
            ))}
            <button onClick={() => setWritingPrompts(prev => [...prev, ''])}
              className="text-xs text-purple-600 hover:text-purple-800">
              + Agregar pregunta guía
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="label text-xs mb-1">Cantidad de palabras</label>
              <input type="text" value={writingWordCount}
                onChange={e => setWritingWordCount(e.target.value)}
                placeholder="60–80" className="input text-sm" />
            </div>
            <div className="flex-1">
              <label className="label text-xs mb-1">Puntos totales</label>
              <input type="number" min={1} max={20} value={points * 5}
                onChange={e => setPoints((parseFloat(e.target.value) || 5) / 5)}
                className="input text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button onClick={() => setStep('type')} className="btn-outline text-sm flex-1">
          ← Cambiar tipo
        </button>
        <button
          onClick={handleAdd}
          disabled={previewCount === 0}
          className="btn-brand text-sm flex-1 disabled:opacity-40"
        >
          + Agregar {previewCount > 0 ? previewCount : ''} pregunta{previewCount !== 1 ? 's' : ''} →
        </button>
      </div>
    </div>
  )
}
