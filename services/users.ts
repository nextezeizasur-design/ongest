import { createClient } from '@/lib/supabase/server'
import type { Profile, RoleName } from '@/types'

export async function getStaff(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('*, roles(name)')
    .eq('organization_id', orgId)
    .not('roles.name', 'eq', 'student')
    .order('last_name')

  return {
    data: (data ?? []).map((p: any) => ({ ...p, role: p.roles?.name })) as (Profile & { role: RoleName })[],
    error,
  }
}

export async function getAllUsers(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('*, roles(name)')
    .eq('organization_id', orgId)
    .order('last_name')

  return {
    data: (data ?? []).map((p: any) => ({ ...p, role: p.roles?.name })) as (Profile & { role: RoleName })[],
    error,
  }
}

export async function updateUserRole(profileId: string, roleId: number) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('profiles')
    .update({ role_id: roleId })
    .eq('id', profileId)
  return { error }
}

export async function toggleUserActive(profileId: string, isActive: boolean) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', profileId)
  return { error }
}
