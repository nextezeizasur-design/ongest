export const dynamic    = 'force-dynamic'
export const revalidate = 0

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import CefrPill from '@/components/ui/CefrPill'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Link from 'next/link'

export default async function SecretaryCourseDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = await params
  const profile  = await requireRole(['director', 'coordinator', 'secretary'] as any)
  const supabase = await createClient()
  const sb       = supabase as any

  const { data: course } = await sb
    .from('courses')
    .select('id, name, description, is_active, schedule_days, schedule_time, bibliography, cefr_level_id, teacher_id')
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
    { data: teacher },
    { data: enrollments },
  ] = await Promise.all([
    course.cefr_level_id
      ? sb.from('cefr_levels').select('code, label').eq('id', course.cefr_level_id).single()
      : { data: null },
    course.teacher_id
      ? sb.from('profiles').select('first_name, last_name, email').eq('id', course.teacher_id).single()
      : { data: null },
    sb.from('enrollments')
      .select('id, student_id, enrolled_at, profiles(id, first_name, last_name, email, is_active)')
      .eq('course_id', id)
      .order('enrolled_at', { ascending: false }),
  ])

  const students = (enrollments ?? []).map((e: any) => ({
    enrollmentId: e.id,
    enrolledAt:   e.enrolled_at,
    ...e.profiles,
  })).filter((s: any) => s.id)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title={course.name}
        subtitle={cefrLevel ? `${cefrLevel.label} · ${cefrLevel.code}` : 'Sin nivel'}
        actions={
          <Link href="/secretary/courses" className="btn-outline text-sm">← Volver</Link>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Info del curso */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Información del curso</h2>

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-400">Nivel</p>
              <div className="mt-1">
                {cefrLevel ? <CefrPill code={cefrLevel.code} /> : <span className="text-gray-400">—</span>}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400">Alumnos inscriptos</p>
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
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-6 text-sm">
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
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">📚 Bibliografía</p>
              <p className="text-sm text-gray-700">{course.bibliography}</p>
            </div>
          )}

          {/* Docente */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Docente asignado</p>
            {teacher ? (
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                  style={{ background: '#642f8d' }}>
                  {teacher.first_name?.[0]}{teacher.last_name?.[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{teacher.first_name} {teacher.last_name}</p>
                  <p className="text-xs text-gray-400">{teacher.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-amber-600">⚠ Sin docente asignado</p>
            )}
          </div>
        </div>

        {/* Lista de alumnos */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Alumnos inscriptos
              <span className="text-gray-400 font-normal ml-1">({students.length})</span>
            </h2>
            <Link
              href="/secretary/students"
              className="text-xs font-medium transition-colors"
              style={{ color: '#642f8d' }}
            >
              Gestionar alumnos →
            </Link>
          </div>

          {students.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500 font-medium text-sm">Sin alumnos inscriptos</p>
              <p className="text-gray-400 text-xs mt-1">Inscribí alumnos desde la sección Alumnos.</p>
              <Link
                href="/secretary/students"
                className="inline-block mt-3 text-xs font-medium px-4 py-2 rounded-lg text-white transition-colors"
                style={{ backgroundColor: '#642f8d' }}
              >
                Ir a Alumnos →
              </Link>
            </div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Email</th>
                  <th>Estado</th>
                  <th>Inscripto</th>
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
                    <td className="text-gray-400 text-xs">
                      {s.enrolledAt
                        ? new Date(s.enrolledAt).toLocaleDateString('es-AR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  )
}
