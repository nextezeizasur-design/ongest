'use client'

// components/coordinator/EvaluationsCalendarClient.tsx
// Calendario mensual institucional: marca apertura y vencimiento de cada evaluación
// para detectar solapamientos entre cursos de un vistazo.

import { useState, useMemo } from 'react'

export interface CalendarEvalItem {
  id:            string
  title:         string
  evalType:      string
  cefrCode:      string | null
  status:        string
  courseNames:   string[]
  availableFrom: string | null
  availableUntil: string | null
}

interface Props {
  evaluations: CalendarEvalItem[]
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function toLocalDate(iso: string) {
  return new Date(iso)
}

type Marker = { evalId: string; title: string; courseNames: string[]; kind: 'abre' | 'vence'; cefrCode: string | null }

export default function EvaluationsCalendarClient({ evaluations }: Props) {
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const year  = cursor.getFullYear()
  const month = cursor.getMonth()

  // ── Armar grilla de 6 semanas (42 días) empezando el domingo ──
  const gridDays = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1)
    const startOffset   = firstOfMonth.getDay() // 0=domingo
    const gridStart      = new Date(year, month, 1 - startOffset)

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      return d
    })
  }, [year, month])

  // ── Marcadores por día (apertura / vencimiento) ──
  const markersByDay = useMemo(() => {
    const map = new Map<string, Marker[]>()
    const push = (d: Date, marker: Marker) => {
      const key = d.toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(marker)
    }

    for (const ev of evaluations) {
      if (ev.availableFrom) {
        push(toLocalDate(ev.availableFrom), {
          evalId: ev.id, title: ev.title, courseNames: ev.courseNames, kind: 'abre', cefrCode: ev.cefrCode,
        })
      }
      if (ev.availableUntil) {
        push(toLocalDate(ev.availableUntil), {
          evalId: ev.id, title: ev.title, courseNames: ev.courseNames, kind: 'vence', cefrCode: ev.cefrCode,
        })
      }
    }
    return map
  }, [evaluations])

  return (
    <div className="space-y-4">
      {/* Navegación */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          {MONTH_NAMES[month]} {year}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            ← Anterior
          </button>
          <button
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#642f8d' }} /> Se habilita
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Vence
        </span>
      </div>

      {/* Grilla */}
      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {WEEKDAYS.map(w => (
            <div key={w} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {gridDays.map((d, i) => {
            const isCurrentMonth = d.getMonth() === month
            const isToday        = sameDay(d, today)
            const markers        = markersByDay.get(d.toDateString()) ?? []

            return (
              <div
                key={i}
                className={`min-h-[92px] border-b border-r border-gray-100 p-1.5 ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'
                }`}
              >
                <span className={`text-xs inline-flex items-center justify-center w-5 h-5 rounded-full ${
                  isToday ? 'text-white font-bold' : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                }`} style={isToday ? { background: '#642f8d' } : {}}>
                  {d.getDate()}
                </span>

                <div className="mt-1 space-y-1">
                  {markers.slice(0, 3).map((m, idx) => (
                    <a
                      key={`${m.evalId}-${m.kind}-${idx}`}
                      href={`/coordinator/evaluations/${m.evalId}`}
                      title={`${m.title} — ${m.courseNames.join(', ') || 'sin curso'}`}
                      className={`block truncate text-[11px] leading-tight px-1.5 py-0.5 rounded-md font-medium hover:opacity-80 transition-opacity ${
                        m.kind === 'abre'
                          ? 'text-white'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                      style={m.kind === 'abre' ? { background: '#642f8d' } : {}}
                    >
                      {m.title}
                    </a>
                  ))}
                  {markers.length > 3 && (
                    <p className="text-[10px] text-gray-400 px-1">+{markers.length - 3} más</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
