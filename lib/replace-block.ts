// lib/replace-block.ts
//
// El enunciado de cada pregunta (questions.body) está formado por "bloques"
// separados por una línea en blanco ("\n\n"): la consigna ("📌 ..."), el texto
// de lectura o párrafo compartido, la pregunta puntual ("❓ ..."), etc.
//
// Como el alumno ve una pregunta por vez, la consigna y el texto compartido se
// repiten dentro de CADA pregunta del bloque. Para corregir un texto compartido
// hay que reemplazarlo en todas las preguntas que lo contienen, y esta función
// hace ese reemplazo. Se usa tanto en el servidor (para guardar) como en el
// cliente (para reflejar el cambio al instante), así ambos lados coinciden.

/** Reemplaza el bloque `oldBlock` por `newBlock` dentro de `body`.
 *  `oldBlock` puede abarcar varios párrafos (contiene "\n\n").
 *  Si `newBlock` queda vacío, el bloque se elimina.
 *  Devuelve el mismo `body` si `oldBlock` no está como bloque completo. */
export function replaceBlock(body: string, oldBlock: string, newBlock: string): string {
  if (!body || !oldBlock) return body
  const padded = `\n\n${body}\n\n`
  const needle = `\n\n${oldBlock}\n\n`
  if (!padded.includes(needle)) return body
  const piece  = newBlock.trim() ? `\n\n${newBlock.trim()}\n\n` : '\n\n'
  return padded.split(needle).join(piece).replace(/^\n\n/, '').replace(/\n\n$/, '')
}

/** ¿Contiene `body` el bloque `oldBlock` completo? */
export function hasBlock(body: string, oldBlock: string): boolean {
  if (!body || !oldBlock) return false
  return `\n\n${body}\n\n`.includes(`\n\n${oldBlock}\n\n`)
}
