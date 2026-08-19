// lib/temp-password.ts
// Genera contraseñas temporales pensadas para que el alumno las pueda TIPEAR
// a mano sin errores (muchos no saben copiar/pegar y prefieren escribirla):
// - Solo minúsculas + números → nunca hay que tocar Mayús/Shift
// - Sin caracteres ambiguos: se excluyen 0/o, 1/l/i, que se confunden entre sí
//   y con letras parecidas en la mayoría de los teclados de celular

const SAFE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'

export function generateTempPassword(length = 8): string {
  let pass = ''
  for (let i = 0; i < length; i++) {
    pass += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)]
  }
  return pass
}

// Validación para cuando el director/secretaria escribe una contraseña
// personalizada a mano (por ejemplo, algo simple para que el alumno
// no se confunda al tipearla).
export function isValidCustomPassword(pw: unknown): pw is string {
  return typeof pw === 'string' && pw.trim().length >= 6
}
