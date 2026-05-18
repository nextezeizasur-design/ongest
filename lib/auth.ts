import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, RoleName } from '@/types'

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

export async function getProfile(): Promise<(Profile & { role: RoleName }) | null> {
  const supabase = await createClient()
  const sb = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Obtener perfil con role_id
  const { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  // Obtener nombre del rol por separado (más confiable que el join implícito)
  const { data: roleData } = await sb
    .from('roles')
    .select('name')
    .eq('id', profile.role_id)
    .single()

  return {
    ...profile,
    role: (roleData?.name ?? 'student') as RoleName,
  }
}

export async function requireRole(allowed: RoleName | RoleName[]) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const roles = Array.isArray(allowed) ? allowed : [allowed]
  if (!roles.includes(profile.role as RoleName)) redirect('/')

  return profile
}
