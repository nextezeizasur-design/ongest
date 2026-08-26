-- ============================================================
-- 010_fix_evaluation_stats_created_at.sql
-- ============================================================
-- Problema: la migración 009 recreó v_evaluation_stats (DROP VIEW +
-- CREATE VIEW) sin incluir la columna created_at. El código de
-- services/evaluations.ts (getEvaluationStats) hace
-- .order('created_at', ...) sobre esta vista, lo que rompe TODA
-- consulta al listado de evaluaciones con el error Postgres 42703
-- (column "created_at" does not exist) desde que se corrió la 009.
--
-- Como el llamador no revisaba `error`, el fallo quedó invisible:
-- la app mostraba "Sin evaluaciones" en vez de un error, aunque la
-- tabla `evaluations` tuviera registros publicados correctamente.
--
-- Este script:
--   1. Recrea la vista agregando ev.created_at.
--   2. Otorga GRANT explícito a anon/authenticated/service_role
--      (DROP VIEW borra los grants anteriores; no depender de que
--      los privilegios por defecto se reapliquen solos).
--   3. Notifica a PostgREST que recargue su caché de esquema.
--
-- Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================

DROP VIEW IF EXISTS public.v_evaluation_stats;

CREATE VIEW public.v_evaluation_stats AS
SELECT
  ev.id,
  ev.organization_id,
  ev.title,
  ev.eval_type,
  ev.status,
  ev.time_limit_min,
  ev.available_until,
  ev.pass_score,
  ev.created_at,
  cl.code                                                                AS cefr_code,
  p.first_name || ' ' || p.last_name                                    AS created_by_name,
  COUNT(a.id)   FILTER (WHERE a.status IN ('submitted','graded'))        AS completed_count,
  COUNT(DISTINCT a.student_id)                                           AS unique_students,
  ROUND(AVG(a.score) FILTER (WHERE a.status = 'graded'), 1)              AS avg_score,
  MIN(a.score)  FILTER (WHERE a.status = 'graded')                       AS min_score,
  MAX(a.score)  FILTER (WHERE a.status = 'graded')                       AS max_score,
  COUNT(a.id)   FILTER (WHERE a.status = 'in_progress')                  AS in_progress_count
FROM public.evaluations ev
LEFT JOIN public.cefr_levels cl ON cl.id = ev.cefr_level_id
LEFT JOIN public.profiles p     ON p.id  = ev.created_by
LEFT JOIN public.attempts a     ON a.evaluation_id = ev.id
GROUP BY ev.id, ev.organization_id, ev.title, ev.eval_type, ev.status,
         ev.time_limit_min, ev.available_until, ev.pass_score, ev.created_at,
         cl.code, p.first_name, p.last_name;

GRANT SELECT ON public.v_evaluation_stats TO anon, authenticated, service_role;

-- Avisarle a PostgREST que recargue su caché de esquema.
NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN: debería devolver 15 filas (o las que haya
-- publicadas actualmente), ordenadas por fecha de creación.
-- ────────────────────────────────────────────────────────────
SELECT id, title, status, created_at
FROM public.v_evaluation_stats
WHERE organization_id = '8af7273b-4c38-47c6-8d57-a524377ed941'
ORDER BY created_at DESC;
