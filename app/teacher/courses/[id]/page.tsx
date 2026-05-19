export const dynamic   = 'force-dynamic'
export const revalidate = 0

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import CefrPill from '@/components/ui/CefrPill'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import ClassRecordings from '@/components/shared/ClassRecordings'
import CourseMaterials from '@/components/shared/CourseMaterials'
import Link from 'next/link'

export default async function TeacherCourseDetail({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id }  = await params
  const { tab } = await searchParams
  const activeTab = tab ?? 'info'

  const profile  = await requireRole(['director', 'coordinator', 'teacher'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  const { data: course } = await sb
    .from('courses')
    .select('id, name, description, is_active, schedule_days, schedule_time, bibliography, notes, cefr_level_id, teacher_id, organization_id')
    .eq('id', id)
    .single()

  if (!course) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-400">Curso no encontrado.</p>
      </div>
    )
  }

  const [
    { data: cefrLevel },
    { data: enrollments },
  ] = await Promise.all([
    course.cefr_level_id
      ? sb.from('cefr_levels').select('id, code, label').eq('id', course.cefr_level_id).single()
      : { data: null },
    sb.from('enrollments')
      .select('profiles(id, first_name, last_name, email, is_active)')
      .eq('course_id', id),
  ])

  const students = (enrollments ?? []).map((e: any) => e.profiles).filter(Boolean)

  const tabs = [
    { key: 'info',       label: 'Información',  icon: '📋' },
    { key: 'recordings', label: 'Grabaciones',  icon: '📹' },
    { key: 'materials',  label: 'Material',     icon: '📚' },
    { key: 'students',   label: `Alumnos (${students.length})`, icon: '👥' },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title={course.name}
        subtitle={cefrLevel ? `${cefrLevel.label} · ${cefrLevel.code}` : 'Sin nivel'}
        actions={
          <Link href="/teacher/courses" className="btn-outline text-sm">← Volver</Link>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Tabs de navegación */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 w-fit">
          {tabs.map(t => (
            <Link
              key={t.key}
              href={`/teacher/courses/${id}?tab=${t.key}`}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                activeTab === t.key
                  ? 'text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              style={activeTab === t.key ? { background: '#642f8d' } : {}}
            >
              <span>{t.icon}</span>
              {t.label}
            </Link>
          ))}
        </div>

        {/* ── Tab: Información ── */}
        {activeTab === 'info' && (
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Información del curso</h2>

            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-gray-400">Nivel</p>
                <div className="mt-1">
                  {cefrLevel ? <CefrPill code={cefrLevel.code} /> : <span className="text-gray-400">—</span>}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400">Alumnos</p>
                <p className="font-medium text-gray-900 mt-1">{students.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Estado</p>
                <div className="mt-1">
                  <Badge variant={course.is_active ? 'green' : 'gray'}>
                    {course.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
            </div>

            {(course.schedule_days || course.schedule_time) && (
              <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-6 text-sm">
                {course.schedule_days && (
                  <div>
                    <p className="text-xs text-gray-400">📅 Días</p>
                    <p className="font-medium text-gray-900 mt-0.5">{course.schedule_days}</p>
                  </div>
                )}
                {course.schedule_time && (
                  <div>
                    <p className="text-xs text-gray-400">🕐 Horario</p>
                    <p className="font-medium text-gray-900 mt-0.5">{course.schedule_time}</p>
                  </div>
                )}
              </div>
            )}

            {course.bibliography && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1.5">📚 Bibliografía</p>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{course.bibliography}</p>
              </div>
            )}

            {course.description && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1.5">Descripción</p>
                <p className="text-sm text-gray-500 leading-relaxed">{course.description}</p>
              </div>
            )}

            {course.notes && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1.5">🗒 Notas internas</p>
                <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{course.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Grabaciones ── */}
        {activeTab === 'recordings' && (
          <ClassRecordings
            courseId={id}
            courseName={course.name}
            canUpload={true}
          />
        )}

        {/* ── Tab: Material ── */}
        {activeTab === 'materials' && (
          <CourseMaterials
            courseId={id}
            courseName={course.name}
            canUpload={true}
          />
        )}

        {/* ── Tab: Alumnos ── */}
        {activeTab === 'students' && (
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">
                Alumnos inscriptos <span className="text-gray-400 font-normal">({students.length})</span>
              </h2>
            </div>
            {students.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No hay alumnos inscriptos.</div>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Email</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s: any) => (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar firstName={s.first_name} lastName={s.last_name} size="sm" />
                          <p className="font-medium text-gray-900">{s.first_name} {s.last_name}</p>
                        </div>
                      </td>
                      <td className="text-gray-500">{s.email}</td>
                      <td>
                        <Badge variant={s.is_active ? 'green' : 'gray'}>
                          {s.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
