-- ============================================================
-- MIGRACIÓN 005 — Permitir a Docente guardar preguntas, opciones
-- y asignación de cursos en sus evaluaciones
-- Ejecutar en Supabase SQL Editor
--
-- Contexto: la migración 003_teacher_role.sql agregó 'teacher' a
-- evaluations_write, pero no actualizó questions_write, options_write
-- ni eval_courses_write. Resultado: el docente podía crear la fila
-- de "evaluations" pero cada INSERT en "questions" era rechazado
-- por RLS -> "Error al guardar las preguntas" (100% de fallas).
-- La asignación de cursos (eval_courses_write) fallaba igual,
-- pero en silencio porque el código no revisa ese error.
-- ============================================================

-- Questions: agregar teacher
DROP POLICY IF EXISTS "questions_write" ON public.questions;
CREATE POLICY "questions_write"
  ON public.questions FOR ALL
  USING (public.my_role() IN ('director', 'coordinator', 'teacher'));

-- Options: agregar teacher
DROP POLICY IF EXISTS "options_write" ON public.options;
CREATE POLICY "options_write"
  ON public.options FOR ALL
  USING (public.my_role() IN ('director', 'coordinator', 'teacher'));

-- Evaluation courses (asignación a cursos): agregar teacher
DROP POLICY IF EXISTS "eval_courses_write" ON public.evaluation_courses;
CREATE POLICY "eval_courses_write"
  ON public.evaluation_courses FOR ALL
  USING (public.my_role() IN ('director', 'coordinator', 'teacher'));

-- Verificación: listar las policies actualizadas
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('questions', 'options', 'evaluation_courses')
  AND policyname IN ('questions_write', 'options_write', 'eval_courses_write')
ORDER BY tablename;
