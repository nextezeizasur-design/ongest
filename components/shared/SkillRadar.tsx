'use client'

// components/shared/SkillRadar.tsx
// Radar chart en SVG puro — sin recharts ni Chart.js
// Muestra el rendimiento del alumno por skill

import { useMemo } from 'react'

export interface SkillScore {
  skill:             string
  label:             string
  score_pct:         number
  questions_total?:  number
  questions_correct?: number
}

interface SkillRadarProps {
  skills:      SkillScore[]
  size?:       number        // tamaño del SVG en px (default 280)
  showLabels?: boolean
  showLegend?: boolean
  color?:      string        // color del área (default #642f8d)
  className?:  string
}

const SKILL_EMOJIS: Record<string, string> = {
  grammar:    '📝',
  listening:  '🎧',
  reading:    '📖',
  writing:    '✏️',
  vocabulary: '📚',
  speaking:   '🗣️',
}

// Convierte un valor (0-100) a coordenadas XY en el radar
function polarToXY(
  centerX: number,
  centerY: number,
  radius:  number,
  angleRad: number
): { x: number; y: number } {
  return {
    x: centerX + radius * Math.sin(angleRad),
    y: centerY - radius * Math.cos(angleRad),
  }
}

export default function SkillRadar({
  skills,
  size       = 280,
  showLabels = true,
  showLegend = true,
  color      = '#642f8d',
  className  = '',
}: SkillRadarProps) {
  const n       = skills.length
  const cx      = size / 2
  const cy      = size / 2
  const maxR    = size * 0.35     // radio máximo del radar
  const labelR  = size * 0.47    // radio para las etiquetas

  const levels  = [20, 40, 60, 80, 100]

  // Calcular puntos del polígono de datos
  const dataPoints = useMemo(() => {
    return skills.map((s, i) => {
      const angle  = (2 * Math.PI * i) / n
      const r      = (s.score_pct / 100) * maxR
      return polarToXY(cx, cy, r, angle)
    })
  }, [skills, n, cx, cy, maxR])

  // Calcular vértices del polígono de cada nivel (grid)
  function getLevelPolygon(pct: number) {
    const r = (pct / 100) * maxR
    return Array.from({ length: n }, (_, i) => {
      const angle = (2 * Math.PI * i) / n
      const { x, y } = polarToXY(cx, cy, r, angle)
      return `${x},${y}`
    }).join(' ')
  }

  // Etiquetas de skills
  const labelPoints = useMemo(() => {
    return skills.map((s, i) => {
      const angle = (2 * Math.PI * i) / n
      return {
        ...polarToXY(cx, cy, labelR, angle),
        skill: s,
        angle,
      }
    })
  }, [skills, n, cx, cy, labelR])

  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  if (skills.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-gray-50 ${className}`}
        style={{ width: size, height: size }}>
        <p className="text-xs text-gray-400 text-center px-4">
          Completá evaluaciones para ver tu radar de habilidades
        </p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {/* Grid — círculos de referencia */}
        {levels.map(lvl => (
          <polygon
            key={lvl}
            points={getLevelPolygon(lvl)}
            fill="none"
            stroke={lvl === 60 ? '#d1d5db' : '#e5e7eb'}
            strokeWidth={lvl === 60 ? 1.5 : 1}
            strokeDasharray={lvl === 60 ? '4,3' : undefined}
          />
        ))}

        {/* Ejes (líneas desde el centro a cada vértice) */}
        {Array.from({ length: n }, (_, i) => {
          const angle   = (2 * Math.PI * i) / n
          const { x, y } = polarToXY(cx, cy, maxR, angle)
          return (
            <line
              key={i}
              x1={cx} y1={cy}
              x2={x}  y2={y}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
          )
        })}

        {/* Indicador del 60% (mínimo aprobatorio) */}
        <text
          x={cx + 3}
          y={cy - (60 / 100) * maxR - 3}
          fontSize={8}
          fill="#9ca3af"
        >
          60%
        </text>

        {/* Área de datos */}
        <polygon
          points={dataPolygon}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Puntos en cada vértice */}
        {dataPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={color}
            stroke="white"
            strokeWidth={1.5}
          />
        ))}

        {/* Etiquetas de skills */}
        {showLabels && labelPoints.map((lp, i) => {
          const s = lp.skill
          // Alineación según posición en el círculo
          const anchor =
            lp.x < cx - 5 ? 'end' :
            lp.x > cx + 5 ? 'start' : 'middle'

          return (
            <g key={i}>
              {/* Emoji */}
              <text
                x={lp.x}
                y={lp.y - 6}
                textAnchor={anchor}
                fontSize={12}
                dominantBaseline="auto"
              >
                {SKILL_EMOJIS[s.skill] ?? '●'}
              </text>
              {/* Nombre del skill */}
              <text
                x={lp.x}
                y={lp.y + 8}
                textAnchor={anchor}
                fontSize={9}
                fontWeight="600"
                fill="#374151"
              >
                {s.label}
              </text>
              {/* Score */}
              <text
                x={lp.x}
                y={lp.y + 19}
                textAnchor={anchor}
                fontSize={9}
                fill={s.score_pct >= 60 ? '#16a34a' : s.score_pct > 0 ? '#dc2626' : '#9ca3af'}
                fontWeight="700"
              >
                {s.score_pct > 0 ? `${Math.round(s.score_pct)}%` : '—'}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Leyenda */}
      {showLegend && (
        <div className="mt-4 w-full space-y-2">
          {skills.map(s => (
            <div key={s.skill} className="flex items-center gap-3">
              <span className="text-sm w-4">{SKILL_EMOJIS[s.skill]}</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="font-medium text-gray-700">{s.label}</span>
                  <span className={`font-bold ${
                    s.score_pct >= 60 ? 'text-green-600' :
                    s.score_pct > 0   ? 'text-red-500'   : 'text-gray-400'
                  }`}>
                    {s.score_pct > 0 ? `${Math.round(s.score_pct)}%` : 'Sin datos'}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${s.score_pct}%`,
                      backgroundColor: s.score_pct >= 60 ? '#16a34a' : s.score_pct > 0 ? '#dc2626' : '#e5e7eb',
                    }}
                  />
                </div>
                {s.questions_total !== undefined && s.questions_total > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.questions_correct}/{s.questions_total} preguntas correctas
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
