// lib/speaking-score.ts
// Algoritmo de scoring para respuestas de speaking
// Sin dependencias externas — puro TypeScript

// ── 1. Levenshtein distance (edit distance) ──────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
      }
    }
  }
  return dp[m][n]
}

// ── 2. Similitud entre dos strings (0-100) ───────────────────
function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 100
  const dist = levenshtein(a.toLowerCase(), b.toLowerCase())
  return Math.round(((maxLen - dist) / maxLen) * 100)
}

// ── 3. Normalizar texto para comparación ─────────────────────
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')  // eliminar puntuación
    .replace(/\s+/g, ' ')
    .trim()
}

// ── 4. Detectar keywords en la transcripción ─────────────────
function findKeywords(transcript: string, keywords: string[]): string[] {
  const normalized = normalize(transcript)
  const words      = normalized.split(' ')

  return keywords.filter(kw => {
    const kwNorm = normalize(kw)
    // Coincidencia exacta de palabra
    if (words.includes(kwNorm)) return true
    // Coincidencia parcial con tolerancia (Levenshtein ≤ 2 para palabras largas)
    if (kwNorm.length >= 5) {
      return words.some(w => levenshtein(w, kwNorm) <= 2)
    }
    return false
  })
}

// ── 5. Score de keywords (0-100) ─────────────────────────────
function keywordScore(foundKeywords: string[], totalKeywords: string[]): number {
  if (totalKeywords.length === 0) return 100
  return Math.round((foundKeywords.length / totalKeywords.length) * 100)
}

// ── 6. Función principal: calcular score completo ────────────
export interface SpeakingScoreResult {
  auto_score:      number     // score final 0-100
  similarity_pct:  number     // similitud con expected_answer
  keywords_found:  string[]   // keywords detectadas
  keyword_score:   number     // % de keywords encontradas
  feedback:        string     // mensaje de feedback
}

export function calculateSpeakingScore(
  transcript:      string,
  expectedAnswer:  string | null,
  keywords:        string[]
): SpeakingScoreResult {
  const normTranscript = normalize(transcript)
  const normExpected   = expectedAnswer ? normalize(expectedAnswer) : ''

  // Similitud con la respuesta modelo
  const simPct = normExpected
    ? similarity(normTranscript, normExpected)
    : 0

  // Keywords encontradas
  const foundKws  = keywords.length > 0 ? findKeywords(transcript, keywords) : []
  const kwScore   = keywordScore(foundKws, keywords)

  // Score final: promedio ponderado
  // Si hay expected_answer Y keywords: 40% similitud + 60% keywords
  // Si solo expected_answer: 100% similitud
  // Si solo keywords: 100% keywords
  let autoScore: number
  if (normExpected && keywords.length > 0) {
    autoScore = Math.round(simPct * 0.4 + kwScore * 0.6)
  } else if (normExpected) {
    autoScore = simPct
  } else if (keywords.length > 0) {
    autoScore = kwScore
  } else {
    // Sin referencia — score base si hay transcripción
    autoScore = normTranscript.length > 10 ? 50 : 0
  }

  // Feedback automático
  let feedback: string
  if (!transcript.trim()) {
    feedback = 'No se detectó ninguna respuesta.'
  } else if (autoScore >= 80) {
    feedback = 'Excelente respuesta. Cubriste los puntos clave correctamente.'
  } else if (autoScore >= 60) {
    feedback = 'Buena respuesta. Algunos puntos clave podrían desarrollarse más.'
  } else if (autoScore >= 40) {
    feedback = 'Respuesta parcial. Revisá los puntos clave del tema.'
  } else {
    feedback = 'Respuesta incompleta. El docente la revisará manualmente.'
  }

  return {
    auto_score:     autoScore,
    similarity_pct: simPct,
    keywords_found: foundKws,
    keyword_score:  kwScore,
    feedback,
  }
}
