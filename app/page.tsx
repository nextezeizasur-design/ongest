import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'

const ROLE_HOME: Record<string, string> = {
  director:    '/director',
  coordinator: '/coordinator',
  secretary:   '/secretary',
  student:     '/exam',
}

export default async function RootPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  redirect(ROLE_HOME[profile.role] ?? '/exam')
}
