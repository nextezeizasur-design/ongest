// lib/errors.ts
// Convierte errores técnicos en mensajes amigables para el usuario

interface SupabaseError {
  message?: string
  code?:    string
}

const ERROR_MESSAGES: Record<string, string> = {
  // Auth
  'Invalid login credentials':      'Email o contraseña incorrectos.',
  'Email not confirmed':             'Confirmá tu email antes de iniciar sesión.',
  'User already registered':         'Este email ya está registrado.',
  'Password should be at least':     'La contraseña debe tener al menos 6 caracteres.',

  // Network
  'Failed to fetch':                 'Sin conexión. Verificá tu internet e intentá de nuevo.',
  'NetworkError':                    'Error de red. Verificá tu conexión.',
  'Load failed':                     'No se pudo cargar. Verificá tu conexión.',

  // Storage
  'The object exceeded the maximum allowed size': 'El archivo supera el tamaño máximo permitido.',
  'invalid input syntax for type uuid':           'Referencia inválida.',

  // RLS / permisos
  'insufficient_privilege':          'No tenés permisos para realizar esta acción.',
  'new row violates row-level':       'No tenés permisos para esta operación.',
  'violates unique constraint':       'Este registro ya existe.',
  'violates foreign key constraint':  'Referencia inválida — el registro relacionado no existe.',

  // Negocio
  'max_attempts':                    'Ya usaste todos los intentos disponibles.',
  'not_available':                   'Esta evaluación no está disponible.',
}

export function friendlyError(err: SupabaseError | Error | unknown): string {
  if (!err) return 'Error desconocido.'

  const message = (err as any)?.message ?? String(err)

  // Buscar coincidencia parcial en el mapa
  for (const [key, friendly] of Object.entries(ERROR_MESSAGES)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return friendly
    }
  }

  // Error genérico si no hay coincidencia
  if (message.length < 100) return message
  return 'Ocurrió un error inesperado. Intentá de nuevo.'
}

// Helper para usar en catch blocks
export function logAndFriendly(err: unknown, context?: string): string {
  if (context) console.error(`[${context}]`, err)
  else console.error(err)
  return friendlyError(err)
}
