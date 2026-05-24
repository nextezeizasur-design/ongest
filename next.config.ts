import type { NextConfig } from 'next'

// Dominio de Supabase — usado en connect-src, img-src y media-src
// Si cambiás de proyecto Supabase, actualizá esta variable
const SUPABASE_HOST = '*.supabase.co'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{
      protocol: 'https',
      hostname: SUPABASE_HOST,
      pathname: '/storage/v1/object/public/**',
    }],
  },

  async headers() {
    return [{
      source: '/(.*)',
      headers: [

        // ── Existentes ────────────────────────────────────────────────────
        // Impide que la app sea embebida en iframes de otros sitios (clickjacking)
        { key: 'X-Frame-Options', value: 'DENY' },

        // Impide que el browser interprete archivos con un MIME type incorrecto
        { key: 'X-Content-Type-Options', value: 'nosniff' },

        // Controla qué información de referencia se envía en los requests
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

        // ── Nuevos ────────────────────────────────────────────────────────

        // Fuerza HTTPS por 2 años. El browser rechazará conexiones HTTP.
        // Solo activar si el dominio tiene HTTPS permanente (Vercel lo tiene).
        {
          key:   'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },

        // Restringe qué APIs del browser puede usar la app.
        // camera=() → bloqueada globalmente (solo se activa con getUserMedia en el código)
        // microphone=(self) → solo el propio origen (necesario para speaking/grabaciones)
        // geolocation=() → bloqueada (la app no la usa)
        // payment=() → bloqueada
        {
          key:   'Permissions-Policy',
          value: 'camera=(), microphone=(self), geolocation=(), payment=()',
        },

        // Content Security Policy — define qué recursos puede cargar la app.
        // Construido conservadoramente para no romper Next.js ni Supabase:
        //
        // default-src 'self'          → por defecto solo recursos del propio dominio
        // script-src  'self' + inline → Next.js requiere inline scripts para hydration
        // style-src   'self' + inline → Tailwind y estilos de Next.js son inline
        // connect-src 'self' + supabase → fetch() y WebSockets hacia Supabase
        // img-src     'self' + data: + supabase → imágenes locales, base64 y storage
        // media-src   'self' + supabase → videos/audios del storage (grabaciones, speaking)
        // font-src    'self'            → sin fuentes externas (no hay Google Fonts)
        // frame-ancestors 'none'        → refuerza X-Frame-Options
        {
          key:   'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST}`,
            `img-src 'self' data: blob: https://${SUPABASE_HOST}`,
            `media-src 'self' blob: https://${SUPABASE_HOST}`,
            "font-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        },

      ],
    }]
  },
}

export default nextConfig
