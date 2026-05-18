# Next English Institute — Plataforma de Evaluaciones

Sistema completo de evaluaciones online para institutos de inglés.
**Stack:** Next.js 15 · Supabase · Tailwind CSS · TypeScript

---

## 🚀 Inicio rápido

### 1. Clonar y dependencias

```bash
git clone https://github.com/TU-USUARIO/next-english-institute.git
cd next-english-institute
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

Completar en `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Base de datos (Supabase)

1. Crear proyecto en [supabase.com](https://supabase.com)
2. En **SQL Editor**, ejecutar en orden:
   - `supabase/migrations/001_schema.sql`
   - `supabase/seeds/001_seed.sql`
3. En **Authentication → Settings**, activar Email provider

### 4. Crear usuarios de prueba

En Supabase Dashboard → **Authentication → Users → Invite user**:

| Email | Contraseña | Rol |
|-------|-----------|-----|
| `director@nextenglish.com` | `Test1234!` | director |
| `coordinadora@nextenglish.com` | `Test1234!` | coordinator |
| `secretaria@nextenglish.com` | `Test1234!` | secretary |
| `alumno@nextenglish.com` | `Test1234!` | student |

Luego, en SQL Editor, asignar roles:
```sql
-- Reemplazar con los UUIDs reales de los usuarios creados
UPDATE public.profiles
SET role_id = (SELECT id FROM roles WHERE name = 'director'),
    first_name = 'Admin', last_name = 'Director'
WHERE email = 'director@nextenglish.com';
```

### 5. Correr localmente

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

---

## 📦 Deploy en Vercel

### Opción A: Automático (recomendado)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Importar el repo en Vercel
2. Agregar las variables de entorno del `.env.example`
3. Deploy

### Opción B: CLI

```bash
npm i -g vercel
vercel --prod
```

---

## 🏗️ Estructura del proyecto

```
next-english-institute/
├── app/
│   ├── login/              # Página de login
│   ├── director/           # Dashboard director + alumnos + evaluaciones + reportes
│   ├── coordinator/        # Dashboard + CRUD evaluaciones
│   ├── secretary/          # Dashboard + gestión alumnos/cursos
│   ├── exam/               # Lista y toma de exámenes (alumno)
│   └── results/            # Notas del alumno
├── components/
│   ├── layout/             # Sidebar, TopBar
│   └── ui/                 # StatCard, EmptyState
├── lib/
│   ├── supabase/           # Clients server/browser
│   ├── auth.ts             # Helpers de autenticación y roles
│   └── utils.ts            # Formatters y helpers
├── services/               # Data layer (evaluations, students, attempts)
├── types/                  # TypeScript types
└── supabase/
    ├── migrations/         # Schema SQL
    └── seeds/              # Datos de ejemplo
```

---

## 👥 Roles y accesos

| Rol | Ruta inicial | Permisos |
|-----|-------------|----------|
| Director | `/director` | Acceso total, métricas globales |
| Coordinadora | `/coordinator` | Crear/gestionar evaluaciones, ver resultados |
| Secretaria | `/secretary` | Alta de alumnos, asignación a cursos |
| Alumno | `/exam` | Rendir exámenes, ver sus notas |

---

## 🔒 Seguridad

- **Row Level Security (RLS)** activo en todas las tablas
- Cada tabla tiene políticas `SELECT/INSERT/UPDATE/DELETE` por rol
- **Multi-tenant** por `organization_id` — los datos de un instituto son invisibles para otros
- Sesiones manejadas con Supabase Auth (JWT)
- Middleware Next.js protege todas las rutas por rol

---

## 🌱 Multi-tenant

El sistema está preparado para múltiples institutos:
- Cada registro tiene `organization_id`
- Las RLS policies filtran automáticamente por organización
- Para agregar un segundo instituto: insertar en `organizations` y crear usuarios con el nuevo `organization_id`

---

## 📝 Variables de entorno

| Variable | Descripción | Requerida |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon pública | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada (solo server) | Para admin ops |
| `NEXT_PUBLIC_APP_URL` | URL de la app | Para emails |

---

## 🧪 Comandos útiles

```bash
npm run dev          # Desarrollo local
npm run build        # Build producción
npm run typecheck    # Verificar tipos TypeScript
npm run lint         # ESLint
```

---

## 🗺️ Roadmap sugerido

- [ ] Notificaciones por email al asignar evaluación
- [ ] Corrección manual de writing con rubric
- [ ] Upload de audio para listening
- [ ] Exportar resultados a CSV/PDF
- [ ] App mobile (React Native / Expo)
- [ ] Estadísticas avanzadas con gráficos

---

**Instituto Next English · Plataforma desarrollada con Next.js + Supabase**
