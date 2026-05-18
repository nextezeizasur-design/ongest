import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import ClassRecordings from '@/components/shared/ClassRecordings'

export const metadata = { title: 'Grabaciones de clase' }

export default async function StudentRecordingsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'student') redirect('/exam')

  const supabase = await createClient()

  // Obtener cursos en los que está inscripto el alumno
  const { data: enrollments } = await (supabase as any)
    .from('enrollments')
    .select('courses(id, name, cefr_levels(code, label))')
    .eq('student_id', profile.id)

  const courses = (enrollments ?? [])
    .map((e: any) => e.courses)
    .filter(Boolean)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        role="student"
        name={`${profile.first_name} ${profile.last_name}`}
        email={profile.email}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          title="Grabaciones de clase"
          subtitle="Clases grabadas de tus cursos"
        />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">

            {courses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
                <div className="text-4xl mb-3">📹</div>
                <p className="font-medium text-gray-700">Sin cursos asignados</p>
                <p className="text-sm text-gray-400 mt-1">
                  Las grabaciones aparecen cuando estés inscripto en un curso.
                </p>
              </div>
            ) : (
              courses.map((course: any) => (
                <div key={course.id}>
                  {course.cefr_levels && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`cefr-pill cefr-${course.cefr_levels.code}`}>
                        {course.cefr_levels.code}
                      </span>
                    </div>
                  )}
                  <ClassRecordings
                    courseId={course.id}
                    courseName={course.name}
                    canUpload={false}
                  />
                </div>
              ))
            )}

          </div>
        </main>
      </div>
    </div>
  )
}
