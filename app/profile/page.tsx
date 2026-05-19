import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import ProfileClient from './ProfileClient'

export const metadata = { title: 'Mi perfil — OnGest' }

export default async function ProfilePage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  return (
    <ProfileClient
      id={profile.id}
      firstName={profile.first_name}
      lastName={profile.last_name}
      email={profile.email}
      role={profile.role}
    />
  )
}
