import { requireRole } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['director', 'coordinator', 'teacher'] as any)
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        role={profile.role}
        name={`${profile.first_name} ${profile.last_name}`}
        email={profile.email}
      />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {children}
      </div>
    </div>
  )
}
