'use client'

// components/coordinator/ImportReviewClient.tsx
// Pantalla de revisión post-importación de PDF
// Permite editar preguntas, marcar respuestas correctas, eliminar y guardar al banco

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Badge from '@/components/ui/Badge'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Option {
  body:       string
  is_correct: boolean
}

interface Question {
  id:               string   // UUID local para tracking
  body:             string
  q_type:           'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
  skill:            string
  difficulty_label: 'easy' | 'medium' | 'hard'
  difficulty_score: number
  topic:            string | null
  explanation:      string | null
  options:          Option[]
  points:           number
  // meta del importador
  instruction?:     string
  section?:         string
  // estado UI
  _expanded:        boolean
  _error?:          string
}

interface ImportReviewClientProps {
  initialQuestions: Omit<Question, 'id' | 'points' | '_expanded'>[]
  evaluationId?:    string   // si se importa directo a una evaluación
  orgId:            string
  cefrLevel:        string | null
  publisher:        string | null
  onComplete?:      () => void
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

const Q_TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Múltiple opción',
  true_false:      'V / F',
  short_answer:    'Respuesta corta',
  essay:           'Redacción',
}

const SKILL_LABEL: Record<string, string> = {
  grammar:    'Grammar',
  vocabulary: 'Vocabulary',
  reading:    'Reading',
  writing:    'Writing',
  listening:  'Listening',
  speaking:   'Speaking',
}

const SKILL_COLOR: Record<string, string> = {
  grammar:    '#642f8d',
  vocabulary: '#0f6e56',
  reading:    '#185fa5',
  writing:    '#854f0b',
  listening:  '#993556',
  speaking:   '#993c1d',
}

const DIFF_BADGE: Record<string, 'green' | 'amber' | 'red'> = {
  easy:   'green',
  medium: 'amber',
  hard:   'red',
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ImportReviewClient({
  initialQuestions,
  evaluationId,
  orgId,
  cefrLevel,
  publisher,
  onComplete,
}: ImportReviewClientProps) {
  const router   = useRouter()
  const supabase = createClient() as any

  const [questions, setQuestions] = useState<Question[]>(() =>
    initialQuestions.map(q => ({
      ...q,
      id:        uid(),
      points:    q.q_type === 'essay' ? 5 : 1,
      _expanded: false,
    }))
  )

  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [filter,    setFilter]    = useState<string>('all')  // 'all' | skill
  const [selectAll, setSelectAll] = useState(true)
  const [selected,  setSelected]  = useState<Set<string>>(() => new Set(initialQuestions.map((_, i) => String(i))))

  // Inicializar selected con todos los IDs reales
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const s = new Set<string>()
    initialQuestions.forEach((_, i) => s.add(String(i)))
    return s
  })

  // Usar IDs locales para selected
  const [sel, setSel] = useState<Set<string>>(() => {
    const s = new Set<string>()
    return s
  })

  // Re-inicializar con IDs reales tras mount
  const allIds = questions.map(q => q.id)

  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(questions.map(q => q.id))
  )

  // ── Filtros ──
  const skills     = [...new Set(questions.map(q => q.skill))]
  const filtered   = filter === 'all' ? questions : questions.filter(q => q.skill === filter)
  const checkedCnt = checkedIds.size

  // ── Mutaciones ──

  function toggleCheck(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (checkedIds.size === questions.length) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(questions.map(q => q.id)))
    }
  }

  function toggleExpand(id: string) {
    setQuestions(prev => prev.map(q =>
      q.id === id ? { ...q, _expanded: !q._expanded } : q
    ))
  }

  function removeQuestion(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id))
    setCheckedIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  function updateQuestion(id: string, patch: Partial<Question>) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q))
  }

  function setCorrectOption(qId: string, optIdx: number) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q
      return {
        ...q,
        options: q.options.map((o, i) => ({ ...o, is_correct: i === optIdx })),
      }
    }))
  }

  function updateOptionBody(qId: string, optIdx: number, body: string) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q
      return {
        ...q,
        options: q.options.map((o, i) => i === optIdx ? { ...o, body } : o),
      }
    }))
  }

  function addOption(qId: string) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q
      return { ...q, options: [...q.options, { body: '', is_correct: false }] }
    }))
  }

  function removeOption(qId: string, optIdx: number) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q
      const opts = q.options.filter((_, i) => i !== optIdx)
      // Si la correcta fue eliminada, marcar la primera
      const hasCorrect = opts.some(o => o.is_correct)
      return {
        ...q,
        options: hasCorrect ? opts : opts.map((o, i) => ({ ...o, is_correct: i === 0 })),
      }
    }))
  }

  // ── Guardar al banco ──

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    const toSave = questions.filter(q => checkedIds.has(q.id))
    if (toSave.length === 0) {
      setSaveError('No hay preguntas seleccionadas.')
      setSaving(false)
      return
    }

    let savedCount = 0

    for (const q of toSave) {
      // Validaciones
      if (q.q_type === 'multiple_choice' && q.options.length < 2) {
        updateQuestion(q.id, { _error: 'Necesita al menos 2 opciones.' })
        continue
      }
      if (q.q_type === 'multiple_choice' && !q.options.some(o => o.is_correct)) {
        updateQuestion(q.id, { _error: 'Marcá cuál es la respuesta correcta.' })
        continue
      }
      if (q.body.trim().length < 5) {
        updateQuestion(q.id, { _error: 'El enunciado es muy corto.' })
        continue
      }

      // INSERT en banco de preguntas
      const { data: newQ, error: qErr } = await supabase
        .from('questions')
        .insert({
          body:             q.body.trim(),
          q_type:           q.q_type,
          skill:            q.skill,
          difficulty_label: q.difficulty_label,
          difficulty_score: q.difficulty_score,
          points:           q.points,
          topic:            q.topic,
          explanation:      q.explanation,
          organization_id:  orgId,
          cefr_level:       cefrLevel,
          source_publisher: publisher,
          is_bank:          true,
        })
        .select('id')
        .single()

      if (qErr || !newQ) {
        updateQuestion(q.id, { _error: `Error al guardar: ${qErr?.message}` })
        continue
      }

      // INSERT opciones
      if (q.options.length > 0) {
        const { error: optsErr } = await supabase
          .from('options')
          .insert(
            q.options
              .filter(o => o.body.trim().length > 0)
              .map(o => ({
                question_id: newQ.id,
                body:        o.body.trim(),
                is_correct:  o.is_correct,
              }))
          )
        if (optsErr) {
          updateQuestion(q.id, { _error: `Opciones: ${optsErr.message}` })
          continue
        }
      }

      // Si se importa directo a una evaluación, vincular también
      if (evaluationId) {
        await supabase.from('evaluation_questions').insert({
          evaluation_id: evaluationId,
          question_id:   newQ.id,
          sort_order:    savedCount + 1,
        })
      }

      savedCount++
      setSaved(savedCount)
      // Marcar como guardada (quitar del listado)
      updateQuestion(q.id, { _expanded: false })
    }

    setSaving(false)

    if (savedCount > 0) {
      // Remover las guardadas del listado
      const savedQIds = toSave
        .filter(q => !q._error)
        .map(q => q.id)
      setQuestions(prev => prev.filter(q => !savedQIds.includes(q.id)))
      setCheckedIds(new Set())

      if (questions.length - savedQIds.length === 0) {
        // Todas guardadas
        if (onComplete) onComplete()
        else if (evaluationId) router.push(`/coordinator/evaluations/${evaluationId}`)
        else router.push('/coordinator/question-bank')
      }
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header de resumen ── */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Revisión de preguntas importadas
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {questions.length} pregunta{questions.length !== 1 ? 's' : ''} detectadas
              {cefrLevel ? ` · ${cefrLevel}` : ''}
              {publisher ? ` · ${publisher}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {saved > 0 && (
              <span className="badge badge-green text-xs">
                ✓ {saved} guardada{saved !== 1 ? 's' : ''}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {checkedCnt} seleccionada{checkedCnt !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleSave}
              disabled={saving || checkedCnt === 0}
              className="btn-brand text-xs py-1.5 px-4 disabled:opacity-40"
            >
              {saving ? 'Guardando…' : `Guardar ${checkedCnt > 0 ? checkedCnt : ''} al banco`}
            </button>
          </div>
        </div>

        {saveError && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            ⚠ {saveError}
          </div>
        )}

        {/* Filtros por skill */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === 'all'
                ? 'border-transparent text-white'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
            style={filter === 'all' ? { backgroundColor: '#642f8d' } : {}}
          >
            Todas ({questions.length})
          </button>
          {skills.map(s => {
            const cnt = questions.filter(q => q.skill === s).length
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filter === s ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
                style={filter === s ? { backgroundColor: SKILL_COLOR[s] ?? '#642f8d' } : {}}
              >
                {SKILL_LABEL[s] ?? s} ({cnt})
              </button>
            )
          })}
        </div>

        {/* Seleccionar todo */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <input
            type="checkbox"
            id="select-all"
            checked={checkedIds.size === questions.length && questions.length > 0}
            onChange={toggleAll}
            className="w-3.5 h-3.5 rounded accent-purple-600 cursor-pointer"
          />
          <label htmlFor="select-all" className="text-xs text-gray-500 cursor-pointer select-none">
            Seleccionar todas las visibles
          </label>
        </div>
      </div>

      {/* ── Lista de preguntas ── */}
      <div className="space-y-2">
        {filtered.map((q, idx) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={idx}
            checked={checkedIds.has(q.id)}
            onToggleCheck={() => toggleCheck(q.id)}
            onToggleExpand={() => toggleExpand(q.id)}
            onRemove={() => removeQuestion(q.id)}
            onUpdate={patch => updateQuestion(q.id, patch)}
            onSetCorrect={optIdx => setCorrectOption(q.id, optIdx)}
            onUpdateOption={(optIdx, body) => updateOptionBody(q.id, optIdx, body)}
            onAddOption={() => addOption(q.id)}
            onRemoveOption={optIdx => removeOption(q.id, optIdx)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card text-center py-10 text-gray-400 text-sm">
          No hay preguntas en esta categoría.
        </div>
      )}

      {/* ── Footer sticky ── */}
      {questions.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-100 -mx-4 md:-mx-6 px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            {checkedCnt} de {questions.length} seleccionadas
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => router.back()}
              className="btn-outline text-xs py-1.5"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || checkedCnt === 0}
              className="btn-brand text-xs py-1.5 px-5 disabled:opacity-40"
            >
              {saving
                ? `Guardando ${saved}/${checkedCnt}…`
                : `Guardar ${checkedCnt} pregunta${checkedCnt !== 1 ? 's' : ''} al banco`
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tarjeta individual de pregunta ──────────────────────────────────────────

interface QuestionCardProps {
  question:       Question
  index:          number
  checked:        boolean
  onToggleCheck:  () => void
  onToggleExpand: () => void
  onRemove:       () => void
  onUpdate:       (patch: Partial<Question>) => void
  onSetCorrect:   (optIdx: number) => void
  onUpdateOption: (optIdx: number, body: string) => void
  onAddOption:    () => void
  onRemoveOption: (optIdx: number) => void
}

function QuestionCard({
  question: q,
  index,
  checked,
  onToggleCheck,
  onToggleExpand,
  onRemove,
  onUpdate,
  onSetCorrect,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
}: QuestionCardProps) {
  const hasOptions = q.q_type === 'multiple_choice' || q.q_type === 'true_false'
  const needsReview = hasOptions && !q.options.some(o => o.is_correct)

  return (
    <div className={`card transition-all ${
      !checked ? 'opacity-60' : ''
    } ${q._error ? 'border-red-300' : ''} ${needsReview ? 'border-amber-300' : ''}`}>

      {/* ── Fila resumen ── */}
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleCheck}
          className="mt-1 w-3.5 h-3.5 rounded accent-purple-600 cursor-pointer flex-shrink-0"
        />

        {/* Número */}
        <span className="flex-shrink-0 text-xs text-gray-300 mt-0.5 w-4 text-right">
          {index + 1}
        </span>

        {/* Cuerpo */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggleExpand}>
          <p className="text-sm text-gray-900 leading-relaxed line-clamp-2">
            {q.body}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: SKILL_COLOR[q.skill] ?? '#642f8d' }}
            >
              {SKILL_LABEL[q.skill] ?? q.skill}
            </span>
            <span className="badge badge-gray text-[10px]">
              {Q_TYPE_LABEL[q.q_type]}
            </span>
            <Badge variant={DIFF_BADGE[q.difficulty_label]}>
              <span className="text-[10px]">{q.difficulty_label}</span>
            </Badge>
            {hasOptions && (
              <span className="text-[10px] text-gray-400">
                {q.options.length} opción{q.options.length !== 1 ? 'es' : ''}
              </span>
            )}
            {needsReview && (
              <span className="text-[10px] font-medium text-amber-600">
                ⚠ Marcá la correcta
              </span>
            )}
            {q._error && (
              <span className="text-[10px] font-medium text-red-600">
                ✕ {q._error}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onToggleExpand}
            className="p-1 text-gray-300 hover:text-gray-500 transition-colors"
            title="Editar"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
              {q._expanded
                ? <path d="M4 10l4-4 4 4"/>
                : <path d="M4 6l4 4 4-4"/>
              }
            </svg>
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-gray-300 hover:text-red-500 transition-colors"
            title="Eliminar"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
              <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Panel de edición expandido ── */}
      {q._expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">

          {/* Enunciado */}
          <div>
            <label className="label text-xs mb-1">Enunciado</label>
            <textarea
              rows={3}
              value={q.body}
              onChange={e => onUpdate({ body: e.target.value })}
              className="textarea text-sm"
            />
          </div>

          {/* Metadatos en fila */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label text-xs mb-1">Tipo</label>
              <select
                value={q.q_type}
                onChange={e => onUpdate({ q_type: e.target.value as Question['q_type'] })}
                className="input text-xs"
              >
                {Object.entries(Q_TYPE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs mb-1">Habilidad</label>
              <select
                value={q.skill}
                onChange={e => onUpdate({ skill: e.target.value })}
                className="input text-xs"
              >
                {Object.entries(SKILL_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs mb-1">Dificultad</label>
              <select
                value={q.difficulty_label}
                onChange={e => onUpdate({
                  difficulty_label: e.target.value as Question['difficulty_label'],
                  difficulty_score: e.target.value === 'easy' ? 25 : e.target.value === 'medium' ? 55 : 80,
                })}
                className="input text-xs"
              >
                <option value="easy">Fácil</option>
                <option value="medium">Medio</option>
                <option value="hard">Difícil</option>
              </select>
            </div>
            <div>
              <label className="label text-xs mb-1">Puntos</label>
              <input
                type="number"
                min={0.5}
                max={10}
                step={0.5}
                value={q.points}
                onChange={e => onUpdate({ points: parseFloat(e.target.value) || 1 })}
                className="input text-xs"
              />
            </div>
          </div>

          {/* Opciones (solo para multiple_choice y true_false) */}
          {(q.q_type === 'multiple_choice' || q.q_type === 'true_false') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label text-xs">Opciones — hacé clic en el círculo para marcar la correcta</label>
                {q.q_type === 'multiple_choice' && (
                  <button
                    onClick={onAddOption}
                    className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                  >
                    + Agregar opción
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {q.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {/* Selector de correcta */}
                    <button
                      onClick={() => onSetCorrect(i)}
                      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 transition-colors flex items-center justify-center ${
                        opt.is_correct
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                      title="Marcar como correcta"
                    >
                      {opt.is_correct && (
                        <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth={2} className="h-2.5 w-2.5">
                          <path d="M2 5l2.5 2.5 3.5-4"/>
                        </svg>
                      )}
                    </button>
                    {/* Texto de la opción */}
                    <input
                      type="text"
                      value={opt.body}
                      onChange={e => onUpdateOption(i, e.target.value)}
                      placeholder={`Opción ${String.fromCharCode(65 + i)}`}
                      className={`input text-sm flex-1 ${opt.is_correct ? 'border-green-300 bg-green-50' : ''}`}
                    />
                    {/* Eliminar opción */}
                    {q.q_type === 'multiple_choice' && q.options.length > 2 && (
                      <button
                        onClick={() => onRemoveOption(i)}
                        className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
                          <path d="M4 8h8"/>
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explicación opcional */}
          <div>
            <label className="label text-xs mb-1">
              Explicación / solucionario (opcional — se muestra al alumno tras corregir)
            </label>
            <input
              type="text"
              value={q.explanation ?? ''}
              onChange={e => onUpdate({ explanation: e.target.value || null })}
              placeholder="Ej: The correct answer is 'Where are you from?' because…"
              className="input text-sm"
            />
          </div>

          {/* Info de la sección original */}
          {q.instruction && (
            <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-2">
              <p className="text-[10px] font-medium text-purple-600 mb-0.5 uppercase tracking-wide">
                Instrucción original del PDF
              </p>
              <p className="text-xs text-purple-800">{q.instruction}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
