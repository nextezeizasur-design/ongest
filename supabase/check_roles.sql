-- PASO 1: Ver el estado actual de todos los perfiles
SELECT
  p.id,
  p.email,
  p.first_name,
  p.last_name,
  p.role_id,
  r.name AS role_name
FROM public.profiles p
LEFT JOIN public.roles r ON r.id = p.role_id
ORDER BY p.created_at;

-- PASO 2: Ver los IDs de roles disponibles
SELECT id, name FROM public.roles ORDER BY id;
