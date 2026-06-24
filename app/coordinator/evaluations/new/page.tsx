'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CEFR_LEVELS } from '@/lib/utils'
import type { QuestionType, Option } from '@/types'
import QuestionDifficultyEditor from '@/components/shared/QuestionDifficultyEditor'
import QuestionBankPage from '@/components/shared/QuestionBankPage'
import ExerciseEditor from '@/components/coordinator/ExerciseEditor'
import { useConfirm } from '@/hooks/useConfirm'
import { useToast } from '@/components/shared/Toast'

interface QuestionDraft {
  id: string
  q_type: QuestionType
  body: string
  points: number
  options: { id: string; body: string; is_correct: boolean }[]
  expected_answer?: string
  keywords?: string
  speaking_time_sec?: number
}

// Pregunta importada desde PDF (antes de convertir a QuestionDraft)
interface ImportedQuestion {
  id:               string
  body:             string
  q_type:           'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
  skill:            string
  difficulty_label: 'easy' | 'medium' | 'hard'
  difficulty_score: number
  points:           number
  options:          { body: string; is_correct: boolean }[]
  instruction?:     string
  section?:         string
  _checked:         boolean
  _error?:          string
}

const genId = () => Math.random().toString(36).slice(2, 10)

const SKILL_COLOR: Record<string, string> = {
  grammar: '#642f8d', vocabulary: '#0f6e56', reading: '#185fa5',
  writing: '#854f0b', listening: '#993556',
}

const Q_TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Múltiple opción',
  true_false:      'V / F',
  short_answer:    'Respuesta corta',
  essay:           'Redacción',
}

const PUBLISHERS = [
  'Macmillan Language Hub', 'Next English Institute',
  'Oxford Solutions', 'Cambridge Prepare', 'Otro',
]

export default function NewEvaluationPage() {
  const router   = useRouter()
  const supabase = createClient()
  const toast    = useToast()
  const [redirectTo, setRedirectTo] = useState('/coordinator/evaluations')

  // Evaluation meta
  const [title,          setTitle]          = useState('')
  const [description,    setDescription]    = useState('')
  const [instructions,   setInstructions]   = useState('')
  const [cefrLevel,      setCefrLevel]      = useState('')
  const [evalType,       setEvalType]       = useState('multiple_choice')
  const [timeLimit,      setTimeLimit]      = useState(30)
  const [passScore,      setPassScore]      = useState(60)
  const [availFrom,      setAvailFrom]      = useState('')
  const [availUntil,     setAvailUntil]     = useState('')
  const [isAdaptive,     setIsAdaptive]     = useState(false)
  const [adaptiveLength, setAdaptiveLength] = useState(10)

  const [courses,         setCourses]         = useState<{ id: string; name: string }[]>([])
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [questions,       setQuestions]       = useState<QuestionDraft[]>([])
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [showBank,        setShowBank]        = useState(false)
  const [showExercise,    setShowExercise]    = useState(false)
  const [savedEvalId,     setSavedEvalId]     = useState<string | null>(null)
  const { confirm, ConfirmDialogNode } = useConfirm()

  // ── Estado del importador inline ──
  const [showImport,      setShowImport]      = useState(false)
  const [importFile,      setImportFile]      = useState<File | null>(null)
  const [importCefr,      setImportCefr]      = useState('')
  const [importPublisher, setImportPublisher] = useState('Macmillan Language Hub')
  const [importLoading,   setImportLoading]   = useState(false)
  const [importError,     setImportError]     = useState<string | null>(null)
  const [importedQs,      setImportedQs]      = useState<ImportedQuestion[] | null>(null)
  const [skillSummary,    setSkillSummary]    = useState<Record<string, number>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadCourses() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await (supabase as any)
        .from('courses').select('id, name').eq('is_active', true).order('name')
      setCourses(data ?? [])
    }
    loadCourses()
  }, [])

  useEffect(() => {
    async function detectRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await (supabase as any)
        .from('profiles').select('role_id').eq('id', user.id).single()
      if (data?.role_id === 1) setRedirectTo('/director/evaluations')
      else if (data?.role_id === 5) setRedirectTo('/teacher/evaluations')
      else setRedirectTo('/coordinator/evaluations')
    }
    detectRole()
  }, [])

  async function removeQuestion(id: string) {
    const ok = await confirm({
      title: 'Eliminar pregunta', message: '¿Estás seguro?',
      confirmText: 'Eliminar', variant: 'danger',
    })
    if (!ok) return
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  function addQuestion(type: QuestionType) {
    const newQ: QuestionDraft = {
      id: genId(), q_type: type, body: '', points: 1,
      options: type === 'true_false'
        ? [{ id: genId(), body: 'True', is_correct: true }, { id: genId(), body: 'False', is_correct: false }]
        : type === 'multiple_choice'
        ? [{ id: genId(), body: '', is_correct: true }, { id: genId(), body: '', is_correct: false },
           { id: genId(), body: '', is_correct: false }, { id: genId(), body: '', is_correct: false }]
        : [],
      expected_answer:   type === 'speaking' ? '' : undefined,
      keywords:          type === 'speaking' ? '' : undefined,
      speaking_time_sec: type === 'speaking' ? 60 : undefined,
    }
    setQuestions(prev => [...prev, newQ])
  }

  function updateQuestion(id: string, field: Partial<QuestionDraft>) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...field } : q))
  }

  function updateOption(qId: string, optId: string, field: Partial<{ body: string; is_correct: boolean }>) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q
      const opts = q.options.map(o => o.id !== optId ? o : { ...o, ...field })
      if (field.is_correct && (q.q_type === 'multiple_choice' || q.q_type === 'true_false')) {
        return { ...q, options: opts.map(o => ({ ...o, is_correct: o.id === optId })) }
      }
      return { ...q, options: opts }
    }))
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

  // ── Importador: procesar PDF ──
  async function handleImportPdf() {
    if (!importFile) { setImportError('Seleccioná un archivo PDF.'); return }
    setImportLoading(true)
    setImportError(null)

    const form = new FormData()
    form.append('file',       importFile)
    form.append('cefr_level', importCefr)
    form.append('publisher',  importPublisher)

    try {
      const res  = await fetch('/api/evaluations/import', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error ?? 'Error procesando el PDF.'); return }

      setImportedQs((data.questions ?? []).map((q: any) => ({
        ...q,
        id:       genId(),
        points:   q.q_type === 'essay' ? 5 : 1,
        _checked: true,
      })))
      setSkillSummary(data.skill_summary ?? {})
    } catch (err: any) {
      setImportError(err.message ?? 'Error de red.')
    } finally {
      setImportLoading(false)
    }
  }

  // ── Importador: agregar seleccionadas a la evaluación ──
  function handleAddImported() {
    if (!importedQs) return
    const toAdd = importedQs.filter(q => q._checked)
    const drafted: QuestionDraft[] = toAdd.map(q => ({
      id:      genId(),
      q_type:  q.q_type as QuestionType,
      body:    q.body,
      points:  q.points,
      options: q.options.map(o => ({ id: genId(), body: o.body, is_correct: o.is_correct })),
    }))
    setQuestions(prev => [...prev, ...drafted])
    // Reset importador
    setImportedQs(null)
    setImportFile(null)
    setImportCefr('')
    setShowImport(false)
    setImportError(null)
  }

  function toggleImportCheck(id: string) {
    setImportedQs(prev => prev?.map(q => q.id === id ? { ...q, _checked: !q._checked } : q) ?? null)
  }

  function setImportCorrect(qId: string, optIdx: number) {
    setImportedQs(prev => prev?.map(q => {
      if (q.id !== qId) return q
      return { ...q, options: q.options.map((o, i) => ({ ...o, is_correct: i === optIdx })) }
    }) ?? null)
  }

  function updateImportBody(id: string, body: string) {
    setImportedQs(prev => prev?.map(q => q.id === id ? { ...q, body } : q) ?? null)
  }

  // ── Save ──
  async function handleSave(status: 'draft' | 'published') {
    if (!title.trim()) { setError('El título es obligatorio.'); return }
    if (questions.length === 0) { setError('Agregá al menos una pregunta.'); return }
    // Validar que todas las preguntas tengan enunciado
    const emptyBodyIdx = questions.findIndex(q => !q.body.trim())
    if (emptyBodyIdx !== -1) {
      setError(`La pregunta ${emptyBodyIdx + 1} no tiene enunciado. Completala antes de guardar.`)
      return
    }
    setSaving(true); setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { data: profileData } = await (supabase as any)
      .from('profiles').select('organization_id').eq('id', user.id).single()
    const profile = profileData as { organization_id: string } | null
    const sb = supabase as any

    const { data: ev, error: evErr } = await sb.from('evaluations').insert({
      organization_id: profile?.organization_id,
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
      created_by:      user.id,
    }).select().single()

    if (evErr || !ev) { console.error('SUPABASE INSERT ERROR:', JSON.stringify(evErr)); setError('Error al crear evaluación: ' + (evErr?.message ?? evErr?.code ?? 'sin detalles')); setSaving(false); return }
    setSavedEvalId(ev.id)

    if (selectedCourses.length > 0) {
      await sb.from('evaluation_courses').insert(
        selectedCourses.map(courseId => ({ evaluation_id: ev.id, course_id: courseId }))
      )
    }

    let questionErrors = 0
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const { data: savedQ, error: qErr } = await sb.from('questions').insert({
        evaluation_id:     ev.id,
        sort_order:        i + 1,
        q_type:            q.q_type,
        body:              q.body.trim(),
        points:            q.points,
        expected_answer:   q.expected_answer || null,
        keywords:          q.keywords ? q.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : null,
        speaking_time_sec: q.speaking_time_sec ?? null,
      }).select().single()

      if (qErr || !savedQ) { questionErrors++; continue }
      if (q.options.length > 0) {
        await sb.from('options').insert(
          q.options.map((o: any, oi: number) => ({
            question_id: savedQ.id, body: o.body.trim() || o.body,
            is_correct: o.is_correct, sort_order: oi + 1,
          }))
        )
      }
    }

    // Si todas las preguntas fallaron, mostrar error y no redirigir
    if (questionErrors === questions.length) {
      await sb.from('evaluations').delete().eq('id', ev.id)
      setError('Error al guardar las preguntas. Verificá que todos los tipos de pregunta estén configurados correctamente.')
      setSaving(false)
      return
    }

    // ── Toast + redirect ──
    if (status === 'published') {
      toast.success('Evaluación publicada correctamente', `"${title.trim()}" ya está disponible para los alumnos.`)
    } else {
      toast.info('Borrador guardado', `"${title.trim()}" guardado como borrador.`)
    }

    // Pequeño delay para que el toast sea visible antes de navegar
    setTimeout(() => {
      router.push(redirectTo)
    }, 1200)
  }

  const importCheckedCount = importedQs?.filter(q => q._checked).length ?? 0

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <a href={redirectTo} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5">
              <path d="M12 4L6 10l6 6"/>
            </svg>
          </a>
          <h1 className="text-[15px] font-semibold text-gray-900">Nueva evaluación</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleSave('draft')} disabled={saving} className="btn-outline">
            Guardar borrador
          </button>
          <button
            onClick={async () => {
              const ok = await confirm({
                title:       'Publicar evaluación',
                message:     `¿Publicar "${title || 'esta evaluación'}"? Los alumnos asignados podrán verla y rendir el examen de inmediato.`,
                confirmText: 'Sí, publicar',
                cancelText:  'Revisar primero',
                variant:     'warning',
              })
              if (ok) handleSave('published')
            }}
            disabled={saving}
            className="btn-brand"
          >
            {saving ? 'Guardando…' : 'Publicar evaluación'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          {/* Metadata — sin cambios */}
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Datos de la evaluación</h2>
            <div>
              <label className="label">Título *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="ej: Grammar Test B1 — Unit 4" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nivel CEFR</label>
                <select value={cefrLevel} onChange={e => setCefrLevel(e.target.value)} className="select">
                  <option value="">Sin nivel</option>
                  {CEFR_LEVELS.map(l => <option key={l} value={l === 'A1' ? 1 : l === 'A2' ? 2 : l === 'B1' ? 3 : l === 'B2' ? 4 : l === 'C1' ? 5 : 6}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tipo</label>
                <select value={evalType} onChange={e => setEvalType(e.target.value)} className="select">
                  <option value="multiple_choice">Opción múltiple</option>
                  <option value="writing">Writing</option>
                  <option value="listening">Listening</option>
                  <option value="mixed">Mixto</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Tiempo límite (minutos)</label>
                <input type="number" min={5} max={180} value={timeLimit}
                  onChange={e => setTimeLimit(+e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Nota de aprobación (%)</label>
                <input type="number" min={0} max={100} value={passScore}
                  onChange={e => setPassScore(+e.target.value)} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Disponible desde</label>
                <input type="datetime-local" value={availFrom}
                  onChange={e => setAvailFrom(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Disponible hasta</label>
                <input type="datetime-local" value={availUntil}
                  onChange={e => setAvailUntil(e.target.value)} className="input" />
              </div>
            </div>

            {/* Adaptativo — deshabilitado hasta ampliar banco de preguntas */}
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-500">🧠 Evaluación Adaptativa</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                      ⏳ Próximamente
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    En desarrollo — requiere mayor volumen en el banco de preguntas
                  </p>
                </div>
                {/* Toggle deshabilitado visualmente */}
                <div className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-not-allowed rounded-full bg-gray-200 opacity-50">
                  <span className="inline-block h-5 w-5 translate-x-0 transform rounded-full bg-white shadow" />
                </div>
              </div>
            </div>

            {/* Cursos */}
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">📚 Asignar a cursos</p>
                  <p className="text-xs text-gray-400 mt-0.5">Los alumnos de los cursos seleccionados verán esta evaluación</p>
                </div>
                {selectedCourses.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: '#642f8d' }}>
                    {selectedCourses.length} seleccionado{selectedCourses.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {courses.length === 0 ? (
                <p className="text-xs text-gray-400">No hay cursos activos. <a href="/director/courses/new" className="underline" style={{ color: '#642f8d' }}>Crear uno →</a></p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {courses.map(c => {
                    const sel = selectedCourses.includes(c.id)
                    return (
                      <button key={c.id} type="button"
                        onClick={() => setSelectedCourses(prev => sel ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                        className={`text-xs px-3 py-1.5 rounded-lg border-2 font-medium transition-all ${sel ? 'border-purple-500 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                        style={sel ? { backgroundColor: '#642f8d', borderColor: '#642f8d' } : {}}>
                        {sel ? '✓ ' : ''}{c.name}
                      </button>
                    )
                  })}
                </div>
              )}
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

            {questions.map((q, idx) => (
              <div key={q.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ background: '#642f8d' }}>{idx + 1}</span>
                    <span className="text-xs font-medium text-gray-500">
                      {q.q_type === 'multiple_choice' ? 'Opción múltiple'
                        : q.q_type === 'true_false' ? 'Verdadero/Falso'
                        : q.q_type === 'short_answer' ? 'Respuesta corta'
                        : q.q_type === 'speaking' ? '🎙 Speaking'
                        : 'Essay'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => moveQuestion(q.id, 'up')} disabled={idx === 0}
                      className="text-gray-300 hover:text-gray-500 disabled:opacity-20">↑</button>
                    <button onClick={() => moveQuestion(q.id, 'down')} disabled={idx === questions.length - 1}
                      className="text-gray-300 hover:text-gray-500 disabled:opacity-20">↓</button>
                    <button onClick={() => removeQuestion(q.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <textarea value={q.body} onChange={e => updateQuestion(q.id, { body: e.target.value })}
                      placeholder="Enunciado de la pregunta…" rows={2} className="textarea" />
                  </div>
                  <div className="w-20">
                    <label className="label">Puntos</label>
                    <input type="number" min={0.5} step={0.5} value={q.points}
                      onChange={e => updateQuestion(q.id, { points: +e.target.value })}
                      className="input text-center" />
                  </div>
                </div>
                {(q.q_type === 'multiple_choice' || q.q_type === 'true_false') && (
                  <div className="space-y-2 pl-2">
                    <p className="text-xs font-medium text-gray-500">Opciones (marcá la correcta)</p>
                    {q.options.map((opt, oi) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <button onClick={() => updateOption(q.id, opt.id, { is_correct: true })}
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs transition-all ${opt.is_correct ? 'border-[#642f8d] text-white' : 'border-gray-300 text-gray-400 hover:border-[#642f8d]'}`}
                          style={opt.is_correct ? { background: '#642f8d' } : {}}>
                          {String.fromCharCode(65 + oi)}
                        </button>
                        {q.q_type === 'true_false' ? (
                          <span className="text-sm text-gray-700">{opt.body}</span>
                        ) : (
                          <input type="text" value={opt.body}
                            onChange={e => updateOption(q.id, opt.id, { body: e.target.value })}
                            placeholder={`Opción ${String.fromCharCode(65 + oi)}`} className="input flex-1" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
            ))}

            {/* ── Barra de botones ── */}
            <div className="flex flex-wrap gap-2">
              {/* Ejercicio estructurado — abre el editor */}
              <button
                onClick={() => { setShowExercise(p => !p); setShowBank(false) }}
                className={`btn-brand flex items-center gap-1.5 ${showExercise ? 'opacity-80' : ''}`}
              >
                {showExercise ? '✕ Cerrar editor' : '+ Agregar ejercicio'}
              </button>

              <button onClick={() => addQuestion('speaking' as QuestionType)} className="btn-outline">
                🎙 + Speaking
              </button>

              <button onClick={() => { setShowBank(p => !p); setShowExercise(false) }}
                className={`btn-outline flex items-center gap-1.5 ${showBank ? 'ring-2 ring-purple-300' : ''}`}>
                📚 {showBank ? 'Cerrar banco' : 'Agregar desde banco'}
              </button>
            </div>

            {/* ── Panel editor de ejercicios ── */}
            {showExercise && (
              <div className="border-2 border-purple-200 rounded-2xl bg-purple-50/20 p-4">
                <ExerciseEditor
                  onAdd={(qs, instruction) => {
                    const drafted: QuestionDraft[] = qs.map(q => ({
                      id:      genId(),
                      q_type:  q.q_type as QuestionType,
                      body:    q.body,
                      points:  q.points,
                      options: q.options.map(o => ({ id: genId(), body: o.body, is_correct: o.is_correct })),
                      expected_answer: q.explanation || undefined,
                    }))
                    setQuestions(prev => [...prev, ...drafted])
                    setShowExercise(false)
                  }}
                  onCancel={() => setShowExercise(false)}
                />
              </div>
            )}

            {/* Panel banco */}
            {showBank && (
              <div className="border border-purple-200 rounded-2xl bg-purple-50/30 p-4">
                <p className="text-xs text-purple-700 font-medium mb-3">
                  Seleccioná las preguntas del banco y hacé click en "Agregar" para incorporarlas.

                </p>
                <QuestionBankPage
                  evaluationId={savedEvalId ?? undefined}
                  onAdded={() => setShowBank(false)}
                  onAddFromBank={savedEvalId ? undefined : (bankQs) => {
                    const genId = () => Math.random().toString(36).slice(2, 10)
                    const drafted = bankQs.map((bq: any) => ({
                      id:      genId(),
                      q_type:  bq.q_type as any,
                      body:    bq.body,
                      points:  1,
                      options: (bq.options ?? []).map((o: any) => ({
                        id:         genId(),
                        body:       o.body,
                        is_correct: o.is_correct,
                      })),
                    }))
                    setQuestions(prev => [...prev, ...drafted])
                  }}
                />
              </div>
            )}

            {/* ── Panel importador inline (mantenido como fallback) ── */}
            {showImport && (
              <div className="border border-purple-200 rounded-2xl bg-purple-50/30 p-4 space-y-4">

                {/* Cabecera del panel */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Importar preguntas desde PDF</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Subí el PDF del libro o examen — las preguntas se agregan directo a esta evaluación
                    </p>
                  </div>
                  <button onClick={() => { setShowImport(false); setImportedQs(null); setImportFile(null) }}
                    className="text-gray-300 hover:text-gray-500">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
                      <path d="M4 4l8 8M12 4l-8 8"/>
                    </svg>
                  </button>
                </div>

                {/* ── Sub-paso 1: upload ── */}
                {importedQs === null && (
                  <div className="space-y-3">
                    {/* Drop zone */}
                    <div
                      className={`border-2 border-dashed rounded-xl cursor-pointer transition-colors px-4 py-5 text-center ${
                        importFile ? 'border-purple-300 bg-white' : 'border-gray-200 bg-white hover:border-purple-300'
                      }`}
                      onClick={() => fileRef.current?.click()}
                    >
                      <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) { setImportFile(f); setImportError(null) } }} />
                      {importFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg viewBox="0 0 16 16" fill="none" stroke="#642f8d" strokeWidth={1.5} className="h-5 w-5">
                            <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6z"/><path d="M9 2v4h4"/>
                          </svg>
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-900">{importFile.name}</p>
                            <p className="text-xs text-gray-400">{(importFile.size / 1024).toFixed(0)} KB · Hacé clic para cambiar</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-500">Hacé clic para subir el PDF</p>
                          <p className="text-xs text-gray-400 mt-1">Macmillan, Oxford, Cambridge, Next English · Máx. 10MB</p>
                        </div>
                      )}
                    </div>

                    {/* Opciones */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Editorial</label>
                        <select value={importPublisher} onChange={e => setImportPublisher(e.target.value)} className="input text-sm">
                          {PUBLISHERS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">Nivel CEFR (opcional)</label>
                        <div className="flex gap-1.5 flex-wrap mt-1">
                          {['', 'A1','A2','B1','B2','C1','C2'].map(l => (
                            <button key={l}
                              onClick={() => setImportCefr(l)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                importCefr === l ? 'text-white border-transparent' : 'border-gray-200 text-gray-500'
                              }`}
                              style={importCefr === l ? { backgroundColor: '#642f8d' } : {}}>
                              {l || 'Sin nivel'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {importError && (
                      <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">⚠ {importError}</div>
                    )}

                    <button onClick={handleImportPdf} disabled={!importFile || importLoading}
                      className="btn-brand w-full text-sm disabled:opacity-40">
                      {importLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Procesando PDF…
                        </span>
                      ) : 'Procesar PDF →'}
                    </button>
                  </div>
                )}

                {/* ── Sub-paso 2: revisar y seleccionar ── */}
                {importedQs !== null && (
                  <div className="space-y-3">
                    {/* Resumen */}
                    {Object.keys(skillSummary).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(skillSummary).map(([skill, cnt]) => (
                          <span key={skill} className="text-xs px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: SKILL_COLOR[skill] ?? '#642f8d' }}>
                            {skill} ({cnt})
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Seleccionar todo */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                        <input type="checkbox"
                          checked={importedQs.every(q => q._checked)}
                          onChange={() => {
                            const allChecked = importedQs.every(q => q._checked)
                            setImportedQs(prev => prev?.map(q => ({ ...q, _checked: !allChecked })) ?? null)
                          }}
                          className="w-3.5 h-3.5 rounded accent-purple-600"
                        />
                        Seleccionar todas ({importedQs.length})
                      </label>
                      <span className="text-xs text-gray-400">{importCheckedCount} seleccionadas</span>
                    </div>

                    {/* Lista de preguntas importadas */}
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {importedQs.map((q, idx) => (
                        <div key={q.id}
                          className={`bg-white rounded-xl border p-3 transition-opacity ${!q._checked ? 'opacity-50' : ''} ${
                            q.q_type === 'multiple_choice' && !q.options.some(o => o.is_correct)
                              ? 'border-amber-300' : 'border-gray-200'
                          }`}>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" checked={q._checked} onChange={() => toggleImportCheck(q.id)}
                              className="mt-0.5 w-3.5 h-3.5 rounded accent-purple-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <textarea
                                value={q.body}
                                onChange={e => updateImportBody(q.id, e.target.value)}
                                rows={2}
                                className="w-full text-xs text-gray-800 leading-relaxed bg-transparent border-0 resize-none focus:outline-none focus:ring-1 focus:ring-purple-200 rounded px-1 -mx-1"
                              />
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                                  style={{ backgroundColor: SKILL_COLOR[q.skill] ?? '#642f8d' }}>
                                  {q.skill}
                                </span>
                                <span className="badge badge-gray text-[10px]">{Q_TYPE_LABEL[q.q_type]}</span>
                                {q.q_type === 'multiple_choice' && !q.options.some(o => o.is_correct) && (
                                  <span className="text-[10px] text-amber-600 font-medium">⚠ Marcá la correcta</span>
                                )}
                              </div>

                              {/* Opciones editables */}
                              {(q.q_type === 'multiple_choice' || q.q_type === 'true_false') && q.options.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {q.options.map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-1.5">
                                      <button onClick={() => setImportCorrect(q.id, oi)}
                                        className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                          opt.is_correct ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-green-400'
                                        }`}>
                                        {opt.is_correct && (
                                          <svg viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth={2} className="h-2 w-2">
                                            <path d="M1.5 4l2 2L6.5 2"/>
                                          </svg>
                                        )}
                                      </button>
                                      <span className={`text-xs ${opt.is_correct ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                                        {opt.body || `Opción ${String.fromCharCode(65 + oi)}`}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Instrucción original */}
                              {q.instruction && (
                                <p className="text-[10px] text-purple-500 mt-1 italic">
                                  {q.section && `[${q.section}] `}{q.instruction.slice(0, 80)}{q.instruction.length > 80 ? '…' : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Botones de acción */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setImportedQs(null); setImportFile(null) }}
                        className="btn-outline text-sm flex-1">
                        ← Volver
                      </button>
                      <button
                        onClick={handleAddImported}
                        disabled={importCheckedCount === 0}
                        className="btn-brand text-sm flex-1 disabled:opacity-40"
                      >
                        + Agregar {importCheckedCount > 0 ? importCheckedCount : ''} pregunta{importCheckedCount !== 1 ? 's' : ''} →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar resumen */}
        <aside className="hidden w-64 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-4 xl:block">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Resumen</h3>
          <div className="space-y-3">
            <div className="card-sm">
              <p className="text-xs text-gray-500">Preguntas</p>
              <p className="text-xl font-semibold text-gray-900">{questions.length}</p>
            </div>
            <div className="card-sm">
              <p className="text-xs text-gray-500">Puntaje total</p>
              <p className="text-xl font-semibold text-gray-900">{questions.reduce((a, q) => a + q.points, 0)} pts</p>
            </div>
            <div className="card-sm">
              <p className="text-xs text-gray-500">Tipo</p>
              <p className="text-sm font-medium text-gray-900">
                {evalType === 'multiple_choice' ? 'Opción múltiple' : evalType === 'mixed' ? 'Mixto' : evalType}
              </p>
            </div>
            {timeLimit && (
              <div className="card-sm">
                <p className="text-xs text-gray-500">Tiempo límite</p>
                <p className="text-sm font-medium text-gray-900">{timeLimit} minutos</p>
              </div>
            )}
            {isAdaptive && (
              <div className="card-sm" style={{ borderLeft: '3px solid #642f8d' }}>
                <p className="text-xs text-gray-500">Modo</p>
                <p className="text-sm font-medium" style={{ color: '#642f8d' }}>🧠 Adaptativo</p>
                <p className="text-xs text-gray-400">{adaptiveLength} preguntas</p>
              </div>
            )}
          </div>
          <div className="mt-6 space-y-2">
            <button onClick={() => handleSave('draft')} disabled={saving} className="btn-outline w-full justify-center">
              Guardar borrador
            </button>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title:       'Publicar evaluación',
                  message:     `¿Publicar "${title || 'esta evaluación'}"? Los alumnos asignados podrán verla y rendir el examen de inmediato.`,
                  confirmText: 'Sí, publicar',
                  cancelText:  'Revisar primero',
                  variant:     'warning',
                })
                if (ok) handleSave('published')
              }}
              disabled={saving}
              className="btn-brand w-full justify-center"
            >
              Publicar
            </button>
          </div>
        </aside>
      </div>
      {ConfirmDialogNode}
    </div>
  )
}
