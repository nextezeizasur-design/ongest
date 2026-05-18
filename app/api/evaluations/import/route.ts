// app/api/evaluations/import/route.ts
// Parser 100% local — cero costo
// Soporta: columnas múltiples, ítems fragmentados, opciones de Match (col. derecha)

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const ALLOWED_ROLES = [1, 2, 5]
const RATE_LIMIT    = { windowMs: 10 * 60 * 1000, max: 5 }

interface ParsedQuestion {
  body:             string
  q_type:           'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
  skill:            string
  difficulty_label: 'easy' | 'medium' | 'hard'
  difficulty_score: number
  topic:            string | null
  explanation:      string | null
  options:          { body: string; is_correct: boolean }[]
  instruction?:     string
  points:           number
}

// ─── Patrones ─────────────────────────────────────────────────────────────────

const SECTION_TITLE  = /^(GRAMMAR|VOCABULARY|READING|WRITING|LISTENING|SPEAKING)$/i
const SECTION_LETTER = /^([A-F])\s{1,4}(Match|Put|Complete|Underline|Find|For each|Circle|Choose|Read|Write|Listen|Use|Fill|Select)/i
const ITEM           = /^([1-9]\d?)\s{1,4}(\S.{1,})/
const NUM_ONLY       = /^([1-9]\d?)$/

// Línea de opción de columna derecha: "  b  texto", "    c  texto"
// Excluye el doble-letra del ejemplo: "  a    a  texto"
const COL_OPTION         = /^\s{1,6}([a-k])\s{1,6}([^\s].+)/
const COL_OPTION_EXAMPLE = /^\s{1,6}[a-k]\s{2,6}[a-k]\s{1,6}/

// Basura siempre
const JUNK = /^(An example|Progress Test|Language Hub|Published by|Macmillan|Springer|©|Where are you from|I'm not from America|is an extra|been done|\s*\/\s*\d+|\s*\/\s*$|[a-k]\s*$|\d{3,}[\d\s,]+$)/i

// Texto de respuesta de Match que aparece suelto (continuación de col. derecha)
const MATCH_CONTINUATION = /^(New Zealand|this year|in Spain|in my bag|hundred and|sixty-five|from Japan|Thailand|New York|this city|a mobile phone|umbrella|the table|Turkish friends|I'm not)/i

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectSkill(text: string): string {
  const t = text.toLowerCase()
  if (/put the words|find the error|correct order|underline|match the sentence|sentence halves/.test(t)) return 'grammar'
  if (/vocabulary|complete the|person from|definitions|match the definition|match the numbers/.test(t)) return 'vocabulary'
  if (/read|passage|comprehension|according to/.test(t)) return 'reading'
  if (/write|essay|describe/.test(t)) return 'writing'
  if (/listen|audio|recording/.test(t)) return 'listening'
  return 'grammar'
}

function detectExType(instruction: string): string {
  const s = instruction.toLowerCase()
  if (/put the words|correct order/.test(s))      return 'order'
  if (/find the error|for each sentence/.test(s)) return 'error'
  if (/underline|circle the correct/.test(s))     return 'underline'
  if (/match/.test(s))                            return 'match'
  if (/complete|fill in/.test(s))                 return 'complete'
  if (/write|describe|how will/.test(s))          return 'write'
  return 'generic'
}

function detectDifficulty(cefrLevel: string | null): { label: 'easy'|'medium'|'hard'; score: number } {
  if (['A1','A2'].includes(cefrLevel ?? '')) return { label: 'easy',   score: 25 }
  if (['B1','B2'].includes(cefrLevel ?? '')) return { label: 'medium', score: 55 }
  if (['C1','C2'].includes(cefrLevel ?? '')) return { label: 'hard',   score: 80 }
  return { label: 'medium', score: 50 }
}

// ─── PASO 1: Pre-fusión ───────────────────────────────────────────────────────
// Fusiona ítems fragmentados: "1\ntexto" → "1  texto"
// Preserva las líneas de opciones de columna derecha con un prefijo especial

function prefuse(lines: string[]): string[] {
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const raw  = lines[i]
    const line = raw.trim()
    i++

    if (!line) continue
    if (JUNK.test(line)) continue

    // Opción de ejemplo "  a    a  texto" — ignorar
    if (COL_OPTION_EXAMPLE.test(raw)) continue

    // Opción de columna derecha "  b  texto" → preservar como "__OPT__b|texto"
    const optM = COL_OPTION.exec(raw)
    if (optM) {
      out.push(`__OPT__${optM[1]}|${optM[2].trim()}`)
      continue
    }

    // Continuaciones de opciones (texto sin número ni sección, corto)
    // "New Zealand.", "this year." — marcar como continuación de la última opción
    if (MATCH_CONTINUATION.test(line)) {
      out.push(`__OPT_CONT__|${line}`)
      continue
    }

    // Número solo (1-99) → fusionar con siguiente línea útil
    const numM = NUM_ONLY.exec(line)
    if (numM) {
      const num = parseInt(numM[1])
      while (i < lines.length) {
        const nxtRaw = lines[i]
        const nxt    = nxtRaw.trim()
        i++
        if (!nxt || JUNK.test(nxt)) continue
        if (COL_OPTION_EXAMPLE.test(nxtRaw)) continue
        if (SECTION_TITLE.test(nxt) || SECTION_LETTER.test(nxt)) { i--; break }
        out.push(`${num}  ${nxt}`)
        break
      }
      continue
    }

    out.push(line)
  }

  // Post-proceso: fusionar continuaciones con la opción anterior
  const merged: string[] = []
  for (const l of out) {
    if (l.startsWith('__OPT_CONT__|') && merged.length > 0) {
      const cont = l.replace('__OPT_CONT__|', '')
      const last = merged[merged.length - 1]
      if (last.startsWith('__OPT__')) {
        merged[merged.length - 1] = last + ' ' + cont
        continue
      }
    }
    merged.push(l)
  }

  return merged
}

// ─── PASO 2: Parser con acumulación por sección ───────────────────────────────

function parseSections(lines: string[], cefrLevel: string | null): ParsedQuestion[] {
  const diff = detectDifficulty(cefrLevel)

  interface SectionData {
    instruction:  string
    exType:       string
    skill:        string
    items:        string[]
    matchOptions: Map<string, string>  // letra → texto completo
    insertOrder:  number
  }

  const sections = new Map<string, SectionData>()
  let nextOrder  = 0
  let curSkill   = ''
  let curLetter  = ''
  let curInstr   = ''
  let curExType  = 'generic'

  function ensureSection() {
    const key = `${curSkill}::${curLetter}`
    if (!sections.has(key)) {
      sections.set(key, {
        instruction:  curInstr,
        exType:       curExType,
        skill:        detectSkill(curInstr),
        items:        [],
        matchOptions: new Map(),
        insertOrder:  nextOrder++,
      })
    }
    return sections.get(key)!
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    i++
    if (!line) continue

    // Opción de columna derecha capturada en prefuse
    if (line.startsWith('__OPT__')) {
      const [, rest]   = line.split('__OPT__')
      const [letter, ...parts] = rest.split('|')
      const text = parts.join('|').trim()
      if (letter && text) {
        ensureSection().matchOptions.set(letter, text)
      }
      continue
    }

    // Sección principal
    if (SECTION_TITLE.test(line)) {
      curSkill = line.toUpperCase().trim(); curLetter = ''; curInstr = ''; curExType = 'generic'
      continue
    }

    // Sub-sección
    const sm = SECTION_LETTER.exec(line)
    if (sm) {
      curLetter = sm[1].toUpperCase()
      let instr = line.slice(line.indexOf(sm[2])).trim()
      // Instrucción multi-línea
      while (i < lines.length && /\bThere$/.test(instr)) {
        const nxt = lines[i].trim()
        if (!nxt || SECTION_TITLE.test(nxt) || SECTION_LETTER.test(nxt) || ITEM.test(nxt)) break
        if (/^(is an extra|been done)/i.test(nxt)) { i++; continue }
        instr += ' ' + nxt; i++
      }
      instr     = instr.replace(/\s+0\s+\S.*$/, '').trim()
      curInstr  = instr.slice(0, 220)
      curExType = detectExType(curInstr)
      ensureSection()
      continue
    }

    // Ítem numerado
    const im = ITEM.exec(line)
    if (im) {
      const num = parseInt(im[1])
      if (num === 0) continue
      let body = im[2].trim()
      body = body.replace(/\s{3,}[a-k]\s+\S.*$/, '').trim()
      body = body.replace(/\s+0\s+\w.+$/, '').trim()
      ensureSection().items.push(body)
      continue
    }

    // Continuación de ítem
    const key = `${curSkill}::${curLetter}`
    const sec = sections.get(key)
    if (sec && sec.items.length > 0 && line.length > 3 && line.length < 100 &&
        !SECTION_TITLE.test(line) && !SECTION_LETTER.test(line) &&
        !/^[a-k]\s/.test(line) && !MATCH_CONTINUATION.test(line) &&
        !line.startsWith('__OPT')) {
      sec.items[sec.items.length - 1] += ' ' + line
    }
  }

  // ── Convertir secciones → preguntas ──────────────────────────────────────
  const questions: ParsedQuestion[] = []
  const ordered = [...sections.entries()].sort((a, b) => a[1].insertOrder - b[1].insertOrder)

  for (const [, sec] of ordered) {
    // Construir array de opciones de Match ordenadas por letra
    const matchOpts = [...sec.matchOptions.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([letter, text]) => ({
        body:       `${letter}) ${text}`,
        is_correct: false,   // docente marca la correcta en la revisión
      }))

    for (const item of sec.items) {
      const body = item.trim()
      if (body.length < 4) continue

      let q_type: ParsedQuestion['q_type'] = 'short_answer'
      let options: { body: string; is_correct: boolean }[] = []

      if (sec.exType === 'match' && matchOpts.length > 0) {
        // Match: multiple_choice con las opciones de la columna derecha
        q_type  = 'multiple_choice'
        options = matchOpts.map(o => ({ ...o }))  // copia para cada pregunta
      } else if (sec.exType === 'underline') {
        // Underline: detectar X/Y inline
        const xy = [...body.matchAll(/\b([A-Za-z][a-z'\- ]{0,20}?)\s*\/\s*([A-Za-z][a-z'\- ]{0,20}?)\b/g)]
        if (xy.length > 0) {
          q_type  = 'multiple_choice'
          options = [
            { body: xy[0][1].trim(), is_correct: true  },
            { body: xy[0][2].trim(), is_correct: false },
          ]
        }
      } else if (sec.exType === 'write') {
        q_type = 'essay'
      }

      questions.push({
        body,
        q_type,
        skill:            sec.skill,
        difficulty_label: diff.label,
        difficulty_score: diff.score,
        topic:            sec.skill || null,
        explanation:      null,
        options,
        instruction:      sec.instruction || undefined,
        points:           q_type === 'essay' ? 5 : 1,
      })
    }
  }

  // Deduplicar
  const seen = new Set<string>()
  return questions.filter(q => {
    const key = q.body.slice(0, 70).toLowerCase().trim()
    if (seen.has(key) || q.body.trim().length < 4) return false
    seen.add(key); return true
  })
}

// ─── Fallback lineal ──────────────────────────────────────────────────────────

function parseFallback(text: string, cefrLevel: string | null): ParsedQuestion[] {
  const diff  = detectDifficulty(cefrLevel)
  const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const qs: ParsedQuestion[] = []
  const Q_RE   = /^\d{1,2}[\.\)]\s+(.{6,})/
  const OPT_RE = /^([a-dA-D])[\.\)\-]\s+(.+)/

  let cQ:   string | null = null
  let cOpts: { body: string; is_correct: boolean }[] = []

  function push() {
    if (!cQ || cQ.trim().length < 8) return
    const q_type: ParsedQuestion['q_type'] = cOpts.length >= 2 ? 'multiple_choice' : 'short_answer'
    qs.push({ body: cQ.trim(), q_type, skill: detectSkill(cQ),
      difficulty_label: diff.label, difficulty_score: diff.score,
      topic: null, explanation: null, options: cOpts, points: 1 })
    cQ = null; cOpts = []
  }

  for (const line of lines) {
    const qm = Q_RE.exec(line); if (qm) { push(); cQ = qm[1].trim(); continue }
    const om = OPT_RE.exec(line); if (om && cQ) { cOpts.push({ body: om[2].trim(), is_correct: cOpts.length === 0 }); continue }
    if (cQ) cQ += ' ' + line
  }
  push()
  return qs
}

// ─── Extractor principal ──────────────────────────────────────────────────────

function extractQuestions(text: string, cefrLevel: string | null): ParsedQuestion[] {
  const lines  = text.split('\n')
  const fused  = prefuse(lines)
  const result = parseSections(fused, cefrLevel)
  if (result.length >= 2) return result
  return parseFallback(text, cefrLevel)
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

    const formData  = await request.formData()
    const file      = formData.get('file') as File | null
    const cefrLevel = formData.get('cefr_level') as string | null
    const publisher = formData.get('publisher') as string | null

    if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 })
    if (file.type !== 'application/pdf') return NextResponse.json({ error: 'El archivo debe ser un PDF.' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Máximo 10MB.' }, { status: 400 })

    const pdfParse = (await import('pdf-parse')).default
    const pdfData  = await pdfParse(Buffer.from(await file.arrayBuffer()))

    if (!pdfData.text || pdfData.text.trim().length < 30) {
      return NextResponse.json({
        error: 'No se pudo extraer texto del PDF. Verificá que no sea una imagen escaneada.',
      }, { status: 422 })
    }

    const questions = extractQuestions(pdfData.text, cefrLevel || null)

    if (questions.length === 0) {
      return NextResponse.json({
        error: 'No se detectaron preguntas. El PDF debe tener texto seleccionable y ejercicios con secciones A/B/C o ítems numerados.',
      }, { status: 422 })
    }

    const skillSummary = questions.reduce<Record<string, number>>((acc, q) => {
      acc[q.skill] = (acc[q.skill] ?? 0) + 1; return acc
    }, {})
    const typeSummary = questions.reduce<Record<string, number>>((acc, q) => {
      acc[q.q_type] = (acc[q.q_type] ?? 0) + 1; return acc
    }, {})

    return NextResponse.json({
      success:       true,
      questions:     questions.map(q => ({
        ...q,
        organization_id:  profile.organization_id,
        created_by:       user.id,
        cefr_level:       cefrLevel || null,
        source_publisher: publisher || null,
      })),
      count:         questions.length,
      skill_summary: skillSummary,
      type_summary:  typeSummary,
      note:          'Para ejercicios Match: marcá cuál es la opción correcta para cada ítem. Para Underline: la primera opción está marcada por defecto.',
    })

  } catch (err: any) {
    if (err.message?.includes('Cannot find module'))
      return NextResponse.json({ error: 'Ejecutá: npm install pdf-parse' }, { status: 503 })
    return NextResponse.json({ error: err.message ?? 'Error procesando el PDF.' }, { status: 500 })
  }
}
