-- Agregar campo birth_date a profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Actualizar la vista v_student_stats para incluir birth_date y edad calculada
DROP VIEW IF EXISTS public.v_student_stats;

CREATE OR REPLACE VIEW public.v_student_stats AS
SELECT
  p.id,
  p.organization_id,
  p.first_name,
  p.last_name,
  p.email,
  p.phone,
  p.birth_date,
  CASE
    WHEN p.birth_date IS NOT NULL THEN
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.birth_date))::INTEGER
    ELSE NULL
  END AS age,
  p.is_active,
  cl.code  AS cefr_code,
  cl.label AS cefr_label,
  c.name   AS course_name,
  c.id     AS course_id,
  COUNT(a.id)  FILTER (WHERE a.status IN ('submitted','graded'))       AS total_attempts,
  ROUND(AVG(a.score) FILTER (WHERE a.status IN ('submitted','graded')), 1) AS avg_score,
  COUNT(a.id)  FILTER (WHERE a.passed = TRUE)                          AS passed_count,
  COUNT(a.id)  FILTER (WHERE a.passed = FALSE AND a.status IN ('submitted','graded')) AS failed_count
FROM public.profiles p
JOIN public.roles r      ON r.id  = p.role_id AND r.name = 'student'
LEFT JOIN public.enrollments e   ON e.student_id = p.id
LEFT JOIN public.courses c       ON c.id = e.course_id
LEFT JOIN public.cefr_levels cl  ON cl.id = c.cefr_level_id
LEFT JOIN public.attempts a      ON a.student_id = p.id
GROUP BY p.id, p.organization_id, p.first_name, p.last_name, p.email,
         p.phone, p.birth_date, p.is_active, cl.code, cl.label, c.name, c.id;
