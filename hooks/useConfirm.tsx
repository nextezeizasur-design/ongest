'use client'

// hooks/useConfirm.ts
// Hook para usar ConfirmDialog de forma declarativa
//
// Uso:
//   const { confirm, ConfirmDialogNode } = useConfirm()
//   ...
//   await confirm({
//     title:       'Eliminar pregunta',
//     message:     '¿Estás seguro? Esta acción no se puede deshacer.',
//     confirmText: 'Eliminar',
//     variant:     'danger',
//   })
//   // Solo llega acá si confirmó
//   await deleteQuestion(id)
//   ...
//   return (
//     <>
//       {ConfirmDialogNode}
//       ... resto del componente
//     </>
//   )

import { useState, useCallback, useRef } from 'react'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

interface ConfirmOptions {
  title:        string
  message:      string
  confirmText?: string
  cancelText?:  string
  variant?:     'danger' | 'warning' | 'default'
}

export function useConfirm() {
  const [open, setOpen]       = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({
    title:   '¿Confirmar?',
    message: 'Esta acción no se puede deshacer.',
  })

  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts)
    setOpen(true)
    return new Promise(resolve => {
      resolveRef.current = resolve
    })
  }, [])

  function handleConfirm() {
    setOpen(false)
    resolveRef.current?.(true)
    resolveRef.current = null
  }

  function handleCancel() {
    setOpen(false)
    resolveRef.current?.(false)
    resolveRef.current = null
  }

  const ConfirmDialogNode = (
    <ConfirmDialog
      open={open}
      title={options.title}
      message={options.message}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      variant={options.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, ConfirmDialogNode }
}
