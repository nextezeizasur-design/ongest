// lib/evaluation-edit.ts
//
// Criterio único de "¿se puede corregir el contenido de esta evaluación?".
// Lo usan la Vista previa (para mostrar/ocultar el botón Editar) y la API que
// guarda el cambio (que vuelve a validar, porque el cliente no es de fiar).
//
// Regla definida por dirección: se puede editar hasta que el examen se abre.
//   · borrador                       → editable
//   · publicado con inicio futuro    → editable (da igual si faltan 1 o 20 días)
//   · activo (abierto a los alumnos) → NO editable
//   · cerrado                        → NO editable
// Además, si ya existe algún intento de un alumno, tampoco (red de seguridad).

import { getEvalStatus } from '@/lib/utils'

export function getEditBlockReason(
  ev: { status: any; available_from?: string | null; available_until?: string | null },
  attemptCount: number,
): string | null {
  const st = getEvalStatus(ev)
  if (st === 'active') return 'El examen ya está abierto para los alumnos: no se puede modificar.'
  if (st === 'closed') return 'El examen ya cerró: no se puede modificar.'
  if (attemptCount > 0) return 'El examen ya tiene intentos de alumnos: no se puede modificar.'
  return null
}
