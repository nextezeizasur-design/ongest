'use client'

// RUTA: components/shared/EvaluationEditorError.tsx
//
// Error boundary para las rutas del editor de evaluaciones (new/edit, en
// coordinator y director). Antes de esto no existía NINGÚN error.tsx en
// el proyecto: si algo tiraba una excepción no controlada durante la
// edición, React desmontaba toda la pantalla y quedaba en blanco, sin
// forma de recuperarse ni de saber qué pasó.
//
// Con el autoguardado del editor (ver app/coordinator/evaluations/new/page.tsx),
// el progreso queda en localStorage, así que si esta pantalla aparece el
// borrador sigue disponible al volver a entrar.

import { useEffect } from 'react'

export default function EvaluationEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Editor de evaluaciones] Error no controlado:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-4xl">⚠️</span>
      <div className="space-y-1.5 max-w-md">
        <h1 className="text-base font-semibold text-gray-900">Algo salió mal en el editor</h1>
        <p className="text-sm text-gray-500">
          No pierdas tiempo: tu progreso se guarda automáticamente como borrador local.
          Al volver a entrar a "Nueva evaluación" te vamos a ofrecer recuperarlo.
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={reset} className="btn-outline text-sm">
          Reintentar
        </button>
        <button onClick={() => window.location.reload()} className="btn-brand text-sm">
          Recargar página
        </button>
      </div>
    </div>
  )
}
