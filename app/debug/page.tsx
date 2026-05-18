import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'

export default async function DebugPage() {
  const supabase = await createClient()
  const sb = supabase as any

  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let roleData = null
  let rawProfile = null

  if (user) {
    const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single()
    rawProfile = p

    if (p?.role_id) {
      const { data: r } = await sb.from('roles').select('name').eq('id', p.role_id).single()
      roleData = r
    }

    profile = await getProfile()
  }

  return (
    <div style={{ padding: 32, fontFamily: 'monospace', fontSize: 13 }}>
      <h1 style={{ marginBottom: 16 }}>🔍 Debug de sesión</h1>

      <h2>Auth user</h2>
      <pre>{JSON.stringify({ id: user?.id, email: user?.email }, null, 2)}</pre>

      <h2>Raw profile (desde DB)</h2>
      <pre>{JSON.stringify(rawProfile, null, 2)}</pre>

      <h2>Role lookup</h2>
      <pre>{JSON.stringify(roleData, null, 2)}</pre>

      <h2>getProfile() result</h2>
      <pre>{JSON.stringify(profile, null, 2)}</pre>
    </div>
  )
}
