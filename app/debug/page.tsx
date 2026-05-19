import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

// Página de debug — solo accesible para director en entorno de desarrollo
// En producción redirige al home para evitar exposición de datos internos
export default async function DebugPage() {
  const profile = await getProfile()

  // Solo el director puede acceder, y solo en desarrollo
  if (!profile || profile.role !== 'director' || process.env.NODE_ENV === 'production') {
    redirect('/')
  }

  const supabase = await createClient()
  const sb = supabase as any

  const { data: { user } } = await supabase.auth.getUser()

  let rawProfile = null
  let roleData   = null

  if (user) {
    const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single()
    rawProfile = p
    if (p?.role_id) {
      const { data: r } = await sb.from('roles').select('name').eq('id', p.role_id).single()
      roleData = r
    }
  }

  return (
    <div style={{ padding: 32, fontFamily: 'monospace', fontSize: 13 }}>
      <h1 style={{ marginBottom: 4 }}>🔍 Debug de sesión</h1>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 12 }}>
        Solo visible para director · Solo en desarrollo
      </p>

      <h2>Auth user</h2>
      <pre>{JSON.stringify({ id: user?.id, email: user?.email }, null, 2)}</pre>

      <h2>Raw profile</h2>
      <pre>{JSON.stringify(rawProfile, null, 2)}</pre>

      <h2>Role lookup</h2>
      <pre>{JSON.stringify(roleData, null, 2)}</pre>

      <h2>getProfile() result</h2>
      <pre>{JSON.stringify(profile, null, 2)}</pre>
    </div>
  )
}
