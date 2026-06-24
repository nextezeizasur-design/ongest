'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BankQuestion {
  id: string
  body: string
  q_type: string
  skill: string
  difficulty_label: 'easy' | 'medium' | 'hard'
  difficulty_score: number
  cefr_level: string | null
  topic: string | null
  times_used: number
  error_rate_pct: number | null
  is_verified: boolean
}

const SKILLS = [
  { value: '',           label: 'Todos los skills' },
  { value: 'grammar',    label: 'Grammar'    },
  { value: 'listening',  label: 'Listening'  },
  { value: 'reading',    label: 'Reading'    },
  { value: 'writing',    label: 'Writing'    },
  { value: 'vocabulary', label: 'Vocabulary' },
]

const DIFFICULTIES = [
  { value: '',       label: 'Toda dificultad' },
  { value: 'easy',   label: 'Básico'          },
  { value: 'medium', label: 'Intermedio'      },
  { value: 'hard',   label: 'Avanzado'        },
]

const CEFR_LEVELS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const SKILL_EMOJI: Record<string, string> = {
  grammar: '📝', listening: '🎧', reading: '📖',
  writing: '✏️', vocabulary: '📚', speaking: '🗣️',
}

const DIFF_COLOR: Record<string, string> = {
  easy:   'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  hard:   'bg-red-100 text-red-800',
}

const DIFF_LABEL: Record<string, string> = {
  easy: 'Básico', medium: 'Intermedio', hard: 'Avanzado',
}

const Q_TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Opción múltiple',
  true_false:      'V / F',
  short_answer:    'Respuesta corta',
  essay:           'Desarrollo',
}

interface Props {
  evaluationId?: string       // modo "guardar en DB" — requiere evaluación existente
  onAdded?: () => void
  onAddFromBank?: (questions: BankQuestion[]) => void  // modo "draft local" — sin guardar
}

export default function QuestionBankPage({ evaluationId, onAdded, onAddFromBank }: Props) {
  const supabase = createClient()

  const [questions, setQuestions]   = useState<BankQuestion[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [adding, setAdding]         = useState(false)
  const [addedMsg, setAddedMsg]     = useState('')

  // Filtros
  const [search, setSearch]         = useState('')
  const [skill, setSkill]           = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [cefr, setCefr]             = useState('')

  // Modal nueva pregunta
  const [showNew, setShowNew]       = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editingQ, setEditingQ]     = useState<BankQuestion | null>(null)

  async function deleteQuestion(id: string) {
    if (!window.confirm('¿Eliminar esta pregunta del banco? Esta acción no se puede deshacer.')) return
    await (supabase as any).from('question_bank').update({ is_active: false }).eq('id', id)
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (skill)      params.set('skill', skill)
    if (difficulty) params.set('difficulty', difficulty)
    if (cefr)       params.set('cefr', cefr)
    if (search)     params.set('q', search)
    params.set('limit', '40')

    const res  = await fetch(`/api/question-bank?${params}`)
    const json = await res.json()
    setQuestions(json.questions ?? [])
    setLoading(false)
  }, [skill, difficulty, cefr, search])

  useEffect(() => {
    const t = setTimeout(fetchQuestions, 300)
    return () => clearTimeout(t)
  }, [fetchQuestions])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleAddToEvaluation() {
    if (!evaluationId || selected.size === 0) return
    setAdding(true)

    const res = await fetch('/api/question-bank/copy', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        bank_question_ids: Array.from(selected),
        evaluation_id:     evaluationId,
      }),
    })
    const json = await res.json()

    setAdding(false)
    setSelected(new Set())
    setAddedMsg(`✅ ${json.copied_count} pregunta${json.copied_count !== 1 ? 's' : ''} agregada${json.copied_count !== 1 ? 's' : ''} a la evaluación`)
    setTimeout(() => setAddedMsg(''), 3000)
    onAdded?.()
  }

  function handleAddLocal() {
    if (selected.size === 0 || !onAddFromBank) return
    const selectedQs = questions.filter(q => selected.has(q.id))
    onAddFromBank(selectedQs)
    setSelected(new Set())
    setAddedMsg(`✅ ${selectedQs.length} pregunta${selectedQs.length !== 1 ? "s" : ""} agregada${selectedQs.length !== 1 ? "s" : ""}`)
    setTimeout(() => setAddedMsg(''), 3000)
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Banco de preguntas</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {questions.length} preguntas encontradas
          </p>
        </div>
        <div className="flex gap-2">
          {evaluationId && selected.size > 0 && (
            <button
              onClick={handleAddToEvaluation}
              disabled={adding}
              className="px-4 py-2 text-sm text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
              style={{ backgroundColor: '#642f8d' }}
            >
              {adding
                ? 'Agregando…'
                : `+ Agregar ${selected.size} pregunta${selected.size !== 1 ? 's' : ''}`}
            </button>
          )}
          {onAddFromBank && selected.size > 0 && (
            <button
              onClick={handleAddLocal}
              className="px-4 py-2 text-sm text-white rounded-xl hover:opacity-90 transition-opacity font-medium"
              style={{ backgroundColor: '#642f8d' }}
            >
              + Agregar {selected.size} pregunta{selected.size !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            📄 Importar PDF
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            + Nueva pregunta
          </button>
        </div>
      </div>

      {addedMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm">
          {addedMsg}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Buscar en el banco…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm flex-1 min-w-[180px] focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <select
          value={skill}
          onChange={e => setSkill(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          {SKILLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={difficulty}
          onChange={e => setDifficulty(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select
          value={cefr}
          onChange={e => setCefr(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          {CEFR_LEVELS.map(l => (
            <option key={l} value={l}>{l || 'Todo nivel'}</option>
          ))}
        </select>
      </div>

      {/* Lista de preguntas */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <p className="text-gray-400 text-sm">No se encontraron preguntas con esos filtros.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map(q => {
            const isSel = selected.has(q.id)
            return (
              <div
                key={q.id}
                onClick={() => evaluationId && toggleSelect(q.id)}
                className={`bg-white rounded-xl border transition-all p-4 ${
                  evaluationId ? 'cursor-pointer' : ''
                } ${isSel
                    ? 'border-purple-400 ring-2 ring-purple-200'
                    : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox visual */}
                  {evaluationId && (
                    <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                      isSel
                        ? 'border-purple-500 bg-purple-500'
                        : 'border-gray-300'
                    }`}>
                      {isSel && (
                        <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                          <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth={2} strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <span className="text-xs font-medium text-gray-600">
                        {SKILL_EMOJI[q.skill]} {q.skill}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFF_COLOR[q.difficulty_label]}`}>
                        {DIFF_LABEL[q.difficulty_label]}
                      </span>
                      {q.cefr_level && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {q.cefr_level}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {Q_TYPE_LABEL[q.q_type]}
                      </span>
                      {q.is_verified && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          ✓ Verificada
                        </span>
                      )}
                      {q.topic && (
                        <span className="text-xs text-gray-400 italic">{q.topic}</span>
                      )}
                    </div>

                    {/* Cuerpo */}
                    <p className="text-sm text-gray-800 leading-snug line-clamp-2">{q.body}</p>

                      {/* Botones de acción por pregunta */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-gray-400">
                            Usada {q.times_used} veces
                          </span>
                          {q.error_rate_pct !== null && (
                            <span className={`text-xs font-medium ${
                              q.error_rate_pct > 60 ? 'text-red-600' :
                              q.error_rate_pct > 30 ? 'text-amber-600' : 'text-green-600'
                            }`}>
                              {Math.round(q.error_rate_pct)}% tasa de error
                            </span>
                          )}
                          {q.error_rate_pct === null && q.times_used === 0 && (
                            <span className="text-xs text-gray-300">Sin datos de uso</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Editar */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingQ(q) }}
                            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50 transition-all"
                          >
                            ✏️ Editar
                          </button>
                          {/* Eliminar */}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id) }}
                            className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-all"
                          >
                            🗑️
                          </button>
                          {/* Agregar a evaluación */}
                          {evaluationId ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleSelect(q.id) }}
                              className={`text-xs px-3 py-1 rounded-lg font-semibold border-2 transition-all ${
                                isSel
                                  ? 'border-purple-500 text-white'
                                  : 'border-purple-300 text-purple-700 hover:border-purple-500 hover:bg-purple-50'
                              }`}
                              style={isSel ? { backgroundColor: '#642f8d', borderColor: '#642f8d' } : {}}
                            >
                              {isSel ? '✓ Seleccionada' : '+ Agregar'}
                            </button>
                          ) : onAddFromBank ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleSelect(q.id) }}
                              className={"text-xs px-3 py-1 rounded-lg font-semibold border-2 transition-all " + (
                                selected.has(q.id)
                                  ? "border-purple-500 text-white"
                                  : "border-purple-300 text-purple-700 hover:border-purple-500 hover:bg-purple-50"
                              )}
                              style={selected.has(q.id) ? { backgroundColor: '#642f8d', borderColor: '#642f8d' } : {}}
                            >
                              {selected.has(q.id) ? '✓ Seleccionada' : '+ Agregar'}
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                alert('Guardá la evaluación primero para poder agregar preguntas desde el banco.')
                              }}
                              className="text-xs px-3 py-1 rounded-lg border-2 border-gray-200 text-gray-400 cursor-not-allowed"
                              title="Guardá la evaluación primero"
                            >
                              + Agregar
                            </button>
                          )}
                        </div>
                      </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva pregunta */}
      {showNew && (
        <NewBankQuestionModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); fetchQuestions() }}
        />
      )}

      {/* Modal importar PDF */}
      {showImport && (
        <ImportPDFModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchQuestions() }}
        />
      )}

      {/* Modal editar pregunta — reutiliza NewBankQuestionModal con datos precargados */}
      {editingQ && (
        <EditBankQuestionModal
          question={editingQ}
          onClose={() => setEditingQ(null)}
          onSaved={() => { setEditingQ(null); fetchQuestions() }}
        />
      )}
    </div>
  )
}

// ── Modal importar PDF ────────────────────────────────────────
const PUBLISHERS = [
  { value: 'macmillan', label: 'Macmillan Education'       },
  { value: 'oxford',    label: 'Oxford University Press'    },
  { value: 'cambridge', label: 'Cambridge University Press' },
  { value: 'pearson',   label: 'Pearson / Longman'         },
  { value: 'other',     label: 'Otro'                      },
]

const CEFR_LIST = ['A1','A2','B1','B2','C1','C2']

interface ParsedQ {
  body: string; q_type: string; skill: string
  difficulty_label: string; difficulty_score: number
  topic: string | null; explanation: string | null
  options: { body: string; is_correct: boolean }[]
  organization_id?: string; created_by?: string
  cefr_level?: string | null; source_publisher?: string | null
  selected: boolean
}

function ImportPDFModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [publisher, setPublisher]   = useState('macmillan')
  const [cefrLevel, setCefrLevel]   = useState('B1')
  const [file, setFile]             = useState<File | null>(null)
  const [parsing, setParsing]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [parsed, setParsed]         = useState<ParsedQ[] | null>(null)
  const [error, setError]           = useState('')
  const [savedMsg, setSavedMsg]     = useState('')
  const fileRef                     = useRef<HTMLInputElement>(null)

  async function handleParse() {
    if (!file) return
    setParsing(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('cefr_level', cefrLevel)
    fd.append('publisher', publisher)
    const res  = await fetch('/api/evaluations/import', { method: 'POST', body: fd })
    const json = await res.json()
    setParsing(false)
    if (!res.ok) { setError(json.error ?? 'Error procesando el PDF.'); return }
    setParsed(json.questions.map((q: any) => ({ ...q, selected: true })))
  }

  async function handleSave() {
    if (!parsed) return
    const selected = parsed.filter(q => q.selected)
    if (selected.length === 0) return
    setSaving(true)
    const res  = await fetch('/api/evaluations/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: selected }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error ?? 'Error guardando.'); return }
    setSavedMsg(`✅ ${json.saved} pregunta${json.saved !== 1 ? 's' : ''} guardada${json.saved !== 1 ? 's' : ''} en el banco`)
    setTimeout(() => { onImported() }, 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900">Importar preguntas desde PDF</h3>
            <p className="text-xs text-gray-400 mt-0.5">Macmillan, Oxford, Cambridge, Pearson</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {!parsed ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Editorial</label>
                  <select value={publisher} onChange={e => setPublisher(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                    {PUBLISHERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Nivel CEFR</label>
                  <select value={cefrLevel} onChange={e => setCefrLevel(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                    {CEFR_LIST.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  file ? 'border-purple-400 bg-purple-50' : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
                }`}>
                <input ref={fileRef} type="file" accept="application/pdf"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} className="hidden" />
                <div className="text-4xl mb-2">📄</div>
                {file ? (
                  <>
                    <p className="font-medium text-purple-800 text-sm">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{(file.size / 1024).toFixed(0)} KB · Click para cambiar</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-gray-700 text-sm">Subí el PDF aquí</p>
                    <p className="text-xs text-gray-400 mt-0.5">Máximo 10MB</p>
                  </>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              <div className="flex gap-3">
                <button onClick={onClose}
                  className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={handleParse} disabled={!file || parsing}
                  className="flex-1 text-white rounded-xl py-2.5 text-sm hover:opacity-90 disabled:opacity-40 font-medium"
                  style={{ backgroundColor: '#642f8d' }}>
                  {parsing ? 'Analizando…' : 'Extraer preguntas'}
                </button>
              </div>
            </>
          ) : (
            <>
              {savedMsg ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="font-semibold text-gray-900">{savedMsg}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">
                      {parsed.length} preguntas detectadas
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setParsed(prev => prev!.map(q => ({ ...q, selected: true })))}
                        className="text-xs text-gray-500 hover:text-gray-700">Todas</button>
                      <button onClick={() => setParsed(prev => prev!.map(q => ({ ...q, selected: false })))}
                        className="text-xs text-gray-500 hover:text-gray-700">Ninguna</button>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
                    ⚠️ Revisá que la respuesta correcta esté marcada antes de guardar.
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {parsed.map((q, i) => (
                      <div key={i} onClick={() => setParsed(prev => prev!.map((p, j) => j === i ? { ...p, selected: !p.selected } : p))}
                        className={`border rounded-xl p-3 cursor-pointer transition-all ${
                          q.selected ? 'border-purple-400 bg-purple-50/40' : 'border-gray-200 opacity-60'
                        }`}>
                        <div className="flex items-start gap-2">
                          <div className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                            q.selected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                          }`}>
                            {q.selected && <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth={2} strokeLinecap="round"/></svg>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-1 mb-1">
                              <span className="text-xs text-gray-500">{SKILL_EMOJI[q.skill] ?? '📝'} {q.skill}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${DIFF_COLOR[q.difficulty_label] ?? ''}`}>
                                {DIFF_LABEL[q.difficulty_label] ?? q.difficulty_label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-800 line-clamp-2">{q.body}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{error}</div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => { setParsed(null); setFile(null); setError('') }}
                      className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm hover:bg-gray-50">
                      ← Volver
                    </button>
                    <button onClick={handleSave} disabled={saving || parsed.filter(q => q.selected).length === 0}
                      className="flex-1 text-white rounded-xl py-2.5 text-sm hover:opacity-90 disabled:opacity-40 font-medium"
                      style={{ backgroundColor: '#642f8d' }}>
                      {saving ? 'Guardando…' : `Guardar ${parsed.filter(q => q.selected).length} en banco`}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
function NewBankQuestionModal({
  onClose,
  onCreated,
}: { onClose: () => void; onCreated: () => void }) {
  const [body, setBody]         = useState('')
  const [qType, setQType]       = useState('multiple_choice')
  const [skill, setSkill]       = useState('grammar')
  const [diffScore, setDiffScore] = useState(50)
  const [diffLabel, setDiffLabel] = useState('medium')
  const [cefr, setCefr]         = useState('')
  const [topic, setTopic]       = useState('')
  const [explanation, setExplanation] = useState('')
  const [options, setOptions]   = useState([
    { body: '', is_correct: true  },
    { body: '', is_correct: false },
    { body: '', is_correct: false },
    { body: '', is_correct: false },
  ])
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  function handleSlider(val: number) {
    setDiffScore(val)
    setDiffLabel(val <= 33 ? 'easy' : val <= 66 ? 'medium' : 'hard')
  }

  async function handleSave() {
    if (!body.trim()) { setError('El enunciado es obligatorio.'); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/question-bank', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_body:    body.trim(),
        q_type:           qType,
        skill,
        difficulty_score: diffScore,
        difficulty_label: diffLabel,
        cefr_level:       cefr || null,
        topic:            topic || null,
        explanation:      explanation || null,
        options:          (qType === 'multiple_choice' || qType === 'true_false') ? options : [],
      }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) { setError(json.error ?? 'Error guardando.'); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Nueva pregunta en el banco</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select value={qType} onChange={e => setQType(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              <option value="multiple_choice">Opción múltiple</option>
              <option value="true_false">Verdadero / Falso</option>
              <option value="short_answer">Respuesta corta</option>
              <option value="essay">Desarrollo</option>
            </select>
          </div>

          {/* Enunciado */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Enunciado <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Escribí la pregunta…"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          {/* Opciones MC */}
          {(qType === 'multiple_choice') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Opciones (marcá la correcta)
              </label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      onClick={() => setOptions(prev =>
                        prev.map((o, j) => ({ ...o, is_correct: j === i }))
                      )}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        opt.is_correct
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-gray-300 hover:border-purple-400'
                      }`}
                    >
                      {opt.is_correct && (
                        <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                          <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth={2} strokeLinecap="round"/>
                        </svg>
                      )}
                    </button>
                    <input
                      type="text"
                      value={opt.body}
                      onChange={e => setOptions(prev =>
                        prev.map((o, j) => j === i ? { ...o, body: e.target.value } : o)
                      )}
                      placeholder={`Opción ${String.fromCharCode(65 + i)}`}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clasificación */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Skill</label>
              <select value={skill} onChange={e => setSkill(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                {SKILLS.filter(s => s.value).map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nivel CEFR</label>
              <select value={cefr} onChange={e => setCefr(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                {CEFR_LEVELS.map(l => <option key={l} value={l}>{l || 'Sin nivel'}</option>)}
              </select>
            </div>
          </div>

          {/* Dificultad */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-gray-600">Dificultad</span>
              <span className={`px-2 py-0.5 rounded-full font-medium ${DIFF_COLOR[diffLabel]}`}>
                {DIFF_LABEL[diffLabel]} ({diffScore}/100)
              </span>
            </div>
            <input type="range" min={1} max={100} value={diffScore}
              onChange={e => handleSlider(Number(e.target.value))}
              className="w-full accent-purple-600" />
          </div>

          {/* Topic y explicación */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tema</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="ej: present_simple"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Explicación</label>
              <input type="text" value={explanation} onChange={e => setExplanation(e.target.value)}
                placeholder="Explicación de la respuesta"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 text-white rounded-xl py-2.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#642f8d' }}>
              {saving ? 'Guardando…' : 'Guardar en el banco'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal editar pregunta del banco ──────────────────────────
function EditBankQuestionModal({
  question,
  onClose,
  onSaved,
}: {
  question: BankQuestion
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [body,   setBody]   = useState(question.body)
  const [skill,  setSkill]  = useState(question.skill)
  const [diff,   setDiff]   = useState(question.difficulty_label)
  const [topic,  setTopic]  = useState(question.topic ?? '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSave() {
    if (!body.trim()) { setError('El cuerpo de la pregunta es obligatorio.'); return }
    setSaving(true)
    const { error: err } = await (supabase as any)
      .from('question_bank')
      .update({
        body:             body.trim(),
        skill,
        difficulty_label: diff,
        topic:            topic.trim() || null,
      })
      .eq('id', question.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Editar pregunta</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Pregunta</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Skill</label>
              <select value={skill} onChange={e => setSkill(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                {['grammar','reading','listening','writing','vocabulary'].map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Dificultad</label>
              <select value={diff} onChange={e => setDiff(e.target.value as any)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                <option value="easy">Básico</option>
                <option value="medium">Intermedio</option>
                <option value="hard">Avanzado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Topic</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="ej: present_simple"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: '#642f8d' }}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
