'use client'

// components/coordinator/QuestionDifficultyEditor.tsx
// Se integra en el builder de evaluaciones para configurar
// dificultad, skill y topic de cada pregunta

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  questionId: string
  initialDifficulty?: number
  initialLabel?: 'easy' | 'medium' | 'hard'
  initialSkill?: string
  initialTopic?: string
  onSaved?: () => void
}

const SKILLS = [
  { value: 'grammar',    label: 'Grammar',    emoji: '📝' },
  { value: 'listening',  label: 'Listening',  emoji: '🎧' },
  { value: 'reading',    label: 'Reading',    emoji: '📖' },
  { value: 'writing',    label: 'Writing',    emoji: '✏️'  },
  { value: 'speaking',   label: 'Speaking',   emoji: '🗣️' },
  { value: 'vocabulary', label: 'Vocabulary', emoji: '📚' },
]

const DIFFICULTY_PRESETS = [
  { label: 'Básico',     value: 'easy',   score: 25, color: 'border-green-400 bg-green-50 text-green-700' },
  { label: 'Intermedio', value: 'medium', score: 50, color: 'border-amber-400 bg-amber-50 text-amber-700' },
  { label: 'Avanzado',   value: 'hard',   score: 80, color: 'border-red-400 bg-red-50 text-red-700'       },
]

export default function QuestionDifficultyEditor({
  questionId,
  initialDifficulty = 50,
  initialLabel      = 'medium',
  initialSkill      = 'grammar',
  initialTopic      = '',
  onSaved,
}: Props) {
  const supabase = createClient()

  const [difficulty, setDifficulty]   = useState(initialDifficulty)
  const [label, setLabel]             = useState(initialLabel)
  const [skill, setSkill]             = useState(initialSkill)
  const [topic, setTopic]             = useState(initialTopic)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)

  // Sincronizar label cuando el slider cambia
  function handleSliderChange(val: number) {
    setDifficulty(val)
    if (val <= 33)       setLabel('easy')
    else if (val <= 66)  setLabel('medium')
    else                 setLabel('hard')
  }

  async function save() {
    setSaving(true)
    await supabase
      .from('questions')
      .update({
        difficulty_score: difficulty,
        difficulty_label: label,
        skill,
        topic: topic || null,
      })
      .eq('id', questionId)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved?.()
  }

  const currentPreset = DIFFICULTY_PRESETS.find(p => p.value === label)

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Configuración adaptativa
      </p>

      {/* Skill */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Habilidad</label>
        <div className="flex flex-wrap gap-1.5">
          {SKILLS.map(s => (
            <button
              key={s.value}
              onClick={() => setSkill(s.value)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                skill === s.value
                  ? 'text-white border-transparent'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              style={skill === s.value ? { backgroundColor: '#642f8d' } : {}}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-600">Dificultad</label>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${currentPreset?.color}`}>
            {currentPreset?.label} ({difficulty}/100)
          </span>
        </div>

        {/* Presets rápidos */}
        <div className="flex gap-2 mb-3">
          {DIFFICULTY_PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => { setLabel(p.value as any); setDifficulty(p.score) }}
              className={`flex-1 py-1.5 text-xs rounded-lg border-2 font-medium transition-all ${
                label === p.value ? p.color : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Slider fino */}
        <input
          type="range"
          min={1}
          max={100}
          value={difficulty}
          onChange={e => handleSliderChange(Number(e.target.value))}
          className="w-full accent-purple-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>1 — Muy básico</span>
          <span>50 — Intermedio</span>
          <span>100 — Muy avanzado</span>
        </div>
      </div>

      {/* Topic (opcional) */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Tema <span className="text-gray-400">(opcional)</span>
        </label>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="ej: present_simple, articles, modals…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-400 bg-white"
        />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2 text-xs font-semibold text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: '#642f8d' }}
      >
        {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar configuración'}
      </button>
    </div>
  )
}
