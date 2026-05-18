'use client'

// components/coordinator/EditEvaluationClient.tsx
// Formulario para editar un borrador de evaluación existente

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CEFR_LEVELS } from '@/lib/utils'
import type { QuestionType } from '@/types'
import { useConfirm } from '@/hooks/useConfirm'
import QuestionBankPage from '@/components/shared/QuestionBankPage'

interface Option { id: string; body: string; is_correct: boolean }
interface QuestionDraft {
  id:              string
  q_type:          QuestionType
  body:            string
  points:          number
  options:         Option[]
  expected_answer?: string
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
  const [availFrom,   setAvailFrom]   = useState(ev.available_from?.slice(0, 16) ?? '')
  const [availUntil,  setAvailUntil]  = useState(ev.available_until?.slice(0, 16) ?? '')
  const [description, setDescription] = useState(ev.description ?? '')
  const [instructions, setInstructions] = useState(ev.instructions ?? '')

  // Convertir preguntas de DB al formato del builder
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    dbQs.map(q => ({
      id:              q.id,
      db_id:           q.id,
      q_type:          q.q_type,
      body:            q.body ?? '',
      points:          q.points ?? 1,
      expected_answer: q.expected_answer ?? '',
      options:         (q.options ?? []).map((o: any) => ({
        id:         o.id,
        body:       o.body,
        is_correct: o.is_correct,
      })),
    }))
  )

  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [showBank,   setShowBank]   = useState(false)
  // El eval ya existe en DB, lo pasamos directo al banco
  const savedEvalId = ev.id

  function addQuestion(type: QuestionType) {
    const newQ: QuestionDraft = {
      id:      genId(),
      q_type:  type,
      body:    '',
      points:  1,
      options: type === 'true_false'
        ? [{ id: genId(), body: 'True', is_correct: true }, { id: genId(), body: 'False', is_correct: false }]
        : type === 'multiple_choice'
        ? [{ id: genId(), body: '', is_correct: true }, { id: genId(), body: '', is_correct: false }, { id: genId(), body: '', is_correct: false }]
        : [],
    }
    setQuestions(prev => [...prev, newQ])
  }

  async function removeQuestion(id: string) {
    const ok = await confirm({ title: 'Eliminar pregunta', message: '¿Estás seguro?', confirmText: 'Eliminar', variant: 'danger' })
    if (!ok) return
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  async function handleSave(status: 'draft' | 'published') {
    if (!title.trim()) { setError('El título es obligatorio.'); return }
    if (questions.length === 0) { setError('Agregá al menos una pregunta.'); return }
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
        available_from:  availFrom  || null,
        available_until: availUntil || null,
        status,
      })
      .eq('id', ev.id)

    if (evErr) { setError('Error al guardar: ' + evErr.message); setSaving(false); return }

    // 2. Eliminar preguntas anteriores y recrear
    await sb.from('questions').delete().eq('evaluation_id', ev.id)

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const { data: savedQ } = await sb
        .from('questions')
        .insert({
          evaluation_id: ev.id,
          sort_order:    i + 1,
          q_type:        q.q_type,
          body:          q.body.trim(),
          points:        q.points,
          expected_answer: q.expected_answer || null,
        })
        .select('id')
        .single()

      if (savedQ && q.options.length > 0) {
        await sb.from('options').insert(
          q.options.map((o, oi) => ({
            question_id: savedQ.id,
            body:        o.body.trim() || o.body,
            is_correct:  o.is_correct,
            sort_order:  oi + 1,
          }))
        )
      }
    }

    // Redirigir según rol
    const { data: roleData } = await sb.from('profiles').select('role_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single()
    const isDirector = roleData?.role_id === 1
    router.push(isDirector ? '/director/evaluations' : '/coordinator/evaluations')
    router.refresh()
  }

  const total = questions.reduce((s, q) => s + q.points, 0)

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

            <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Preguntas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Preguntas ({questions.length})</h2>
            </div>

            {questions.map((q, qi) => (
              <div key={q.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: '#642f8d' }}>{qi + 1}</span>
                  <div className="flex-1">
                    <textarea
                      rows={2}
                      value={q.body}
                      onChange={e => setQuestions(prev => prev.map((x, i) => i === qi ? { ...x, body: e.target.value } : x))}
                      className="textarea"
                      placeholder="Escribí la pregunta aquí…"
                    />
                  </div>
                  <button onClick={() => removeQuestion(q.id)} className="text-red-400 hover:text-red-600 text-xs mt-1">✕</button>
                </div>

                {/* Opciones MC */}
                {(q.q_type === 'multiple_choice' || q.q_type === 'true_false') && (
                  <div className="ml-9 space-y-2">
                    {q.options.map((opt, oi) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <input type="radio" checked={opt.is_correct} onChange={() =>
                          setQuestions(prev => prev.map((x, i) => i === qi ? { ...x, options: x.options.map((o, j) => ({ ...o, is_correct: j === oi })) } : x))
                        } />
                        <input type="text" value={opt.body} disabled={q.q_type === 'true_false'}
                          onChange={e => setQuestions(prev => prev.map((x, i) => i === qi ? { ...x, options: x.options.map((o, j) => j === oi ? { ...o, body: e.target.value } : o) } : x))}
                          className="input flex-1 py-1.5 text-sm"
                          placeholder={`Opción ${String.fromCharCode(65 + oi)}`}
                        />
                      </div>
                    ))}
                    {q.q_type === 'multiple_choice' && q.options.length < 5 && (
                      <button className="text-xs text-gray-400 hover:text-gray-600"
                        onClick={() => setQuestions(prev => prev.map((x, i) => i === qi ? { ...x, options: [...x.options, { id: genId(), body: '', is_correct: false }] } : x))}>
                        + Agregar opción
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Botones agregar */}
            <div className="flex flex-wrap gap-2">
              {(['multiple_choice','true_false','short_answer','essay'] as QuestionType[]).map(t => (
                <button key={t} onClick={() => addQuestion(t)} className="btn-outline text-sm">
                  + {t === 'multiple_choice' ? 'Opción múltiple' : t === 'true_false' ? 'V/F' : t === 'short_answer' ? 'Respuesta corta' : 'Essay'}
                </button>
              ))}
              <button
                onClick={() => setShowBank(p => !p)}
                className={`btn-outline text-sm flex items-center gap-1.5 ${showBank ? 'ring-2 ring-purple-300' : ''}`}
              >
                📚 {showBank ? 'Cerrar banco' : 'Agregar desde banco'}
              </button>
            </div>

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
