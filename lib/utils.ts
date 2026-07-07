import type { CefrCode, EvalStatus, AttemptStatus } from '@/types'

// ─── Scores ───────────────────────────────────────────────────
export function formatScore(score?: number | null): string {
  if (score == null) return '—'
  return `${Math.round(score)}%`
}

export function scoreColor(score?: number | null): string {
  if (score == null) return 'text-gray-400'
  if (score >= 80) return 'text-green-700'
  if (score >= 60) return 'text-amber-700'
  return 'text-red-600'
}

export function scoreBarColor(score?: number | null): string {
  if (score == null) return 'bg-gray-200'
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-amber-400'
  return 'bg-red-400'
}

// ─── Dates ────────────────────────────────────────────────────
export function formatDate(date?: string | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(date))
}

export function formatDateShort(date?: string | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short',
  }).format(new Date(date))
}

export function formatDateTime(date?: string | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function daysUntil(date?: string | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
}

// ─── Conversión de fechas para <input type="datetime-local"> ──
// PROBLEMA QUE RESUELVEN: un <input type="datetime-local"> no tiene noción de
// zona horaria — su string ("2026-07-07T14:00") es "hora de pared", sin UTC.
// Si se guarda ese string tal cual en un timestamptz, Postgres lo toma como
// 14:00 UTC (11:00 hora Argentina), no como 14:00 hora Argentina que es lo
// que la persona tipeó. Estas dos funciones hacen la conversión correcta en
// ambos sentidos, usando siempre la zona horaria local del navegador.

// De timestamptz (UTC, ej. lo que viene de Supabase) → valor para el input,
// en hora LOCAL del navegador (para que se vea la hora real, no la de UTC).
export function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Del valor del input (hora LOCAL del navegador, sin zona) → ISO en UTC
// listo para guardar en un timestamptz.
export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null
  // "2026-07-07T14:00" sin sufijo de zona → el motor de JS lo interpreta
  // como hora local del navegador, que es exactamente lo que necesitamos.
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

// ─── Evaluation status ────────────────────────────────────────
export function getEvalStatus(ev: {
  status: EvalStatus
  available_from?: string | null
  available_until?: string | null
}): 'draft' | 'published' | 'active' | 'upcoming' | 'closed' {
  if (ev.status === 'draft')   return 'draft'
  if (ev.status === 'closed')  return 'closed'
  const now = new Date()
  if (ev.available_from && new Date(ev.available_from) > now) return 'upcoming'
  if (ev.available_until && new Date(ev.available_until) < now) return 'closed'
  return 'active'
}

export const EVAL_STATUS_LABEL: Record<string, string> = {
  draft:     'Borrador',
  published: 'Publicado',
  active:    'Activo',
  upcoming:  'Próximo',
  closed:    'Cerrado',
}

export const EVAL_STATUS_BADGE: Record<string, string> = {
  draft:     'badge-gray',
  published: 'badge-blue',
  active:    'badge-purple',
  upcoming:  'badge-amber',
  closed:    'badge-green',
}

// ─── Attempt status ───────────────────────────────────────────
export const ATTEMPT_STATUS_LABEL: Record<AttemptStatus, string> = {
  in_progress: 'En progreso',
  submitted:   'Entregado',
  graded:      'Corregido',
  timed_out:   'Tiempo agotado',
  flagged:     'Marcado',
}

// ─── Eval type labels ─────────────────────────────────────────
export const EVAL_TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Opción múltiple',
  writing:         'Writing',
  listening:       'Listening',
  mixed:           'Mixto',
}

// ─── CEFR ─────────────────────────────────────────────────────
export const CEFR_LEVELS: CefrCode[] = ['A1','A2','B1','B2','C1','C2']

// ─── Initials ─────────────────────────────────────────────────
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

// ─── Class helpers ────────────────────────────────────────────
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
