'use client'

// components/coordinator/EditEvaluationClient.tsx
// Formulario para editar un borrador de evaluación existente.
//
// Antes este archivo tenía su propio editor de preguntas, mucho más simple que
// el de "Nueva evaluación" (app/coordinator/evaluations/new/page.tsx): le
// faltaba el panel "+ Agregar ejercicio" (ExerciseEditor, con Match, Put in
// order, Choose/Underline, Find the error, Complete, Active→Passive, Writing,
// Reading, Listening), el botón de Speaking, el selector de skill por
// pregunta, y la agrupación visual con la consigna de bloque. Además, al
// guardar perdía silenciosamente los campos skill/keywords/speaking_time_sec
// de preguntas ya existentes porque el insert no los incluía. Todo esto se
// alinea acá con new/page.tsx para que sea el mismo editor en los dos lugares.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CEFR_LEVELS, toDatetimeLocalValue, fromDatetimeLocalValue } from '@/lib/utils'
import type { QuestionType } from '@/types'
import { useConfirm } from '@/hooks/useConfirm'
import QuestionBankPage from '@/components/shared/QuestionBankPage'
import ExerciseEditor from '@/components/coordinator/ExerciseEditor'

interface Option { id: string; body: string; is_correct: boolean }
interface QuestionDraft {
  id:                string
  q_type:            QuestionType
  body:              string
  points:            number
  skill:             string
  options:           Option[]
  expected_answer?:  string
  keywords?:         string
  speaking_time_sec?: number
  instruction?:      string   // consigna del bloque — solo vive en el primer ítem del grupo
  groupId?:          string   // agrupa preguntas creadas juntas por el editor de ejercicios
}

interface Props {
  evaluation: any
  questions:  any[]
  backHref:   string
}

const genId = () => Math.random().toString(36).slice(2, 10)

const EVAL_TYPES = [
  { value: 'multiple_choice', label: 'Opción múltiple' },
  { value: 'open',            label: 'Respuesta abierta' },
  { value: 'mixed',           label: 'Mixto' },
  { value: 'listening',       label: 'Listening' },
  { value: 'speaking',        label: 'Speaking' },
]

const SKILL_COLOR: Record<string, string> = {
  grammar: '#642f8d', vocabulary: '#0f6e56', reading: '#185fa5',
  writing: '#854f0b', listening: '#993556',
}

// La consigna de un bloque de ejercicio no tiene columna propia en `questions`,
// así que viaja embebida en el enunciado de la primera pregunta del grupo con
// el prefijo "📌 " (mismo convenio que new/page.tsx). Al cargar desde la DB
// hay que separarla de nuevo para poder mostrarla y editarla como bloque.
function splitInstruction(raw: string): { instruction?: string; body: string } {
  const m = /^📌 (.*?)\n\n([\s\S]*)$/.exec(raw ?? '')
  if (!m) return { body: raw ?? '' }
  return { instruction: m[1], body: m[2] }
}

export default function EditEvaluationClient({ evaluation: ev, questions: dbQs, backHref }: Props) {
  const router   = useRouter()
  const supabase = createClient()
  const { confirm, ConfirmDialogNode } = useConfirm()

  // Pre-cargar datos existentes
  const [title,       setTitle]       = useState(ev.title ?? '')
  const [cefrLevel,   setCefrLevel]   = useState(String(ev.cefr_level_id ?? ''))
  const [evalType,    setEvalType]    = useState(ev.eval_type ?? 'multiple_choice')
  const [timeLimit,   setTimeLimit]   = useState(ev.time_limit_min ?? 30)
  const [passScore,   setPassScore]   = useState(ev.pass_score ?? 60)
  const [availFrom,   setAvailFrom]   = useState(toDatetimeLocalValue(ev.available_from))
  const [availUntil,  setAvailUntil]  = useState(toDatetimeLocalValue(ev.available_until))
  const [description, setDescription] = useState(ev.description ?? '')
  const [instructions, setInstructions] = useState(ev.instructions ?? '')

  // Convertir preguntas de DB al formato del builder
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    dbQs.map(q => {
      const { instruction, body } = splitInstruction(q.body ?? '')
      return {
        id:                q.id,
        db_id:             q.id,
        q_type:            q.q_type,
        body,
        instruction,
        points:            q.points ?? 1,
        skill:             q.skill || 'grammar',
        expected_answer:   q.expected_answer ?? '',
        keywords:          Array.isArray(q.keywords) ? q.keywords.join(', ') : (q.keywords ?? ''),
        speaking_time_sec: q.speaking_time_sec ?? undefined,
        options:           (q.options ?? []).map((o: any) => ({
          id:         o.id,
          body:       o.body,
          is_correct: o.is_correct,
        })),
      }
    })
  )

  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [showBank,     setShowBank]     = useState(false)
  const [showExercise, setShowExercise] = useState(false)
  // El eval ya existe en DB, lo pasamos directo al banco
  const savedEvalId = ev.id

  function addQuestion(type: QuestionType) {
    const newQ: QuestionDraft = {
      id: genId(), q_type: type, body: '', points: 1, skill: 'grammar',
      options: type === 'true_false'
        ? [{ id: genId(), body: 'True', is_correct: true }, { id: genId(), body: 'False', is_correct: false }]
        : type === 'multiple_choice'
        ? [{ id: genId(), body: '', is_correct: true }, { id: genId(), body: '', is_correct: false }, { id: genId(), body: '', is_correct: false }]
        : [],
      expected_answer:   type === 'speaking' ? '' : undefined,
      keywords:          type === 'speaking' ? '' : undefined,
      speaking_time_sec: type === 'speaking' ? 60 : undefined,
    }
    setQuestions(prev => [...prev, newQ])
  }

  async function removeQuestion(id: string) {
    const ok = await confirm({ title: 'Eliminar pregunta', message: '¿Estás seguro?', confirmText: 'Eliminar', variant: 'danger' })
    if (!ok) return
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  function moveQuestion(id: string, dir: 'up' | 'down') {
    setQuestions(prev => {
      const idx  = prev.findIndex(q => q.id === id)
      const next = [...prev]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  function updateQuestion(id: string, field: Partial<QuestionDraft>) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...field } : q))
  }

  async function handleSave(status: 'draft' | 'published') {
    if (!title.trim()) { setError('El título es obligatorio.'); return }
    if (questions.length === 0) { setError('Agregá al menos una pregunta.'); return }
    // Validar que ninguna pregunta tenga dos opciones con el mismo texto —
    // el alumno no puede distinguirlas visualmente y la corrección queda ambigua.
    for (let i = 0; i < questions.length; i++) {
      const opts = questions[i].options ?? []
      const seen = new Set<string>()
      for (const o of opts) {
        const norm = (o.body ?? '').trim().toLowerCase()
        if (!norm) continue
        if (seen.has(norm)) {
          setError(`La pregunta ${i + 1} tiene dos opciones con el mismo texto ("${o.body.trim()}"). Corregilo antes de guardar — el alumno no podría distinguirlas.`)
          return
        }
        seen.add(norm)
      }
    }
    setSaving(true); setError(null)

    const sb = supabase as any

    // 1. Actualizar evaluación
    const { error: evErr } = await sb
      .from('evaluations')
      .update({
        title:           title.trim(),
        description:     description || null,
        instructions:    instructions || null,
        cefr_level_id:   cefrLevel ? parseInt(cefrLevel) : null,
        eval_type:       evalType,
        time_limit_min:  timeLimit,
        pass_score:      passScore,
        available_from:  fromDatetimeLocalValue(availFrom),
        available_until: fromDatetimeLocalValue(availUntil),
        status,
      })
      .eq('id', ev.id)

    if (evErr) { setError('Error al guardar: ' + evErr.message); setSaving(false); return }

    // 2. Eliminar preguntas anteriores y recrear
    await sb.from('questions').delete().eq('evaluation_id', ev.id)

    let saveErrors = 0
    let lastSaveErrMsg = ''

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      // Misma convención que new/page.tsx: la consigna del bloque (si existe)
      // se antepone al body recién acá, al persistir.
      const bodyToSave = q.instruction?.trim()
        ? `📌 ${q.instruction.trim()}\n\n${q.body.trim()}`
        : q.body.trim()
      const { data: savedQ, error: qErr } = await sb
        .from('questions')
        .insert({
          evaluation_id:      ev.id,
          sort_order:         i + 1,
          q_type:             q.q_type,
          body:               bodyToSave,
          points:             q.points,
          skill:              q.skill || 'grammar',
          expected_answer:    q.expected_answer || null,
          keywords:           q.keywords ? q.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : null,
          speaking_time_sec:  q.speaking_time_sec ?? null,
        })
        .select('id')
        .single()

      if (qErr || !savedQ) {
        saveErrors++
        lastSaveErrMsg = qErr?.message ?? 'Error al guardar la pregunta.'
        console.error(`SUPABASE QUESTION UPDATE ERROR (pregunta ${i + 1}):`, JSON.stringify(qErr))
        continue
      }

      if (q.options.length > 0) {
        const { error: optErr } = await sb.from('options').insert(
          q.options.map((o, oi) => ({
            question_id: savedQ.id,
            body:        o.body.trim() || o.body,
            is_correct:  o.is_correct,
            sort_order:  oi + 1,
          }))
        )
        if (optErr) {
          saveErrors++
          lastSaveErrMsg = optErr.code === '23505'
            ? `La pregunta ${i + 1} tiene opciones con texto duplicado.`
            : (optErr.message ?? 'Error al guardar las opciones.')
          console.error(`SUPABASE OPTIONS UPDATE ERROR (pregunta ${i + 1}):`, JSON.stringify(optErr))
        }
      }
    }

    if (saveErrors > 0) {
      setError(`Se guardó la evaluación pero hubo un problema con ${saveErrors} pregunta${saveErrors > 1 ? 's' : ''}: ${lastSaveErrMsg}. Revisá antes de salir.`)
      setSaving(false)
      return
    }

    // Redirigir según rol
    const { data: roleData } = await sb.from('profiles').select('role_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single()
    const isDirector = roleData?.role_id === 1
    router.push(isDirector ? '/director/evaluations' : '/coordinator/evaluations')
    router.refresh()
  }

  const total = questions.reduce((s, q) => s + q.points, 0)

  // Agrupar preguntas por groupId para mostrar la consigna de bloque una sola
  // vez — mismo criterio que new/page.tsx.
  const idxOf = new Map(questions.map((q, i) => [q.id, i]))
  const questionBlocks: { groupId?: string; items: QuestionDraft[] }[] = []
  for (const q of questions) {
    if (q.groupId && questionBlocks.some(b => b.groupId === q.groupId)) continue
    if (q.groupId) {
      questionBlocks.push({ groupId: q.groupId, items: questions.filter(x => x.groupId === q.groupId) })
    } else {
      questionBlocks.push({ items: [q] })
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <a href={backHref} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5">
              <path d="M12 4L6 10l6 6"/>
            </svg>
          </a>
          <h1 className="text-[15px] font-semibold text-gray-900">Editar evaluación</h1>
          <span className="badge badge-amber text-xs">Borrador</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleSave('draft')} disabled={saving} className="btn-outline">
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button onClick={() => handleSave('published')} disabled={saving} className="btn-brand">
            {saving ? 'Publicando…' : 'Publicar evaluación'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Datos de la evaluación</h2>

            <div>
              <label className="label">Título *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="ej: Grammar Test B1 — Unit 4" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Nivel CEFR</label>
                <select value={cefrLevel} onChange={e => setCefrLevel(e.target.value)} className="input">
                  <option value="">Sin nivel</option>
                  {CEFR_LEVELS.map((l, i) => <option key={l} value={i + 1}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tipo</label>
                <select value={evalType} onChange={e => setEvalType(e.target.value)} className="input">
                  {EVAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tiempo límite (minutos)</label>
                <input type="number" min={5} value={timeLimit} onChange={e => setTimeLimit(+e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Nota de aprobación (%)</label>
                <input type="number" min={1} max={100} value={passScore} onChange={e => setPassScore(+e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Disponible desde</label>
                <input type="datetime-local" value={availFrom} onChange={e => setAvailFrom(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Disponible hasta</label>
                <input type="datetime-local" value={availUntil} onChange={e => setAvailUntil(e.target.value)} className="input" />
              </div>
            </div>

            <div>
              <label className="label">Descripción (opcional)</label>
              <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Descripción breve de la evaluación" className="textarea" />
            </div>

            <div>
              <label className="label">Instrucciones para el alumno</label>
              <textarea rows={3} value={instructions} onChange={e => setInstructions(e.target.value)}
                placeholder="Leé cada pregunta con atención. Tenés X minutos para completar el examen." className="textarea" />
            </div>
          </div>

          {/* Preguntas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Preguntas ({questions.length})</h2>
            </div>

            {questionBlocks.map(block => (
              <div
                key={block.groupId ?? block.items[0].id}
                className={block.groupId && block.items.length > 1
                  ? 'rounded-2xl border-2 border-purple-200 bg-purple-50/30 p-3 space-y-3'
                  : 'contents'}
              >
                {/* Consigna del bloque — una sola vez, aplica a todas las preguntas de abajo */}
                {block.groupId && block.items[0].instruction !== undefined && (
                  <div className="rounded-xl border border-purple-300 bg-white px-3 py-2 flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">📌</span>
                    <div className="flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-purple-600 mb-1">
                        Consigna del bloque — aplica a {block.items.length} pregunta{block.items.length !== 1 ? 's' : ''} de abajo
                      </p>
                      <textarea
                        rows={2}
                        value={block.items[0].instruction}
                        onChange={e => updateQuestion(block.items[0].id, { instruction: e.target.value })}
                        className="w-full text-sm text-purple-900 bg-transparent border-0 resize-none focus:outline-none focus:ring-1 focus:ring-purple-200 rounded px-1 -mx-1"
                      />
                    </div>
                  </div>
                )}

                {block.items.map(q => {
                  const qi = idxOf.get(q.id)!
                  return (
              <div key={q.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ background: '#642f8d' }}>{qi + 1}</span>
                    <span className="text-xs font-medium text-gray-500">
                      {q.q_type === 'multiple_choice' ? 'Opción múltiple'
                        : q.q_type === 'true_false' ? 'Verdadero/Falso'
                        : q.q_type === 'short_answer' ? 'Respuesta corta'
                        : q.q_type === 'speaking' ? '🎙 Speaking'
                        : 'Essay'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => moveQuestion(q.id, 'up')} disabled={qi === 0}
                      className="text-gray-300 hover:text-gray-500 disabled:opacity-20">↑</button>
                    <button onClick={() => moveQuestion(q.id, 'down')} disabled={qi === questions.length - 1}
                      className="text-gray-300 hover:text-gray-500 disabled:opacity-20">↓</button>
                    <button onClick={() => removeQuestion(q.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <textarea
                      rows={2}
                      value={q.body}
                      onChange={e => updateQuestion(q.id, { body: e.target.value })}
                      className="textarea"
                      placeholder="Escribí la pregunta aquí…"
                    />
                  </div>
                  <div className="w-20">
                    <label className="label">Puntos</label>
                    <input type="number" min={0.5} step={0.5} value={q.points}
                      onChange={e => updateQuestion(q.id, { points: +e.target.value })}
                      className="input text-center" />
                  </div>
                </div>

                {/* Opciones MC/VF */}
                {(q.q_type === 'multiple_choice' || q.q_type === 'true_false') && (
                  <div className="space-y-2 pl-2">
                    <p className="text-xs font-medium text-gray-500">Opciones (marcá la correcta)</p>
                    {q.options.map((opt, oi) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuestion(q.id, {
                            options: q.options.map((o, j) => ({ ...o, is_correct: j === oi })),
                          })}
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs transition-all ${opt.is_correct ? 'border-[#642f8d] text-white' : 'border-gray-300 text-gray-400 hover:border-[#642f8d]'}`}
                          style={opt.is_correct ? { background: '#642f8d' } : {}}
                        >
                          {String.fromCharCode(65 + oi)}
                        </button>
                        {q.q_type === 'true_false' ? (
                          <span className="text-sm text-gray-700">{opt.body}</span>
                        ) : (
                          <input type="text" value={opt.body}
                            onChange={e => updateQuestion(q.id, {
                              options: q.options.map((o, j) => j === oi ? { ...o, body: e.target.value } : o),
                            })}
                            placeholder={`Opción ${String.fromCharCode(65 + oi)}`} className="input flex-1" />
                        )}
                      </div>
                    ))}
                    {q.q_type === 'multiple_choice' && q.options.length < 5 && (
                      <button className="text-xs text-gray-400 hover:text-gray-600"
                        onClick={() => updateQuestion(q.id, { options: [...q.options, { id: genId(), body: '', is_correct: false }] })}>
                        + Agregar opción
                      </button>
                    )}
                  </div>
                )}

                {/* Selector de skill */}
                <div className="flex items-center gap-2 flex-wrap pl-2">
                  <label className="text-xs text-gray-400 flex-shrink-0">Skill:</label>
                  {(['grammar','vocabulary','reading','writing','listening'] as const).map(sk => (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => updateQuestion(q.id, { skill: sk })}
                      className="text-[11px] px-2 py-0.5 rounded-full border transition-all capitalize"
                      style={
                        (q.skill || 'grammar') === sk
                          ? { backgroundColor: SKILL_COLOR[sk] ?? '#642f8d', color: '#fff', borderColor: 'transparent' }
                          : { backgroundColor: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }
                      }
                    >
                      {sk}
                    </button>
                  ))}
                </div>

                {(q.q_type === 'short_answer' || q.q_type === 'essay') && (
                  <p className="text-xs text-gray-400 pl-2 italic">
                    {q.q_type === 'short_answer' ? 'Respuesta corta — corrección manual' : 'Essay — corrección manual'}
                  </p>
                )}

                {q.q_type === 'speaking' && (
                  <div className="space-y-3 pl-2">
                    <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-xs text-purple-700">
                      🎙 El alumno grabará su respuesta en voz alta.
                    </div>
                    <div>
                      <label className="label">Respuesta modelo</label>
                      <textarea rows={2} value={q.expected_answer ?? ''}
                        onChange={e => updateQuestion(q.id, { expected_answer: e.target.value })}
                        placeholder="Ej: I usually wake up at 7am…" className="textarea" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Keywords (separadas por coma)</label>
                        <input type="text" value={q.keywords ?? ''}
                          onChange={e => updateQuestion(q.id, { keywords: e.target.value })}
                          placeholder="Ej: usually, every day, work" className="input" />
                      </div>
                      <div>
                        <label className="label">Tiempo límite (segundos)</label>
                        <input type="number" min={15} max={300} step={15} value={q.speaking_time_sec ?? 60}
                          onChange={e => updateQuestion(q.id, { speaking_time_sec: +e.target.value })} className="input" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
                  )
                })}
              </div>
            ))}

            {/* ── Barra de botones ── */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setShowExercise(p => !p); setShowBank(false) }}
                className={`btn-brand flex items-center gap-1.5 ${showExercise ? 'opacity-80' : ''}`}
              >
                {showExercise ? '✕ Cerrar editor' : '+ Agregar ejercicio'}
              </button>

              <button onClick={() => addQuestion('speaking' as QuestionType)} className="btn-outline">
                🎙 + Speaking
              </button>

              <button
                onClick={() => setShowBank(p => !p)}
                className={`btn-outline text-sm flex items-center gap-1.5 ${showBank ? 'ring-2 ring-purple-300' : ''}`}
              >
                📚 {showBank ? 'Cerrar banco' : 'Agregar desde banco'}
              </button>

              {(['multiple_choice','true_false','short_answer','essay'] as QuestionType[]).map(t => (
                <button key={t} onClick={() => addQuestion(t)} className="btn-outline text-sm">
                  + {t === 'multiple_choice' ? 'Opción múltiple' : t === 'true_false' ? 'V/F' : t === 'short_answer' ? 'Respuesta corta' : 'Essay'}
                </button>
              ))}
            </div>

            {/* Panel editor de ejercicios — el mismo que usa "Nueva evaluación" */}
            {showExercise && (
              <div className="border-2 border-purple-200 rounded-2xl bg-purple-50/20 p-4">
                <ExerciseEditor
                  onAdd={(qs, instruction) => {
                    const groupId = genId()
                    const trimmedInstruction = instruction.trim()
                    const drafted: QuestionDraft[] = qs.map((q, i) => ({
                      id:      genId(),
                      q_type:  q.q_type as QuestionType,
                      body:    q.body,
                      points:  q.points,
                      skill:   (q as any).skill || 'grammar',
                      options: q.options.map(o => ({ id: genId(), body: o.body, is_correct: o.is_correct })),
                      expected_answer: q.explanation || undefined,
                      groupId,
                      instruction: (trimmedInstruction && i === 0) ? trimmedInstruction : undefined,
                    }))
                    setQuestions(prev => [...prev, ...drafted])
                    setShowExercise(false)
                  }}
                  onCancel={() => setShowExercise(false)}
                />
              </div>
            )}

            {/* Banco de preguntas inline */}
            {showBank && (
              <div className="border border-purple-200 rounded-2xl bg-purple-50/30 p-4">
                <p className="text-xs text-purple-700 font-medium mb-3">
                  Seleccioná las preguntas y hacé click en "+ Agregar" para incorporarlas.
                </p>
                <QuestionBankPage
                  evaluationId={savedEvalId}
                  onAdded={() => {
                    setShowBank(false)
                    // Recargar página para mostrar las preguntas nuevas
                    window.location.reload()
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar resumen */}
        <aside className="w-[200px] flex-shrink-0 border-l border-gray-200 bg-white p-4 space-y-4 overflow-y-auto">
          <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Resumen</h3>
          <div className="card-sm"><p className="text-xs text-gray-500">Preguntas</p><p className="text-lg font-semibold">{questions.length}</p></div>
          <div className="card-sm"><p className="text-xs text-gray-500">Puntaje total</p><p className="text-lg font-semibold">{total} pts</p></div>
          <div className="mt-6 space-y-2">
            <button onClick={() => handleSave('draft')} disabled={saving} className="btn-outline w-full justify-center text-sm">Guardar borrador</button>
            <button onClick={() => handleSave('published')} disabled={saving} className="btn-brand w-full justify-center text-sm">Publicar</button>
          </div>
        </aside>
      </div>
      {ConfirmDialogNode}
    </div>
  )
}
