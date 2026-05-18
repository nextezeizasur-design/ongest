// lib/rate-limit.ts
// Rate limiter en memoria — sin dependencias externas
// Funciona en Vercel serverless (resetea por instancia, suficiente para protección básica)

interface RateLimitEntry {
  count:     number
  resetAt:   number
}

const store = new Map<string, RateLimitEntry>()

interface RateLimitOptions {
  windowMs: number   // ventana de tiempo en ms
  max:      number   // máximo de requests por ventana
}

export interface RateLimitResult {
  success:   boolean
  remaining: number
  resetAt:   number
}

export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now     = Date.now()
  const entry   = store.get(key)

  // Limpiar entradas vencidas cada 100 requests
  if (store.size > 100) {
    for (const [k, v] of store.entries()) {
      if (v.resetAt < now) store.delete(k)
    }
  }

  if (!entry || entry.resetAt < now) {
    // Nueva ventana
    store.set(key, { count: 1, resetAt: now + options.windowMs })
    return { success: true, remaining: options.max - 1, resetAt: now + options.windowMs }
  }

  if (entry.count >= options.max) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { success: true, remaining: options.max - entry.count, resetAt: entry.resetAt }
}

// Helper para obtener IP del request
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}
