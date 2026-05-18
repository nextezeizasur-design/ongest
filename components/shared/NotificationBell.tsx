'use client'

// components/shared/NotificationBell.tsx
// Campana de notificaciones in-app en el TopBar
// Polling cada 30s via Supabase Realtime

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Notification {
  id:         string
  type:       string
  title:      string
  body:       string
  link:       string | null
  is_read:    boolean
  created_at: string
}

const TYPE_ICON: Record<string, string> = {
  exam_result:      '📊',
  exam_available:   '📋',
  exam_graded:      '✅',
  certificate_ready:'🎓',
  recommendation:   '💡',
  class_scheduled:  '🎥',
  class_recording:  '📹',
  general:          '🔔',
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return 'ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  return `hace ${Math.floor(diff / 86400)}d`
}

export default function NotificationBell({ userId }: { userId: string }) {
  const supabase  = createClient()
  const router    = useRouter()
  const panelRef  = useRef<HTMLDivElement>(null)

  const [notifs, setNotifs]   = useState<Notification[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(true)

  const unread = notifs.filter(n => !n.is_read).length

  useEffect(() => {
    loadNotifications()

    // Realtime subscription
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        setNotifs(prev => [payload.new as Notification, ...prev].slice(0, 20))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Cerrar al hacer click afuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadNotifications() {
    const { data } = await (supabase as any)
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifs(data ?? [])
    setLoading(false)
  }

  async function markRead(id: string) {
    await supabase.from('notifications' as any)
      .update({ is_read: true })
      .eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    await supabase.from('notifications' as any)
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  function handleNotifClick(notif: Notification) {
    markRead(notif.id)
    setOpen(false)
    if (notif.link) router.push(notif.link)
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>

      {/* Botón campana */}
      <button
        onClick={() => setOpen(p => !p)}
        className="relative w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
        title="Notificaciones"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5 text-gray-600">
          <path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z"/>
          <path d="M8 16a2 2 0 004 0"/>
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1"
            style={{ backgroundColor: '#642f8d' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-0 top-11 w-80 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">
              Notificaciones {unread > 0 && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full text-white font-medium"
                  style={{ backgroundColor: '#642f8d' }}>
                  {unread}
                </span>
              )}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="overflow-y-auto max-h-[380px]">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifs.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm text-gray-500">Sin notificaciones</p>
              </div>
            ) : (
              notifs.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-3 ${
                    !n.is_read ? 'bg-purple-50/40' : ''
                  }`}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {TYPE_ICON[n.type] ?? '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: '#642f8d' }} />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
