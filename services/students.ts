import { createClient } from '@/lib/supabase/server'
import type { StudentStats, Profile } from '@/types'

export async function getStudentStats(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_student_stats')
    .select('*')
    .eq('organization_id', orgId)
    .order('last_name')

  return { data: (data ?? []) as StudentStats[], error }
}

export async function getStudents(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*, roles!inner(name)')
    .eq('organization_id', orgId)
    .eq('roles.name', 'student')
    .eq('is_active', true)
    .order('last_name')

  return { data: (data ?? []) as Profile[], error }
}

export async function getStudentById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_student_stats')
    .select('*')
    .eq('id', id)
    .single()

  return { data: data as StudentStats | null, error }
}
