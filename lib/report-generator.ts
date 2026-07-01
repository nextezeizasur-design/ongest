// lib/report-generator.ts
// Genera reportes PDF profesionales usando jsPDF
// 100% browser-side, sin servidor, sin costos
// npm install jspdf

import jsPDF from 'jspdf'

// ── Tipos ─────────────────────────────────────────────────────

export interface StudentReportData {
  // Alumno
  student: {
    first_name:  string
    last_name:   string
    email:       string
    course_name: string
    cefr_code:   string | null
  }
  // Organización
  org: {
    name: string
  }
  // Resultados
  attempts: {
    evaluation_title: string
    score:            number | null
    passed:           boolean | null
    submitted_at:     string | null
    pass_score:       number
  }[]
  // Skills
  skills: {
    skill:     string
    label:     string
    score_pct: number
  }[]
  // Recomendaciones
  recommendations: {
    title: string
    body:  string
    skill: string
  }[]
  // Fecha del reporte
  generated_at: string
}

// ── Colores ───────────────────────────────────────────────────
const BRAND   = '#642f8d'
const GREEN   = '#16a34a'
const RED     = '#dc2626'
const GRAY    = '#6b7280'
const LGRAY   = '#f3f4f6'
const TEXT    = '#111827'
const SUBTEXT = '#6b7280'

// ── Helpers ───────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function scoreColor(score: number): string {
  return score >= 60 ? GREEN : RED
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ── Generador principal ───────────────────────────────────────
export async function generateStudentReport(data: StudentReportData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const W    = 210   // ancho A4
  const H    = 297   // alto A4
  const ML   = 16    // margen izquierdo
  const MR   = 16    // margen derecho
  const CW   = W - ML - MR  // ancho contenido
  let   y    = 0

  // ── Página 1 ────────────────────────────────────────────────

  // Header purple
  doc.setFillColor(...hexToRgb(BRAND))
  doc.rect(0, 0, W, 36, 'F')

  // Logo / nombre del instituto
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text(data.org.name, ML, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(220, 200, 240)
  doc.text('Reporte de Evaluaciones', ML, 23)
  doc.text(`Generado: ${formatDate(data.generated_at)}`, ML, 29)

  y = 46

  // ── Datos del alumno ──────────────────────────────────────
  doc.setFillColor(...hexToRgb(LGRAY))
  doc.roundedRect(ML, y, CW, 28, 3, 3, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...hexToRgb(TEXT))
  doc.text(`${data.student.first_name} ${data.student.last_name}`, ML + 6, y + 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...hexToRgb(SUBTEXT))
  doc.text(data.student.email, ML + 6, y + 17)

  const courseText = data.student.course_name +
    (data.student.cefr_code ? ` · Nivel ${data.student.cefr_code}` : '')
  doc.text(courseText, ML + 6, y + 23)

  y += 36

  // ── Resumen estadístico ───────────────────────────────────
  const completed = data.attempts.filter(a => a.submitted_at)
  const passed    = data.attempts.filter(a => a.passed)
  const avgScore  = completed.length > 0
    ? Math.round(completed.reduce((s, a) => s + (a.score ?? 0), 0) / completed.length)
    : 0

  const stats = [
    { label: 'Evaluaciones', value: String(completed.length) },
    { label: 'Aprobadas',    value: String(passed.length)    },
    { label: 'Promedio',     value: `${avgScore}%`           },
    { label: 'Aprobación',   value: `${completed.length > 0 ? Math.round((passed.length / completed.length) * 100) : 0}%` },
  ]

  const boxW = (CW - 12) / 4
  stats.forEach((s, i) => {
    const bx = ML + i * (boxW + 4)
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...hexToRgb('#e5e7eb'))
    doc.roundedRect(bx, y, boxW, 20, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...hexToRgb(i === 2 ? scoreColor(avgScore) : BRAND))
    doc.text(s.value, bx + boxW / 2, y + 12, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...hexToRgb(SUBTEXT))
    doc.text(s.label, bx + boxW / 2, y + 18, { align: 'center' })
  })

  y += 28

  // ── Tabla de evaluaciones ─────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...hexToRgb(TEXT))
  doc.text('Resultados por evaluación', ML, y)
  y += 6

  // Header de tabla
  doc.setFillColor(...hexToRgb(BRAND))
  doc.rect(ML, y, CW, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text('Evaluación',  ML + 3,       y + 5)
  doc.text('Fecha',       ML + 100,     y + 5)
  doc.text('Score',       ML + 130,     y + 5)
  doc.text('Mínimo',      ML + 148,     y + 5)
  doc.text('Estado',      ML + 164,     y + 5)
  y += 7

  data.attempts.forEach((a, i) => {
    const rowH  = 8
    const rowBg = i % 2 === 0 ? '#ffffff' : '#f9fafb'
    doc.setFillColor(...hexToRgb(rowBg))
    doc.rect(ML, y, CW, rowH, 'F')

    // Borde inferior suave
    doc.setDrawColor(...hexToRgb('#e5e7eb'))
    doc.line(ML, y + rowH, ML + CW, y + rowH)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...hexToRgb(TEXT))

    // Título (truncar si es muy largo)
    const title = a.evaluation_title.length > 42
      ? a.evaluation_title.slice(0, 40) + '…'
      : a.evaluation_title
    doc.text(title, ML + 3, y + 5.5)
    doc.text(formatDate(a.submitted_at), ML + 100, y + 5.5)

    if (a.score != null) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...hexToRgb(scoreColor(a.score)))
      doc.text(`${Math.round(a.score)}%`, ML + 130, y + 5.5)
    } else {
      doc.setTextColor(...hexToRgb(SUBTEXT))
      doc.text('—', ML + 130, y + 5.5)
    }

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...hexToRgb(SUBTEXT))
    doc.text(`${a.pass_score}%`, ML + 148, y + 5.5)

    // Badge estado
    if (a.submitted_at) {
      const badgeColor = a.passed ? GREEN : RED
      doc.setFillColor(...hexToRgb(badgeColor + '20'))
      doc.roundedRect(ML + 160, y + 1.5, 24, 5, 1, 1, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...hexToRgb(badgeColor))
      doc.text(a.passed ? 'Aprobado' : 'Desaprobado', ML + 172, y + 5, { align: 'center' })
    }

    y += rowH

    // Nueva página si no hay espacio
    if (y > 240 && i < data.attempts.length - 1) {
      doc.addPage()
      y = 20
    }
  })

  y += 10

  // ── Radar de habilidades (barras horizontales) ─────────────
  if (data.skills.length > 0 && y < 220) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...hexToRgb(TEXT))
    doc.text('Radar de habilidades', ML, y)
    y += 8

    data.skills.forEach(s => {
      const barW     = CW - 50
      const barH     = 5
      const fillW    = (s.score_pct / 100) * barW
      const barColor = s.score_pct >= 60 ? GREEN : s.score_pct > 0 ? RED : GRAY

      // Label
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...hexToRgb(TEXT))
      doc.text(s.label, ML, y + 4)

      // Barra fondo
      doc.setFillColor(...hexToRgb('#e5e7eb'))
      doc.roundedRect(ML + 28, y, barW, barH, 1, 1, 'F')

      // Barra progreso
      if (fillW > 0) {
        doc.setFillColor(...hexToRgb(barColor))
        doc.roundedRect(ML + 28, y, fillW, barH, 1, 1, 'F')
      }

      // Porcentaje
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...hexToRgb(barColor))
      const pctText = s.score_pct > 0 ? `${Math.round(s.score_pct)}%` : '—'
      doc.text(pctText, ML + 28 + barW + 4, y + 4)

      y += 9
    })

    y += 6
  }

  // ── Recomendaciones ───────────────────────────────────────
  if (data.recommendations.length > 0) {
    // Nueva página si no hay espacio
    if (y > 220) { doc.addPage(); y = 20 }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...hexToRgb(TEXT))
    doc.text('Recomendaciones personalizadas', ML, y)
    y += 8

    data.recommendations.slice(0, 4).forEach(r => {
      if (y > 260) { doc.addPage(); y = 20 }

      doc.setFillColor(...hexToRgb('#f5eefb'))
      const boxH = 18
      doc.roundedRect(ML, y, CW, boxH, 2, 2, 'F')

      // Dot
      doc.setFillColor(...hexToRgb(BRAND))
      doc.circle(ML + 5, y + 6, 1.5, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...hexToRgb(BRAND))
      doc.text(r.title, ML + 10, y + 7)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...hexToRgb(SUBTEXT))
      const lines = doc.splitTextToSize(r.body, CW - 14)
      doc.text(lines.slice(0, 2), ML + 10, y + 13)

      y += boxH + 4
    })
  }

  // ── Footer en cada página ─────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFillColor(...hexToRgb(BRAND))
    doc.rect(0, H - 12, W, 12, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(220, 200, 240)
    doc.text(data.org.name + ' · Reporte de evaluaciones', ML, H - 5)
    doc.text(`Página ${p} de ${totalPages}`, W - ML, H - 5, { align: 'right' })
  }

  // ── Descargar ─────────────────────────────────────────────
  const filename = `reporte_${data.student.last_name}_${data.student.first_name}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}

// ═══════════════════════════════════════════════════════════
// REPORTE INSTITUCIONAL (Director)
// ═══════════════════════════════════════════════════════════

export interface InstitutionalReportData {
  org: { name: string }
  kpis: {
    total_students: number
    avg_score:      number | null
    pass_rate:      number | null
    at_risk_count:  number
  }
  by_level: {
    code:  string
    count: number
    avg:   number | null
  }[]
  at_risk_students: {
    first_name: string
    last_name:  string
    course_name: string | null
    avg_score:   number | null
  }[]
  worst_evaluations: {
    title:           string
    completed_count: number
    avg_score:       number | null
    cefr_code:       string | null
  }[]
  generated_at: string
}

export async function generateInstitutionalReport(data: InstitutionalReportData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const W  = 210
  const H  = 297
  const ML = 16
  const MR = 16
  const CW = W - ML - MR
  let   y  = 0

  function ensureSpace(needed: number) {
    if (y + needed > 265) { doc.addPage(); y = 20 }
  }

  // ── Header ──────────────────────────────────────────────
  doc.setFillColor(...hexToRgb(BRAND))
  doc.rect(0, 0, W, 36, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text(data.org.name, ML, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(220, 200, 240)
  doc.text('Reporte Institucional', ML, 23)
  doc.text(`Generado: ${formatDate(data.generated_at)}`, ML, 29)

  y = 46

  // ── KPIs ────────────────────────────────────────────────
  const kpiBoxes = [
    { label: 'Total alumnos',     value: String(data.kpis.total_students) },
    { label: 'Promedio institucional', value: data.kpis.avg_score != null ? `${Math.round(data.kpis.avg_score)}%` : '—' },
    { label: 'Tasa de aprobación', value: data.kpis.pass_rate != null ? `${Math.round(data.kpis.pass_rate)}%` : '—' },
    { label: 'Alumnos en riesgo', value: String(data.kpis.at_risk_count) },
  ]

  const boxW = (CW - 12) / 4
  kpiBoxes.forEach((k, i) => {
    const bx = ML + i * (boxW + 4)
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...hexToRgb('#e5e7eb'))
    doc.roundedRect(bx, y, boxW, 22, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...hexToRgb(i === 3 && data.kpis.at_risk_count > 0 ? RED : BRAND))
    doc.text(k.value, bx + boxW / 2, y + 12, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...hexToRgb(SUBTEXT))
    const lines = doc.splitTextToSize(k.label, boxW - 4)
    doc.text(lines, bx + boxW / 2, y + 18, { align: 'center' })
  })

  y += 32

  // ── Rendimiento por nivel CEFR ─────────────────────────
  if (data.by_level.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...hexToRgb(TEXT))
    doc.text('Rendimiento por nivel CEFR', ML, y)
    y += 8

    data.by_level.forEach(l => {
      const barW     = CW - 50
      const barH     = 5
      const avg      = l.avg ?? 0
      const fillW    = (avg / 100) * barW
      const barColor = avg >= 80 ? GREEN : avg >= 60 ? '#f59e0b' : RED

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...hexToRgb(TEXT))
      doc.text(`${l.code} (${l.count})`, ML, y + 4)

      doc.setFillColor(...hexToRgb('#e5e7eb'))
      doc.roundedRect(ML + 28, y, barW, barH, 1, 1, 'F')

      if (fillW > 0) {
        doc.setFillColor(...hexToRgb(barColor))
        doc.roundedRect(ML + 28, y, fillW, barH, 1, 1, 'F')
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...hexToRgb(barColor))
      doc.text(l.avg != null ? `${Math.round(l.avg)}%` : '—', ML + 28 + barW + 4, y + 4)

      y += 9
    })

    y += 6
  }

  // ── Alumnos en riesgo ───────────────────────────────────
  if (data.at_risk_students.length > 0) {
    ensureSpace(20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...hexToRgb(TEXT))
    doc.text(`Alumnos en riesgo (${data.at_risk_students.length})`, ML, y)
    y += 6

    doc.setFillColor(...hexToRgb(BRAND))
    doc.rect(ML, y, CW, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text('Alumno', ML + 3, y + 5)
    doc.text('Curso', ML + 90, y + 5)
    doc.text('Promedio', ML + 155, y + 5)
    y += 7

    data.at_risk_students.slice(0, 20).forEach((s, i) => {
      ensureSpace(8)
      const rowH  = 7
      doc.setFillColor(...hexToRgb(i % 2 === 0 ? '#ffffff' : '#fef2f2'))
      doc.rect(ML, y, CW, rowH, 'F')
      doc.setDrawColor(...hexToRgb('#e5e7eb'))
      doc.line(ML, y + rowH, ML + CW, y + rowH)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...hexToRgb(TEXT))
      doc.text(`${s.first_name} ${s.last_name}`, ML + 3, y + 5)
      doc.text(s.course_name ?? '—', ML + 90, y + 5)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...hexToRgb(RED))
      doc.text(s.avg_score != null ? `${Math.round(s.avg_score)}%` : '—', ML + 155, y + 5)

      y += rowH
    })

    y += 10
  }

  // ── Evaluaciones con menor rendimiento ─────────────────
  if (data.worst_evaluations.length > 0) {
    ensureSpace(20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...hexToRgb(TEXT))
    doc.text('Evaluaciones con menor rendimiento', ML, y)
    y += 6

    doc.setFillColor(...hexToRgb(BRAND))
    doc.rect(ML, y, CW, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text('Evaluación', ML + 3, y + 5)
    doc.text('Nivel', ML + 110, y + 5)
    doc.text('Completados', ML + 135, y + 5)
    doc.text('Promedio', ML + 168, y + 5)
    y += 7

    data.worst_evaluations.forEach((e, i) => {
      ensureSpace(8)
      const rowH = 7
      doc.setFillColor(...hexToRgb(i % 2 === 0 ? '#ffffff' : '#f9fafb'))
      doc.rect(ML, y, CW, rowH, 'F')
      doc.setDrawColor(...hexToRgb('#e5e7eb'))
      doc.line(ML, y + rowH, ML + CW, y + rowH)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...hexToRgb(TEXT))
      const title = e.title.length > 48 ? e.title.slice(0, 46) + '…' : e.title
      doc.text(title, ML + 3, y + 5)
      doc.text(e.cefr_code ?? '—', ML + 110, y + 5)
      doc.text(String(e.completed_count), ML + 135, y + 5)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...hexToRgb(e.avg_score != null ? scoreColor(e.avg_score) : SUBTEXT))
      doc.text(e.avg_score != null ? `${Math.round(e.avg_score)}%` : '—', ML + 168, y + 5)

      y += rowH
    })
  }

  // ── Footer en cada página ─────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFillColor(...hexToRgb(BRAND))
    doc.rect(0, H - 12, W, 12, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(220, 200, 240)
    doc.text(data.org.name + ' · Reporte institucional', ML, H - 5)
    doc.text(`Página ${p} de ${totalPages}`, W - ML, H - 5, { align: 'right' })
  }

  // ── Descargar ─────────────────────────────────────────────
  const filename = `reporte_institucional_${data.org.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
