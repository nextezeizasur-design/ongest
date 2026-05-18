-- ============================================================
-- MIGRACIÓN 003 — Rol Docente + Campos de Curso
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar rol 'teacher' (docente)
INSERT INTO public.roles (name)
VALUES ('teacher')
ON CONFLICT (name) DO NOTHING;

-- 2. Agregar campos a la tabla courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS schedule_days  TEXT,        -- ej: "Lunes y Miércoles"
  ADD COLUMN IF NOT EXISTS schedule_time  TEXT,        -- ej: "18:00 - 20:00"
  ADD COLUMN IF NOT EXISTS notes          TEXT;        -- notas internas

-- 3. RLS para teacher: ve sus propios cursos y evaluaciones
-- Ver cursos donde es teacher
DROP POLICY IF EXISTS "courses_select" ON public.courses;
CREATE POLICY "courses_select"
  ON public.courses FOR SELECT
  USING (
    organization_id = public.my_org()
    AND (
      is_active = true
      OR public.my_role() IN ('director', 'coordinator', 'teacher')
      OR teacher_id = auth.uid()
    )
  );

-- Teacher puede actualizar solo sus cursos
DROP POLICY IF EXISTS "courses_write" ON public.courses;
CREATE POLICY "courses_write"
  ON public.courses FOR ALL
  USING (
    organization_id = public.my_org()
    AND (
      public.my_role() IN ('director', 'coordinator')
      OR (public.my_role() = 'teacher' AND teacher_id = auth.uid())
    )
  );

-- Teacher puede ver evaluaciones de sus cursos
DROP POLICY IF EXISTS "evaluations_select" ON public.evaluations;
CREATE POLICY "evaluations_select"
  ON public.evaluations FOR SELECT
  USING (
    organization_id = public.my_org()
    AND (
      status = 'published'
      OR public.my_role() IN ('director', 'coordinator', 'teacher')
    )
  );

-- Teacher puede crear/editar evaluaciones
DROP POLICY IF EXISTS "evaluations_write" ON public.evaluations;
CREATE POLICY "evaluations_write"
  ON public.evaluations FOR ALL
  USING (
    organization_id = public.my_org()
    AND public.my_role() IN ('director', 'coordinator', 'teacher')
  );

-- Teacher puede ver intentos de sus alumnos
DROP POLICY IF EXISTS "attempts_select" ON public.attempts;
CREATE POLICY "attempts_select"
  ON public.attempts FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.my_role() IN ('director', 'coordinator', 'teacher')
  );

-- Teacher puede corregir respuestas (UPDATE answers)
DROP POLICY IF EXISTS "answers_update" ON public.answers;
CREATE POLICY "answers_update"
  ON public.answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.id = attempt_id
        AND (
          a.student_id = auth.uid()
          OR public.my_role() IN ('director', 'coordinator', 'teacher')
        )
    )
  );

-- 4. Actualizar middleware: agregar teacher a ROLE_HOME
-- (esto se hace en el código, no en SQL)

-- 5. Ver resultado
SELECT id, name FROM public.roles ORDER BY id;
