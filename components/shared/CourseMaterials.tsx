'use client'

// components/shared/CourseMaterials.tsx
// Repositorio de materiales PDF por curso
// Visible para todos — subida solo para staff (director/coordinator/secretary/teacher)

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Material {
  id:          string
  title:       string
  description: string | null
  file_url:    string
  file_name:   string
  file_size:   number | null
  created_at:  string
  uploaded_by: string
  profiles:    { first_name: string; last_name: string } | null
}

interface Props {
  courseId:   string
  courseName: string
  canUpload:  boolean   // true para staff, false para alumnos
}

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CourseMaterials({ courseId, courseName, canUpload }: Props) {
  const supabase  = createClient()
  const sb        = supabase as any
  const fileRef   = useRef<HTMLInputElement>(null)

  const [materials,  setMaterials]  = useState<Material[]>([])
  const [loading,    setLoading]    = useState(true)
  const [uploading,  setUploading]  = useState(false)
  const [uploadErr,  setUploadErr]  = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)

  // Form de subida
  const [file,        setFile]        = useState<File | null>(null)
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [showForm,    setShowForm]    = useState(false)

  // Usuario actual
  const [userId,   setUserId]   = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    sb.auth.getUser().then(({ data }: any) => {
      if (data?.user) {
        setUserId(data.user.id)
        sb.from('profiles').select('role_id').eq('id', data.user.id).single()
          .then(({ data: p }: any) => {
            const roleMap: Record<number, string> = { 1:'director',2:'coordinator',3:'secretary',4:'student',5:'teacher' }
            setUserRole(roleMap[p?.role_id] ?? null)
          })
      }
    })
    loadMaterials()
  }, [courseId])

  async function loadMaterials() {
    setLoading(true)
    const { data } = await sb
      .from('course_materials')
      .select('*, profiles(first_name, last_name)')
      .eq('course_id', courseId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setMaterials(data ?? [])
    setLoading(false)
  }

  async function handleUpload() {
    if (!file || !title.trim()) { setUploadErr('Título y archivo requeridos.'); return }
    // Validar tamaño antes de subir (200MB)
    if (file.size > 200 * 1024 * 1024) {
      setUploadErr('El archivo supera el límite de 200MB.')
      return
    }
    setUploading(true); setUploadErr(null)

    try {
      // 1. Obtener org_id del usuario
      const { data: profile } = await sb
        .from('profiles').select('organization_id').eq('id', userId).single()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No se encontró la organización.')

      // 2. Subir archivo a Storage
      const ext      = file.name.split('.').pop()
      const filePath = `${orgId}/${courseId}/${Date.now()}_${file.name}`
      const { error: storageErr } = await supabase.storage
        .from('course-materials')
        .upload(filePath, file, { cacheControl: '3600', upsert: false })

      if (storageErr) throw new Error(`Error al subir: ${storageErr.message}`)

      // 3. Obtener URL pública (firmada si es privado, o pública si bucket es público)
      const { data: urlData } = supabase.storage
        .from('course-materials')
        .getPublicUrl(filePath)
      const fileUrl = urlData?.publicUrl ?? filePath

      // 4. Guardar registro en BD
      const { error: dbErr } = await sb.from('course_materials').insert({
        course_id:        courseId,
        organization_id:  orgId,
        uploaded_by:      userId,
        title:            title.trim(),
        description:      description.trim() || null,
        file_url:         fileUrl,
        file_name:        file.name,
        file_size:        file.size,
      })

      if (dbErr) throw new Error(`Error al guardar: ${dbErr.message}`)

      // Reset form
      setFile(null); setTitle(''); setDescription(''); setShowForm(false)
      if (fileRef.current) fileRef.current.value = ''
      await loadMaterials()

    } catch (err: any) {
      setUploadErr(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(materialId: string, fileUrl: string) {
    if (!confirm('¿Eliminar este material?')) return
    setDeleting(materialId)
    try {
      // Extraer path del Storage desde la URL
      const url      = new URL(fileUrl)
      const pathParts = url.pathname.split('/course-materials/')
      if (pathParts.length > 1) {
        await supabase.storage.from('course-materials').remove([pathParts[1]])
      }
      await sb.from('course_materials').update({ is_active: false }).eq('id', materialId)
      setMaterials(prev => prev.filter(m => m.id !== materialId))
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  async function handleDownload(material: Material) {
    // Crear URL firmada temporal (10 minutos)
    try {
      const url      = new URL(material.file_url)
      const pathParts = url.pathname.split('/course-materials/')
      if (pathParts.length > 1) {
        const { data } = await supabase.storage
          .from('course-materials')
          .createSignedUrl(pathParts[1], 600)
        if (data?.signedUrl) {
          const a = document.createElement('a')
          a.href = data.signedUrl
          a.download = material.file_name
          a.click()
          return
        }
      }
    } catch {}
    // Fallback: abrir directamente
    window.open(material.file_url, '_blank')
  }

  const canDelete = (m: Material) =>
    m.uploaded_by === userId || ['director','coordinator'].includes(userRole ?? '')

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">📚 Material del curso</h2>
          <p className="text-xs text-gray-400 mt-0.5">PDFs y archivos para descargar</p>
        </div>
        {canUpload && (
          <button
            onClick={() => setShowForm(p => !p)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showForm
                ? 'border-purple-300 text-purple-700 bg-purple-50'
                : 'border-gray-200 text-gray-600 hover:border-purple-300'
            }`}
          >
            {showForm ? '✕ Cancelar' : '+ Subir material'}
          </button>
        )}
      </div>

      {/* ── Formulario de subida ── */}
      {showForm && canUpload && (
        <div className="mb-4 rounded-xl border border-purple-100 bg-purple-50/30 p-4 space-y-3">
          <div>
            <label className="label text-xs mb-1">Título del material *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Unit 1 — Vocabulary Sheet" className="input text-sm" />
          </div>
          <div>
            <label className="label text-xs mb-1">Descripción (opcional)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ej: Hoja de vocabulario para practicar en casa" className="input text-sm" />
          </div>
          <div>
            <label className="label text-xs mb-1">Archivo *</label>
            <div
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                file ? 'border-purple-300 bg-white' : 'border-gray-200 hover:border-purple-300'
              }`}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.[^/.]+$/, '')) }
                }}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <svg viewBox="0 0 20 20" fill="none" stroke="#642f8d" strokeWidth={1.5} className="h-5 w-5">
                    <path d="M13 2H6a1 1 0 00-1 1v14a1 1 0 001 1h8a1 1 0 001-1V6z"/>
                    <path d="M13 2v4h4M8 10h4M8 13h3"/>
                  </svg>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-400">{formatSize(file.size)} · Clic para cambiar</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500">Clic para seleccionar archivo</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, Word, PowerPoint, imágenes · Máx. 200MB</p>
                </div>
              )}
            </div>
          </div>

          {uploadErr && (
            <p className="text-xs text-red-600">⚠ {uploadErr}</p>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || !file || !title.trim()}
            className="btn-brand w-full text-sm disabled:opacity-40"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Subiendo…
              </span>
            ) : 'Subir material'}
          </button>
        </div>
      )}

      {/* ── Lista de materiales ── */}
      {loading ? (
        <div className="py-8 text-center text-xs text-gray-400">Cargando materiales…</div>
      ) : materials.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-2xl mb-2">📂</p>
          <p className="text-sm text-gray-400">No hay materiales subidos todavía.</p>
          {canUpload && (
            <p className="text-xs text-gray-400 mt-1">Subí PDFs, presentaciones o imágenes para que los alumnos puedan descargarlos.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map(m => (
            <div key={m.id}
              className="flex items-start gap-3 rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-colors group">

              {/* Icono PDF */}
              <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: '#f5eefb' }}>
                <svg viewBox="0 0 20 20" fill="none" stroke="#642f8d" strokeWidth={1.5} className="h-5 w-5">
                  <path d="M13 2H6a1 1 0 00-1 1v14a1 1 0 001 1h8a1 1 0 001-1V6z"/>
                  <path d="M13 2v4h4M8 10h4M8 13h3"/>
                </svg>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                {m.description && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{m.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                  <span>{formatDate(m.created_at)}</span>
                  {m.file_size && <span>· {formatSize(m.file_size)}</span>}
                  {m.profiles && (
                    <span>· {m.profiles.first_name} {m.profiles.last_name}</span>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleDownload(m)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#642f8d' }}
                  title="Descargar"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3.5 w-3.5">
                    <path d="M8 2v8M5 7l3 3 3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1"/>
                  </svg>
                  Descargar
                </button>
                {canDelete(m) && (
                  <button
                    onClick={() => handleDelete(m.id, m.file_url)}
                    disabled={deleting === m.id}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Eliminar"
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
                      <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
