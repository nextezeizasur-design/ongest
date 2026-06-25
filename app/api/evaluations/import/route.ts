// RUTA: app/api/evaluations/import/route.ts
// Usa Claude API (claude-sonnet-4-6) para parsear ejercicios desde PDF de Macmillan u otras editoriales.
// Costo estimado: ~$0.015 USD por PDF. 80 PDFs/mes ≈ $1.20 USD/mes.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const ALLOWED_ROLES = [1, 2, 5]
const RATE_LIMIT    = { windowMs: 10 * 60 * 1000, max: 10 }

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ParsedQuestion {
  body:             string
  q_type:           'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
  skill:            'grammar' | 'vocabulary' | 'reading' | 'writing' | 'listening'
  difficulty_label: 'easy' | 'medium' | 'hard'
  difficulty_score: number
  topic:            string | null
  explanation:      string | null
  options:          { body: string; is_correct: boolean }[]
  instruction?:     string
  points:           number
  needs_review:     boolean   // true si el docente debe revisar/completar
}

// ─── Prompt para Claude ───────────────────────────────────────────────────────

// ─── Extraer texto de Reading del PDF (lado servidor) ────────────────────────
// Lo hace el servidor directamente — nunca le pedimos a Claude que lo incluya en el JSON.

function extractReadingText(text: string): string | null {
  // Busca el bloque entre "My Family" / título del texto y "Score:" o fin
  // Estrategia: líneas con más de 60 chars consecutivas que no son ítems numerados
  const lines = text.split('\n')
  const readingLines: string[] = []
  let capturing = false
  let consecutiveLong = 0

  for (const line of lines) {
    const trimmed = line.trim()
    const isItem    = /^\d+\s/.test(trimmed)
    const isSection = /^(LISTENING|GRAMMAR|VOCABULARY|READING|WRITING|SPEAKING|Score:)/.test(trimmed)
    const isLong    = trimmed.length > 55 && !isItem && !isSection

    if (isLong) {
      consecutiveLong++
      if (consecutiveLong >= 2) capturing = true
      if (capturing) readingLines.push(trimmed)
    } else {
      if (capturing && !trimmed) {
        readingLines.push('')  // preservar párrafos
      } else if (capturing && (isItem || isSection)) {
        break  // fin del texto de lectura
      } else if (!capturing) {
        consecutiveLong = 0
      }
    }
  }

  const result = readingLines.join('\n').trim()
  return result.length > 50 ? result : null
}

function buildPrompt(text: string, cefrLevel: string | null): string {
  // Limpiar el texto del Reading del prompt para que Claude no lo incluya en el JSON
  // El servidor lo inyecta después directamente
  const cleanedText = text
    .split('\n')
    .filter(line => {
      const t = line.trim()
      // Remover líneas que son texto de lectura largo (no ítems)
      const isItem    = /^\d+\s/.test(t) || /^[a-f]\s/.test(t)
      const isSection = /^(LISTENING|GRAMMAR|VOCABULARY|READING|WRITING|SPEAKING|Score:|My Family|My name)/.test(t)
      return t.length < 56 || isItem || isSection
    })
    .join('\n')

  return `Sos un experto en análisis de exámenes de inglés EFL/ESL. Analizá el texto del examen y extraé TODOS los ejercicios.

REGLAS GENERALES:
- Ignorá: nombre del alumno, fecha, puntaje, logos, copyright, pie de página, el ítem de ejemplo (ítem 0).
- Procesá TODAS las secciones: LISTENING, GRAMMAR, VOCABULARY, READING, WRITING, SPEAKING.
- Incluí TODOS los ítems numerados del 1 en adelante, de TODAS las secciones.
- Respondé ÚNICAMENTE con un array JSON válido. Sin texto, sin markdown, sin bloques de código.
- CRÍTICO: usa solo comillas dobles en el JSON. No uses saltos de línea dentro de los valores de los campos.
- CRÍTICO: todos los strings deben escapar correctamente los apóstrofes con barra inversa.

CÓMO IDENTIFICAR LA CONSIGNA DE CADA EJERCICIO:
- La consigna empieza con el número del ejercicio (ej: "1 Listen to...", "2 Match the...", "3 Select the...")
- Cada consigna aplica a TODOS los ítems que la siguen hasta que aparece otra consigna con número mayor.
- Para "Complete the sentences with [lista]": incluí la lista de palabras en la consigna.
- El campo "instruction" debe tener la consigna completa. NO incluyas el texto de lectura — el sistema lo agrega automáticamente.

ESTRUCTURA DE CADA PREGUNTA:
{
  "body": "enunciado completo del ítem numerado (sin el número)",
  "q_type": "multiple_choice" | "true_false" | "short_answer" | "essay",
  "skill": "grammar" | "vocabulary" | "reading" | "writing" | "listening",
  "options": [{"body": "texto", "is_correct": false}],
  "instruction": "consigna completa del ejercicio",
  "points": 1,
  "needs_review": true
}

REGLAS POR TIPO:

TRUE/FALSE: q_type="true_false", options=[{"body":"True","is_correct":false},{"body":"False","is_correct":false}], needs_review=true

SELECT CORRECT WORD (ej: "This/These is a picture"):
- q_type="multiple_choice", options: una por cada palabra separada por "/", todas is_correct:false, needs_review=true

MATCH SENTENCE HALVES:
- body: solo la parte izquierda, q_type="multiple_choice"
- options: cada opción de la columna derecha, todas is_correct:false, needs_review=true

COMPLETE WITH WORD FROM LIST:
- q_type="short_answer", options:[], needs_review=true
- instruction: incluir la lista de palabras disponibles

REWRITE / TRANSFORM:
- q_type="essay", options:[], needs_review=true

READING COMPREHENSION:
- body: solo la oración incompleta (ej: "Linda and her dad don't have the same colour ___.")
- q_type="short_answer", options:[], needs_review=true
- instruction: solo la consigna (ej: "Read the text about Linda and her family. Complete the sentences (1-5).")
- NO incluyas el texto de la lectura en la instruction — el sistema lo agrega automáticamente.

Nivel CEFR: ${cefrLevel || 'A2'}
difficulty_label: ${cefrLevel && ['A1','A2'].includes(cefrLevel) ? 'easy' : 'medium'}
difficulty_score: ${cefrLevel === 'A1' ? 20 : cefrLevel === 'A2' ? 35 : cefrLevel === 'B1' ? 50 : cefrLevel === 'B2' ? 65 : cefrLevel === 'C1' ? 80 : 35}

TEXTO DEL EXAMEN:
${cleanedText}

Respondé ÚNICAMENTE con el array JSON. Sin texto previo ni posterior. Sin markdown.`
}

// ─── Extraer texto del PDF (pdf-parse) ───────────────────────────────────────

async function extractPdfText(file: File): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default
  const buffer   = Buffer.from(await file.arrayBuffer())
  const data     = await pdfParse(buffer)
  return data.text ?? ''
}

// ─── Llamar a Claude API ──────────────────────────────────────────────────────

async function parseWithClaude(text: string, cefrLevel: string | null): Promise<ParsedQuestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada en variables de entorno.')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [
        {
          role:    'user',
          content: buildPrompt(text, cefrLevel),
        },
      ],
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Claude API error ${res.status}: ${errBody}`)
  }

  const data     = await res.json()
  const content  = data.content?.[0]?.text ?? ''

  // Limpiar posibles bloques markdown que Claude pueda incluir
  const clean = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim()

  let parsed: any[]

  function tryParse(str: string): any[] | null {
    try { return JSON.parse(str) } catch { return null }
  }

  function sanitizeJson(str: string): string {
    // Reemplaza saltos de línea/tabs dentro de strings JSON que rompen el parser
    return str.replace(/("(?:[^"\\]|\\.)*")/g, (m) =>
      m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
    )
  }

  const direct = tryParse(clean)
  if (direct && Array.isArray(direct)) {
    parsed = direct
  } else {
    const match = clean.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Claude no devolvió JSON válido. Intentá de nuevo.')

    const sanitized = sanitizeJson(match[0])
    const fromSanitized = tryParse(sanitized)

    if (fromSanitized && Array.isArray(fromSanitized)) {
      parsed = fromSanitized
    } else {
      // Último recurso: extraer objetos individuales
      const objMatches = match[0].match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)
      if (!objMatches || objMatches.length === 0) {
        throw new Error('No se pudo parsear la respuesta. Intentá de nuevo.')
      }
      parsed = objMatches.flatMap((obj: string) => {
        const r = tryParse(obj) ?? tryParse(sanitizeJson(obj))
        return r ? [r] : []
      })
      if (parsed.length === 0) {
        throw new Error('No se pudieron extraer preguntas del PDF.')
      }
    }
  }

  if (!Array.isArray(parsed)) throw new Error('La respuesta de Claude no es un array.')

  // Normalizar y validar cada pregunta
  return parsed
    .filter((q: any) => q.body && q.body.trim().length > 3)
    .map((q: any, i: number) => ({
      body:             String(q.body ?? '').trim(),
      q_type:           ['multiple_choice','true_false','short_answer','essay'].includes(q.q_type)
                          ? q.q_type
                          : 'short_answer',
      skill:            ['grammar','vocabulary','reading','writing','listening'].includes(q.skill)
                          ? q.skill
                          : 'grammar',
      difficulty_label: q.difficulty_label ?? 'medium',
      difficulty_score: q.difficulty_score ?? 50,
      topic:            q.skill ?? null,
      explanation:      null,
      options:          Array.isArray(q.options) ? q.options.map((o: any) => ({
                          body:       String(o.body ?? '').trim(),
                          is_correct: Boolean(o.is_correct),
                        })) : [],
      instruction:      q.instruction ? String(q.instruction).slice(0, 300) : undefined,
      points:           q.q_type === 'essay' ? 5 : 1,
      needs_review:     q.needs_review !== false,  // default true
    }))
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(`import:${ip}`, RATE_LIMIT)
    if (!rl.success) {
      return NextResponse.json(
        { error: `Demasiadas solicitudes. Intentá de nuevo en ${Math.ceil((rl.resetAt - Date.now()) / 60000)} min.` },
        { status: 429 }
      )
    }

    // Auth
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cs: { name: string; value: string; options: CookieOptions }[]) {
            cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role_id, organization_id').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role_id))
      return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })

    // Validar archivo
    const formData  = await request.formData()
    const file      = formData.get('file') as File | null
    const cefrLevel = formData.get('cefr_level') as string | null
    const publisher = formData.get('publisher') as string | null

    if (!file)
      return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 })
    if (file.type !== 'application/pdf')
      return NextResponse.json({ error: 'El archivo debe ser un PDF.' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json({ error: 'El archivo supera el límite de 10MB.' }, { status: 400 })

    // Extraer texto del PDF
    let pdfText: string
    try {
      pdfText = await extractPdfText(file)
    } catch (err: any) {
      if (err.message?.includes('Cannot find module')) {
        return NextResponse.json({ error: 'Ejecutá: npm install pdf-parse' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Error al leer el PDF: ' + err.message }, { status: 422 })
    }

    if (!pdfText || pdfText.trim().length < 30) {
      return NextResponse.json({
        error: 'No se pudo extraer texto del PDF. Verificá que no sea una imagen escaneada.',
      }, { status: 422 })
    }

    // Parsear con Claude
    let questions: ParsedQuestion[]
    try {
      questions = await parseWithClaude(pdfText, cefrLevel || null)
    } catch (err: any) {
      return NextResponse.json({
        error: 'Error al analizar el PDF con IA: ' + err.message,
      }, { status: 500 })
    }

    if (questions.length === 0) {
      return NextResponse.json({
        error: 'No se detectaron ejercicios en el PDF. Verificá que el archivo tenga texto seleccionable.',
      }, { status: 422 })
    }

    // ── Inyectar texto de Reading completo (servidor, no Claude) ──────────────
    const readingText = extractReadingText(pdfText)
    if (readingText) {
      questions = questions.map(q => {
        if (q.skill === 'reading' && q.instruction) {
          return {
            ...q,
            instruction: `${q.instruction}\n\n${readingText}`,
          }
        }
        return q
      })
    }

    // Resumen por skill y tipo
    const skillSummary = questions.reduce<Record<string, number>>((acc, q) => {
      acc[q.skill] = (acc[q.skill] ?? 0) + 1; return acc
    }, {})

    const typeSummary = questions.reduce<Record<string, number>>((acc, q) => {
      acc[q.q_type] = (acc[q.q_type] ?? 0) + 1; return acc
    }, {})

    const needsReviewCount = questions.filter(q => q.needs_review).length

    return NextResponse.json({
      success:           true,
      questions:         questions.map(q => ({
        ...q,
        organization_id:  profile.organization_id,
        created_by:       user.id,
        cefr_level:       cefrLevel || null,
        source_publisher: publisher || null,
      })),
      count:             questions.length,
      skill_summary:     skillSummary,
      type_summary:      typeSummary,
      needs_review_count: needsReviewCount,
      note:              needsReviewCount > 0
        ? `${needsReviewCount} pregunta${needsReviewCount !== 1 ? 's' : ''} requieren que marques la respuesta correcta antes de publicar.`
        : 'Todas las preguntas fueron detectadas correctamente.',
    })

  } catch (err: any) {
    console.error('[/api/evaluations/import] Error:', err)
    return NextResponse.json({ error: err.message ?? 'Error interno.' }, { status: 500 })
  }
}
