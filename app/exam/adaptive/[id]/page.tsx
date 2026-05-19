import { redirect } from 'next/navigation'

// Evaluación adaptativa temporalmente deshabilitada
// El banco de preguntas necesita mayor volumen para que el algoritmo funcione correctamente
// TODO: rehabilitar cuando haya ≥ 200 preguntas por skill con distribución de dificultad

export default function AdaptiveExamPage() {
  // Redirigir silenciosamente a /exam en lugar de mostrar una pantalla de error
  redirect('/exam')
}
