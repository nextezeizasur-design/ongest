'use client'

// components/shared/Toast.tsx
// Sistema de notificaciones/toast sin dependencias externas
// Uso: import { useToast } from '@/components/shared/Toast'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id:      string
  type:    ToastType
  title:   string
  message?: string
}

interface ToastContextValue {
  success: (title: string, message?: string) => void
  error:   (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info:    (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    '💬',
}

const COLORS: Record<ToastType, { bg: string; border: string; title: string; msg: string }> = {
  success: { bg: '#eaf3de', border: '#c0dd97', title: '#27500a', msg: '#3b6d11' },
  error:   { bg: '#fcebeb', border: '#f7c1c1', title: '#791f1f', msg: '#a32d2d' },
  warning: { bg: '#faeeda', border: '#fac775', title: '#633806', msg: '#854f0b' },
  info:    { bg: '#f5eefb', border: '#ded4f7', title: '#3c3489', msg: '#534ab7' },
}

let toastCount = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((type: ToastType, title: string, message?: string) => {
    const id = `toast_${++toastCount}`
    setToasts(prev => [...prev.slice(-3), { id, type, title, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, type === 'error' ? 6000 : 4000)
  }, [])

  const ctx: ToastContextValue = {
    success: (t, m) => add('success', t, m),
    error:   (t, m) => add('error',   t, m),
    warning: (t, m) => add('warning', t, m),
    info:    (t, m) => add('info',    t, m),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      {/* Container de toasts — esquina inferior derecha, arriba del nav mobile */}
      {toasts.length > 0 && (
        <div
          className="fixed z-[100] flex flex-col gap-2 pointer-events-none"
          style={{
            bottom:  'calc(env(safe-area-inset-bottom, 0px) + 72px)',
            right:   '16px',
            left:    '16px',
            maxWidth: '360px',
            marginLeft: 'auto',
          }}
        >
          {toasts.map(toast => {
            const c = COLORS[toast.type]
            return (
              <div
                key={toast.id}
                className="rounded-xl border shadow-lg pointer-events-auto animate-in slide-in-from-bottom-2"
                style={{
                  backgroundColor: c.bg,
                  borderColor:     c.border,
                  padding:         '12px 14px',
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-base flex-shrink-0 mt-0.5">
                    {ICONS[toast.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold leading-tight"
                      style={{ color: c.title }}
                    >
                      {toast.title}
                    </p>
                    {toast.message && (
                      <p
                        className="text-xs mt-0.5 leading-relaxed"
                        style={{ color: c.msg }}
                      >
                        {toast.message}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    className="text-lg leading-none flex-shrink-0 opacity-50 hover:opacity-80 transition-opacity"
                    style={{ color: c.title }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
