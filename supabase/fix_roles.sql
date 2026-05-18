-- ============================================================
-- DIAGNÓSTICO Y FIX DE ROLES
-- Ejecutar en Supabase SQL Editor para verificar el estado
-- ============================================================

-- 1. Ver todos los perfiles con sus roles actuales
SELECT
  p.email,
  p.first_name,
  p.last_name,
  p.role_id,
  r.name AS role_name,
  p.is_active
FROM public.profiles p
LEFT JOIN public.roles r ON r.id = p.role_id
ORDER BY p.created_at;

-- ─── Si el Director aparece con role_name = 'student', ejecutar: ──────────

-- Asignar rol director (reemplazar el email con el tuyo real)
UPDATE public.profiles
SET role_id = (SELECT id FROM public.roles WHERE name = 'director')
WHERE email = 'director@nextenglish.com';

-- Verificar que quedó bien
SELECT p.email, r.name AS role FROM public.profiles p
JOIN public.roles r ON r.id = p.role_id
WHERE p.email = 'director@nextenglish.com';

-- ─── Si querés asignar otros roles: ──────────────────────────────────────

/*
UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE name = 'coordinator')
WHERE email = 'coordinadora@nextenglish.com';

UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE name = 'secretary')
WHERE email = 'secretaria@nextenglish.com';

UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE name = 'student')
WHERE email = 'alumno@nextenglish.com';
*/

-- ─── Ver los IDs de roles disponibles ──────────────────────────────────────
SELECT id, name FROM public.roles ORDER BY id;
