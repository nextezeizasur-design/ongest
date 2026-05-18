import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import TopBar from '@/components/layout/TopBar'
import CefrPill from '@/components/ui/CefrPill'
import CourseMaterials from '@/components/shared/CourseMaterials'

export const metadata = { title: 'Mi Curso' }

export default async function MiCursoPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'student') redirect('/exam')

  const supabase = await createClient()
  const sb       = supabase as any

  // Obtener la inscripción activa del alumno
  // NOTA: no filtramos por is_active en enrollments porque esa columna puede no existir
  const { data: enrollment } = await sb
    .from('enrollments')
    .select(`
      course_id,
      courses(
        id, name, description, schedule_days, schedule_time,
        bibliography, is_active, teacher_id,
        cefr_levels(id, code, label),
        profiles(id, first_name, last_name, email)
      )
    `)
    .eq('student_id', profile.id)
    .maybeSingle()

  const course = enrollment?.courses ?? null

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      <div className="hidden md:block">
        <Sidebar
          role="student"
          name={`${profile.first_name} ${profile.last_name}`}
          email={profile.email}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          title="Mi Curso"
          subtitle={course ? course.name : 'Sin curso asignado'}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 space-y-4">

          {!course ? (
            <div className="space-y-4">
              {/* Estado vacío — sin curso asignado */}
              <div className="card text-center py-10">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-4"
                  style={{ background: '#f5eefb' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#642f8d" strokeWidth={1.5} className="h-8 w-8">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  Todavía no estás inscripto en ningún curso
                </h3>
                <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
                  Para acceder a tus clases y exámenes necesitás estar asignado a un curso por la secretaría del instituto.
                </p>
              </div>

              {/* Qué hacer */}
              <div className="card">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">¿Qué tenés que hacer?</h4>
                <ol className="space-y-3">
                  {[
                    { step: '1', text: 'Comunicate con la secretaría del instituto' },
                    { step: '2', text: 'Pediles que te asignen al curso que corresponde a tu nivel' },
                    { step: '3', text: 'Una vez inscripto, vas a ver tus clases y exámenes acá' },
                  ].map(item => (
                    <li key={item.step} className="flex items-start gap-3">
                      <span
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: '#642f8d' }}
                      >
                        {item.step}
                      </span>
                      <p className="text-sm text-gray-600 pt-0.5">{item.text}</p>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Ir a exámenes */}
              <div className="card flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">¿Ya te inscribieron?</p>
                  <p className="text-xs text-gray-400 mt-0.5">Actualizá la página para ver tu curso.</p>
                </div>
                <a
                  href="/exam/mi-curso"
                  onClick={() => window.location.reload()}
                  className="btn-brand text-sm"
                >
                  Actualizar
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* ── Info del curso ── */}
              <div className="card">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ background: '#f5eefb' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#642f8d" strokeWidth={1.5} className="h-6 w-6">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-gray-900">{course.name}</h2>
                      {course.cefr_levels && (
                        <CefrPill code={course.cefr_levels.code} />
                      )}
                    </div>
                    {course.cefr_levels && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Nivel {course.cefr_levels.code} — {course.cefr_levels.label}
                      </p>
                    )}
                  </div>
                </div>

                {/* Horario */}
                {(course.schedule_days || course.schedule_time) && (
                  <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
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

                {/* Docente */}
                {course.profiles && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-2">👩‍🏫 Docente</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                        style={{ background: '#642f8d' }}>
                        {course.profiles.first_name?.[0]}{course.profiles.last_name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {course.profiles.first_name} {course.profiles.last_name}
                        </p>
                        <p className="text-xs text-gray-400">{course.profiles.email}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Descripción */}
                {course.description && (
                  <p className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500 leading-relaxed">
                    {course.description}
                  </p>
                )}
              </div>

              {/* ── Bibliografía ── */}
              {course.bibliography && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">📚 Bibliografía</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                    {course.bibliography}
                  </p>
                </div>
              )}

              {/* ── Repositorio de materiales ── */}
              <CourseMaterials
                courseId={course.id}
                courseName={course.name}
                canUpload={false}
              />
            </>
          )}
        </main>
      </div>

      <MobileNav />
    </div>
  )
}
