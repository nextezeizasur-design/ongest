-- ============================================================
-- 009_unify_score_averages.sql
-- ============================================================
-- Problema: Dashboard, Dashboard Ejecutivo y Reportes mostraban
-- promedios distintos entre sí porque cada uno decidía por su
-- cuenta qué intentos entraban al cálculo:
--   - Dashboard (/director):          solo status = 'graded'
--   - Dashboard Ejecutivo (/monthly): status IN ('submitted','graded')
--   - Reportes (v_student_stats /
--     v_evaluation_stats):            status IN ('submitted','graded')
--
-- Regla unificada a partir de ahora, en TODA la plataforma:
--   - "Cuántos alumnos ya rindieron" (conteos de actividad,
--     ej. total_attempts / completed_count): sigue contando
--     'submitted' + 'graded' — refleja actividad real, incluidos
--     los que están pendientes de corrección.
--   - "Promedio / aprobación" (avg_score, min_score, max_score,
--     passed_count, failed_count): SOLO 'graded' — un intento
--     'submitted' con preguntas manuales pendientes puede tener
--     score preliminar o null y no debe contaminar el promedio
--     hasta que un docente lo cierre.
--
-- Este script solo toca las vistas (Reportes). El cambio en
-- Dashboard Ejecutivo va en el mismo commit, del lado del código
-- (app/director/monthly/page.tsx).
--
-- Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================

DROP VIEW IF EXISTS public.v_student_stats;

CREATE VIEW public.v_student_stats AS
SELECT
  p.id,
  p.organization_id,
  p.first_name,
  p.last_name,
  p.email,
  p.is_active,
  cl.code                                                              AS cefr_code,
  cl.label                                                             AS cefr_label,
  c.name                                                               AS course_name,
  c.id                                                                 AS course_id,
  COUNT(a.id)  FILTER (WHERE a.status IN ('submitted','graded'))       AS total_attempts,
  ROUND(AVG(a.score) FILTER (WHERE a.status = 'graded'), 1)            AS avg_score,
  COUNT(a.id)  FILTER (WHERE a.status = 'graded' AND a.passed = TRUE)  AS passed_count,
  COUNT(a.id)  FILTER (WHERE a.status = 'graded' AND a.passed = FALSE) AS failed_count
FROM public.profiles p
JOIN public.roles r      ON r.id  = p.role_id AND r.name = 'student'
LEFT JOIN public.enrollments e   ON e.student_id = p.id
LEFT JOIN public.courses c       ON c.id = e.course_id
LEFT JOIN public.cefr_levels cl  ON cl.id = c.cefr_level_id
LEFT JOIN public.attempts a      ON a.student_id = p.id
GROUP BY p.id, p.organization_id, p.first_name, p.last_name, p.email,
         p.is_active, cl.code, cl.label, c.name, c.id;


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
         ev.time_limit_min, ev.available_until, ev.pass_score,
         cl.code, p.first_name, p.last_name;


-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN: promedio institucional recalculado. Comparalo
-- con el número que te muestre el Dashboard Ejecutivo una vez
-- que subas también el cambio de código.
-- ────────────────────────────────────────────────────────────
SELECT ROUND(AVG(avg_score), 1) AS promedio_institucional_reportes
FROM public.v_student_stats
WHERE avg_score IS NOT NULL;
