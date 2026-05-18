'use client'

// components/shared/ClassRecordings.tsx
// Sección "Grabaciones de Clase" dentro de un curso
// Staff: puede subir videos MP4 de Zoom
// Alumnos: pueden ver y reproducir los videos de su curso

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/hooks/useConfirm'

interface Recording {
  id:              string
  title:           string
  description:     string | null
  storage_path:    string
  file_size_bytes: number | null
  duration_sec:    number | null
  recorded_at:     string | null
  is_visible:      boolean
  created_at:      string
}

interface Props {
  courseId:   string
  courseName: string
  canUpload:  boolean   // true para staff
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function ClassRecordings({ courseId, courseName, canUpload }: Props) {
  const supabase  = createClient()
  const fileRef   = useRef<HTMLInputElement>(null)

  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading]       = useState(true)
  const [uploading, setUploading]   = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showUpload, setShowUpload]  = useState(false)
  const [playing, setPlaying]        = useState<string | null>(null)
  const [videoUrls, setVideoUrls]    = useState<Record<string, string>>({})
  const [error, setError]            = useState('')
  const { confirm, ConfirmDialogNode } = useConfirm()

  // Form de subida
  const [title, setTitle]       = useState('')
  const [desc, setDesc]         = useState('')
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10))
  const [file, setFile]         = useState<File | null>(null)

  useEffect(() => { loadRecordings() }, [courseId])

  async function loadRecordings() {
    const { data } = await (supabase as any)
      .from('class_recordings')
      .select('*')
      .eq('course_id', courseId)
      .eq('is_visible', true)
      .order('recorded_at', { ascending: false })
    setRecordings(data ?? [])
    setLoading(false)
  }

  async function getVideoUrl(storagePath: string): Promise<string> {
    if (videoUrls[storagePath]) return videoUrls[storagePath]
    const { data } = await supabase.storage
      .from('class-recordings')
      .createSignedUrl(storagePath, 3600)  // URL válida por 1 hora
    const url = data?.signedUrl ?? ''
    setVideoUrls(prev => ({ ...prev, [storagePath]: url }))
    return url
  }

  async function handlePlay(recording: Recording) {
    if (playing === recording.id) { setPlaying(null); return }
    const url = await getVideoUrl(recording.storage_path)
    if (url) setPlaying(recording.id)
  }

  async function handleUpload() {
    if (!file || !title.trim()) return
    setUploading(true)
    setError('')
    setUploadProgress(0)

    try {
      const ext       = file.name.split('.').pop()
      const timestamp = Date.now()
      const path      = `${courseId}/${timestamp}_${title.replace(/\s+/g, '_')}.${ext}`

      // Subir archivo a Storage
      const { error: uploadErr } = await supabase.storage
        .from('class-recordings')
        .upload(path, file, {
          cacheControl: '3600',
          upsert:       false,
        })

      if (uploadErr) throw uploadErr

      // Guardar metadata en DB
      const { data: { user } } = await supabase.auth.getUser()
      await (supabase as any).from('class_recordings').insert({
        course_id:       courseId,
        uploaded_by:     user?.id,
        title:           title.trim(),
        description:     desc.trim() || null,
        storage_path:    path,
        file_size_bytes: file.size,
        recorded_at:     date || null,
      })

      // Notificar a alumnos del curso
      await fetch('/api/notifications/class-recording', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ course_id: courseId, recording_title: title.trim() }),
      }).catch(() => {})

      // Reset form
      setTitle('')
      setDesc('')
      setFile(null)
      setShowUpload(false)
      await loadRecordings()

    } catch (err: any) {
      setError(err.message ?? 'Error subiendo el archivo. Verificá tu conexión e intentá de nuevo.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  async function toggleVisibility(id: string, current: boolean) {
    if (current) {
      const ok = await confirm({
        title:       'Ocultar grabación',
        message:     'Los alumnos no podrán verla hasta que la vuelvas a activar.',
        confirmText: 'Ocultar',
        variant:     'warning',
      })
      if (!ok) return
    }
    await (supabase as any)
      .from('class_recordings')
      .update({ is_visible: !current })
      .eq('id', id)
    setRecordings(prev => prev.map(r => r.id === id ? { ...r, is_visible: !current } : r))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">📹</span>
          <div>
            <h3 className="font-semibold text-gray-900">Grabaciones de Clase</h3>
            <p className="text-xs text-gray-400">{courseName}</p>
          </div>
        </div>
        {canUpload && (
          <button
            onClick={() => setShowUpload(p => !p)}
            className="text-sm px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            {showUpload ? 'Cancelar' : '+ Subir grabación'}
          </button>
        )}
      </div>

      {/* Form de subida */}
      {showUpload && canUpload && (
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-purple-900">Subir grabación de Zoom</p>

          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
              file ? 'border-purple-400 bg-white' : 'border-purple-300 hover:border-purple-400'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <div className="text-2xl mb-1">🎬</div>
            {file ? (
              <>
                <p className="text-sm font-medium text-purple-800">{file.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatBytes(file.size)}</p>
              </>
            ) : (
              <>
                <p className="text-sm text-purple-700 font-medium">Subí el MP4 de Zoom</p>
                <p className="text-xs text-gray-500 mt-0.5">MP4, WebM, MOV · máx 500MB</p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Título</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="ej: Clase 3 — Present Perfect"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de la clase</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción (opcional)</label>
            <input
              type="text"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Temas tratados en la clase…"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {uploading && (
            <div className="space-y-1">
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${uploadProgress}%`, backgroundColor: '#642f8d' }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">Subiendo… esto puede tardar unos minutos</p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || !title.trim() || uploading}
            className="w-full py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: '#642f8d' }}
          >
            {uploading ? 'Subiendo…' : 'Guardar grabación'}
          </button>
        </div>
      )}

      {/* Lista de grabaciones */}
      {recordings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <div className="text-4xl mb-3">📹</div>
          <p className="font-medium text-gray-700">Sin grabaciones aún</p>
          {canUpload && (
            <p className="text-sm text-gray-400 mt-1">
              Subí las grabaciones de Zoom después de cada clase.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {recordings.map(r => {
            const isPlaying = playing === r.id
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail / play button */}
                    <button
                      onClick={() => handlePlay(r)}
                      className="w-16 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:opacity-80"
                      style={{ backgroundColor: isPlaying ? '#642f8d' : '#f5eefb' }}
                    >
                      {isPlaying ? (
                        <svg viewBox="0 0 20 20" fill="white" className="w-5 h-5">
                          <rect x="5" y="4" width="3" height="12"/>
                          <rect x="12" y="4" width="3" height="12"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 20 20" fill="#642f8d" className="w-5 h-5">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                        </svg>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{r.title}</p>
                      {r.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {r.recorded_at && (
                          <span className="text-xs text-gray-400">
                            📅 {new Date(r.recorded_at).toLocaleDateString('es-AR', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                            })}
                          </span>
                        )}
                        {r.file_size_bytes && (
                          <span className="text-xs text-gray-400">
                            {formatBytes(r.file_size_bytes)}
                          </span>
                        )}
                        {r.duration_sec && (
                          <span className="text-xs text-gray-400">
                            ⏱ {formatDuration(r.duration_sec)}
                          </span>
                        )}
                      </div>
                    </div>

                    {canUpload && (
                      <button
                        onClick={() => toggleVisibility(r.id, r.is_visible)}
                        className={`text-xs px-2.5 py-1 rounded-lg border flex-shrink-0 ${
                          r.is_visible
                            ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            : 'border-amber-200 text-amber-600 bg-amber-50'
                        }`}
                      >
                        {r.is_visible ? 'Visible' : 'Oculta'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Video player inline */}
                {isPlaying && videoUrls[r.storage_path] && (
                  <div className="border-t border-gray-100">
                    <video
                      src={videoUrls[r.storage_path]}
                      controls
                      autoPlay
                      className="w-full"
                      style={{ maxHeight: '400px' }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {ConfirmDialogNode}
    </div>
  )
}
