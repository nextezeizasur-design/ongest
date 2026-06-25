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

// ─── Pre-procesar texto para marcar bloques de Reading ───────────────────────
// Detecta textos de lectura largos y los envuelve con marcadores para que
// Claude no los confunda con ítems del examen.

function preprocessText(text: string): string {
  // Detectar patrones de texto de lectura:
  // Líneas seguidas sin números que forman párrafos (más de 3 líneas consecutivas sin números al inicio)
  const lines = text.split('\n')
  const result: string[] = []
  let inReadingText = false
  let readingBuffer: string[] = []
  let consecutiveNonItems = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const isItem = /^\d+\s/.test(line) || /^[a-f]\s/.test(line) || /^Score:/.test(line) || /^(LISTENING|GRAMMAR|VOCABULARY|READING|WRITING|SPEAKING)$/.test(line)
    const isBlank = line.length === 0
    const isLongText = line.length > 60 && !isItem

    if (isLongText && !isItem) {
      consecutiveNonItems++
      readingBuffer.push(line)
      if (consecutiveNonItems >= 2 && !inReadingText) {
        inReadingText = true
        // Marcar inicio del texto de lectura
        if (readingBuffer.length > 0) {
          result.push('<<<READING_TEXT_START>>>')
          result.push(...readingBuffer)
        }
        readingBuffer = []
      } else if (inReadingText) {
        result.push(line)
      }
    } else {
      if (inReadingText && !isBlank) {
        result.push('<<<READING_TEXT_END>>>')
        inReadingText = false
        consecutiveNonItems = 0
        readingBuffer = []
      } else if (readingBuffer.length > 0 && !inReadingText) {
        result.push(...readingBuffer)
        readingBuffer = []
        consecutiveNonItems = 0
      }
      result.push(line)
    }
  }

  if (inReadingText) result.push('<<<READING_TEXT_END>>>')
  if (readingBuffer.length > 0) result.push(...readingBuffer)

  return result.join('\n')
}

function buildPrompt(text: string, cefrLevel: string | null): string {
  const processedText = preprocessText(text)
  return `Sos un experto en análisis de exámenes de inglés EFL/ESL. Analizá el texto completo del examen y extraé TODOS los ejercicios.

REGLAS GENERALES:
- Ignorá: nombre del alumno, fecha, puntaje, logos, copyright, pie de página, el ítem de ejemplo (ítem 0).
- Procesá TODAS las secciones: LISTENING, GRAMMAR, VOCABULARY, READING, WRITING, SPEAKING.
- Incluí TODOS los ítems numerados del 1 en adelante, de TODAS las secciones.
- Respondé ÚNICAMENTE con un array JSON válido. Sin texto, sin markdown, sin bloques de código.
- CRÍTICO: usa solo comillas dobles en el JSON. No uses saltos de línea dentro de los valores de los campos.

CÓMO IDENTIFICAR LA CONSIGNA DE CADA EJERCICIO:
- La consigna es el texto que empieza con el número del ejercicio (ej: "1 Listen to...", "2 Match the...", "3 Select the...")
- Cada consigna aplica a TODOS los ítems numerados que la siguen hasta que aparece otra consigna con número mayor.
- Si los ítems 7-10 no tienen consigna propia, pertenecen al ejercicio cuya consigna es la más reciente antes de ellos.
- Para ejercicios con "Complete the sentences with [lista de palabras]": incluí la lista de palabras en la consigna.

ESTRUCTURA DE CADA PREGUNTA (todos los campos son obligatorios):
{
  "body": "enunciado completo del ítem numerado (sin el número)",
  "q_type": "multiple_choice" | "true_false" | "short_answer" | "essay",
  "skill": "grammar" | "vocabulary" | "reading" | "writing" | "listening",
  "options": [{"body": "texto", "is_correct": false}],
  "instruction": "consigna completa del ejercicio al que pertenece este ítem",
  "points": 1,
  "needs_review": true
}

REGLAS POR TIPO DE EJERCICIO:

TRUE/FALSE (ej: "It's hot where Dimitra is staying now."):
- q_type: "true_false"
- options: [{"body":"True","is_correct":false},{"body":"False","is_correct":false}]
- needs_review: true
- skill: según la sección (LISTENING → "listening", etc.)

SELECT CORRECT WORD (ej: "This/These is a picture of my family."):
- q_type: "multiple_choice"
- options: una por cada palabra separada por "/", todas con is_correct:false
- needs_review: true

MATCH SENTENCE HALVES (columna izquierda con columna derecha):
- body: solo la parte izquierda del ítem
- q_type: "multiple_choice"
- options: cada opción de la columna derecha (letras a,b,c...), todas con is_correct:false
- needs_review: true

COMPLETE WITH WORD FROM LIST (fill in the blank):
- q_type: "short_answer"
- options: []
- needs_review: true
- instruction: debe incluir la lista de palabras disponibles

REWRITE / TRANSFORM:
- q_type: "essay"
- options: []
- needs_review: true

READING COMPREHENSION (completar oraciones sobre un texto):
- body: la oración incompleta
- q_type: "short_answer"
- options: []
- needs_review: true
- instruction: debe incluir el título del texto y la consigna original

TEXTO DE READING — MUY IMPORTANTE:
El texto de lectura estará marcado entre <<<READING_TEXT_START>>> y <<<READING_TEXT_END>>>.
Para CADA ítem que pertenezca a ese ejercicio de Reading:
- "body": solo la oración incompleta (ej: "Linda and her dad don't have the same colour ___.")
- "instruction": debe incluir: 1) la consigna original completa, y 2) el texto COMPLETO de la lectura tal como aparece entre los marcadores. No lo recortes ni lo resumas bajo ningún concepto.
- Ejemplo de instruction: "Read the text about Linda and her family. Complete the sentences (1-5).\n\nTEXTO: My name's Linda and I have three sisters. Two of them..."
- Es CRÍTICO que el texto íntegro quede en instruction — el alumno lo necesita para responder.

Nivel CEFR: ${cefrLevel || 'A2'}
difficulty_label: ${cefrLevel && ['A1','A2'].includes(cefrLevel) ? 'easy' : cefrLevel && ['B1','B2'].includes(cefrLevel) ? 'medium' : 'medium'}
difficulty_score: ${cefrLevel === 'A1' ? 20 : cefrLevel === 'A2' ? 35 : cefrLevel === 'B1' ? 50 : cefrLevel === 'B2' ? 65 : cefrLevel === 'C1' ? 80 : 35}

TEXTO COMPLETO DEL EXAMEN:
${processedText}

Respondé ÚNICAMENTE con el array JSON. Sin texto previo ni posterior. Sin markdown.`
}

// ─── Prompt para Claude Vision (PDF escaneado) ───────────────────────────────

function buildVisionPrompt(cefrLevel: string | null): string {
  return `Sos un experto en análisis de exámenes de inglés EFL/ESL. Analizá las imágenes del examen y extraé TODOS los ejercicios.

REGLAS GENERALES:
- Ignorá: nombre del alumno, fecha, puntaje, logos, copyright, pie de página, el ítem de ejemplo (ítem 0).
- Procesá TODAS las secciones: LISTENING, GRAMMAR, VOCABULARY, READING, WRITING, SPEAKING.
- También procesá secciones con letras: A, B, C, D (son sub-secciones de Grammar, Vocabulary, etc.)
- Incluí TODOS los ítems numerados del 1 en adelante, de TODAS las secciones.
- Respondé ÚNICAMENTE con un array JSON válido. Sin texto, sin markdown, sin bloques de código.
- CRÍTICO: usa solo comillas dobles en el JSON. No uses saltos de línea dentro de los valores de los campos.

CÓMO IDENTIFICAR LA CONSIGNA:
- La consigna es el texto en negrita antes de los ítems (ej: "Match the sentence halves...", "Put the words into the correct order...")
- Cada consigna aplica a TODOS los ítems que la siguen hasta que aparece otra consigna.
- Incluí la consigna COMPLETA en el campo "instruction" de cada ítem.

ESTRUCTURA DE CADA PREGUNTA:
{
  "body": "enunciado completo del ítem (sin el número)",
  "q_type": "multiple_choice" | "true_false" | "short_answer" | "essay",
  "skill": "grammar" | "vocabulary" | "reading" | "writing" | "listening",
  "options": [{"body": "texto", "is_correct": false}],
  "instruction": "consigna completa del ejercicio",
  "points": 1,
  "needs_review": true
}

REGLAS POR TIPO:

MATCH (unir mitades): q_type="multiple_choice", options=cada opción de columna derecha (a,b,c...), todas is_correct:false, needs_review:true

PUT IN ORDER (palabras desordenadas): q_type="short_answer", body=las palabras separadas por /, options:[], needs_review:true

UNDERLINE/CHOOSE (word1/word2 en itálica): q_type="multiple_choice", options=[{body:"word1",is_correct:false},{body:"word2",is_correct:false}], needs_review:true

FIND THE ERROR: q_type="essay", body=la oración con error, options:[], needs_review:true

COMPLETE THE SENTENCES: q_type="short_answer", options:[], needs_review:true

REWRITE: q_type="essay", options:[], needs_review:true

READING COMPREHENSION: q_type="short_answer", options:[], needs_review:true, instruction=consigna+título del texto

TRUE/FALSE: q_type="true_false", options=[{body:"True",is_correct:false},{body:"False",is_correct:false}], needs_review:true

Nivel CEFR: ${cefrLevel || 'A2'}
difficulty_label: ${cefrLevel && ['A1','A2'].includes(cefrLevel) ? 'easy' : 'medium'}
difficulty_score: ${cefrLevel === 'A1' ? 20 : cefrLevel === 'A2' ? 35 : cefrLevel === 'B1' ? 50 : cefrLevel === 'B2' ? 65 : 35}

Respondé ÚNICAMENTE con el array JSON. Sin texto previo ni posterior. Sin markdown.`
}

// ─── Claude Vision para PDFs escaneados ──────────────────────────────────────

async function parseWithClaudeVision(
  images: string[],
  cefrLevel: string | null
): Promise<ParsedQuestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada.')

  // Construir el contenido con las imágenes
  const imageContent = images.map(b64 => ({
    type:   'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: b64 },
  }))

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
      messages: [{
        role:    'user',
        content: [
          ...imageContent,
          { type: 'text', text: buildVisionPrompt(cefrLevel) },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Claude Vision API error ${res.status}: ${errBody}`)
  }

  const data    = await res.json()
  const content = data.content?.[0]?.text ?? ''

  const clean = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim()

  function tryParse(str: string): any[] | null {
    try { return JSON.parse(str) } catch { return null }
  }

  function sanitizeJson(str: string): string {
    return str.replace(/("(?:[^"\\]|\\.)*")/g, (m) =>
      m.replace(/
/g, '\n').replace(/
/g, '\r').replace(/	/g, '\t')
    )
  }

  const direct = tryParse(clean)
  let parsed: any[] = direct && Array.isArray(direct) ? direct : []

  if (parsed.length === 0) {
    const match = clean.match(/\[[\s\S]*\]/)
    if (match) {
      const sanitized = sanitizeJson(match[0])
      const fromSanitized = tryParse(sanitized)
      if (fromSanitized && Array.isArray(fromSanitized)) {
        parsed = fromSanitized
      }
    }
  }

  if (parsed.length === 0) throw new Error('Claude Vision no devolvió preguntas válidas.')

  return parsed
    .filter((q: any) => q.body && q.body.trim().length > 3)
    .map((q: any) => ({
      body:             String(q.body ?? '').trim(),
      q_type:           ['multiple_choice','true_false','short_answer','essay'].includes(q.q_type)
                          ? q.q_type : 'short_answer',
      skill:            ['grammar','vocabulary','reading','writing','listening'].includes(q.skill)
                          ? q.skill : 'grammar',
      difficulty_label: q.difficulty_label ?? 'medium',
      difficulty_score: q.difficulty_score ?? 50,
      topic:            q.skill ?? null,
      explanation:      null,
      options:          Array.isArray(q.options) ? q.options.map((o: any) => ({
                          body:       String(o.body ?? '').trim(),
                          is_correct: Boolean(o.is_correct),
                        })) : [],
      instruction:      q.instruction ? String(q.instruction).slice(0, 400) : undefined,
      points:           q.q_type === 'essay' ? 5 : 1,
      needs_review:     q.needs_review !== false,
    }))
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

    // Parsear con Claude — texto o Vision según el tipo de PDF
    let questions: ParsedQuestion[]
    const isScanned = formData.get('scanned') === 'true'
    const imagesRaw = formData.get('images') as string | null

    try {
      if (isScanned && imagesRaw) {
        // PDF escaneado → Claude Vision
        const images: string[] = JSON.parse(imagesRaw)
        if (!images || images.length === 0) {
          return NextResponse.json({ error: 'No se recibieron imágenes del PDF escaneado.' }, { status: 400 })
        }
        questions = await parseWithClaudeVision(images, cefrLevel || null)
      } else {
        // PDF con texto → flujo normal
        questions = await parseWithClaude(pdfText, cefrLevel || null)
      }
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
