// app/api/org/route.ts
// API pública (sin auth) — devuelve nombre y color de la org por slug
// Usada por el login para mostrar el nombre del instituto dinámicamente

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 })
  }

  try {
    const supabase = await createAdminClient()
    const { data, error } = await (supabase as any)
      .from('organizations')
      .select('name, primary_color, logo_url, support_email')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'org not found' }, { status: 404 })
    }

    return NextResponse.json({
      name:          data.name,
      primaryColor:  data.primary_color ?? '#642f8d',
      logoUrl:       data.logo_url ?? null,
      supportEmail:  data.support_email ?? null,
    })

  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
