'use client'

// components/shared/ConfirmDialog.tsx
// Diálogo de confirmación reutilizable para acciones destructivas
// Reemplaza window.confirm() — no bloquea el thread, funciona en mobile

import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  open:        boolean
  title:       string
  message:     string
  confirmText?: string        // default: "Confirmar"
  cancelText?:  string        // default: "Cancelar"
  variant?:     'danger' | 'warning' | 'default'
  onConfirm:   () => void
  onCancel:    () => void
}

const VARIANT_CONFIG = {
  danger: {
    icon:          '🗑️',
    confirmColor:  '#dc2626',
    confirmHover:  '#b91c1c',
    iconBg:        '#fef2f2',
  },
  warning: {
    icon:          '⚠️',
    confirmColor:  '#d97706',
    confirmHover:  '#b45309',
    iconBg:        '#fffbeb',
  },
  default: {
    icon:          '❓',
    confirmColor:  '#642f8d',
    confirmHover:  '#4e2470',
    iconBg:        '#f5eefb',
  },
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText  = 'Cancelar',
  variant     = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const config    = VARIANT_CONFIG[variant]

  // Foco en cancelar por defecto — evita confirmar con Enter accidentalmente
  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6">
          {/* Icono */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4 mx-auto"
            style={{ backgroundColor: config.iconBg }}
          >
            {config.icon}
          </div>

          {/* Texto */}
          <h3 className="text-base font-semibold text-gray-900 text-center mb-2">
            {title}
          </h3>
          <p className="text-sm text-gray-500 text-center leading-relaxed">
            {message}
          </p>
        </div>

        {/* Botones */}
        <div className="flex border-t border-gray-100">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: config.confirmColor }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
