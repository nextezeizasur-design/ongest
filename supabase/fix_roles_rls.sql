-- La tabla roles no tiene policy de SELECT para usuarios autenticados
-- Eso hace que la query desde el servidor retorne null
-- Fix: permitir lectura de roles a cualquier usuario autenticado

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Eliminar policies previas si existen
DROP POLICY IF EXISTS "roles_read" ON public.roles;

-- Crear policy de lectura pública (roles es un catálogo, no tiene datos sensibles)
CREATE POLICY "roles_read"
  ON public.roles
  FOR SELECT
  USING (true);
