-- ============================================================
-- NEXT ENGLISH INSTITUTE — Schema + Seeds unificado
-- Ejecutar TODO de una sola vez en Supabase SQL Editor
-- ============================================================

-- ─── 0. Limpiar objetos previos (safe drop) ──────────────────
DROP VIEW  IF EXISTS public.v_student_stats      CASCADE;
DROP VIEW  IF EXISTS public.v_evaluation_stats   CASCADE;

DROP TABLE IF EXISTS public.notifications        CASCADE;
DROP TABLE IF EXISTS public.answers              CASCADE;
DROP TABLE IF EXISTS public.attempts             CASCADE;
DROP TABLE IF EXISTS public.options              CASCADE;
DROP TABLE IF EXISTS public.questions            CASCADE;
DROP TABLE IF EXISTS public.evaluation_courses   CASCADE;
DROP TABLE IF EXISTS public.evaluations          CASCADE;
DROP TABLE IF EXISTS public.enrollments          CASCADE;
DROP TABLE IF EXISTS public.courses              CASCADE;
DROP TABLE IF EXISTS public.cefr_levels          CASCADE;
DROP TABLE IF EXISTS public.profiles             CASCADE;
DROP TABLE IF EXISTS public.roles                CASCADE;
DROP TABLE IF EXISTS public.organizations        CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user()  CASCADE;
DROP FUNCTION IF EXISTS public.auto_grade_attempt(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.my_role()           CASCADE;
DROP FUNCTION IF EXISTS public.my_org()            CASCADE;

DROP TYPE IF EXISTS public.eval_status    CASCADE;
DROP TYPE IF EXISTS public.eval_type      CASCADE;
DROP TYPE IF EXISTS public.question_type  CASCADE;
DROP TYPE IF EXISTS public.attempt_status CASCADE;

-- ─── Extensión ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. ORGANIZATIONS ─────────────────────────────────────────
CREATE TABLE public.organizations (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT        NOT NULL,
  slug          TEXT        UNIQUE NOT NULL,
  logo_url      TEXT,
  primary_color TEXT        NOT NULL DEFAULT '#642f8d',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. ROLES ─────────────────────────────────────────────────
CREATE TABLE public.roles (
  id   SERIAL PRIMARY KEY,
  name TEXT   UNIQUE NOT NULL
);

INSERT INTO public.roles (name) VALUES
  ('director'), ('coordinator'), ('secretary'), ('student');

-- ─── 3. PROFILES ──────────────────────────────────────────────
CREATE TABLE public.profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id),
  role_id         INTEGER     NOT NULL REFERENCES public.roles(id) DEFAULT 4,
  first_name      TEXT        NOT NULL DEFAULT '',
  last_name       TEXT        NOT NULL DEFAULT '',
  email           TEXT        NOT NULL DEFAULT '',
  phone           TEXT,
  avatar_url      TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. CEFR LEVELS ───────────────────────────────────────────
CREATE TABLE public.cefr_levels (
  id         SERIAL  PRIMARY KEY,
  code       TEXT    UNIQUE NOT NULL,
  label      TEXT    NOT NULL,
  sort_order INTEGER NOT NULL
);

INSERT INTO public.cefr_levels (code, label, sort_order) VALUES
  ('A1', 'Beginner',           1),
  ('A2', 'Elementary',         2),
  ('B1', 'Intermediate',       3),
  ('B2', 'Upper Intermediate', 4),
  ('C1', 'Advanced',           5),
  ('C2', 'Proficiency',        6);

-- ─── 5. COURSES ───────────────────────────────────────────────
CREATE TABLE public.courses (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id),
  name            TEXT        NOT NULL,
  description     TEXT,
  cefr_level_id   INTEGER     REFERENCES public.cefr_levels(id),
  teacher_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. ENROLLMENTS ───────────────────────────────────────────
CREATE TABLE public.enrollments (
  id          SERIAL      PRIMARY KEY,
  student_id  UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  course_id   UUID        NOT NULL REFERENCES public.courses(id)   ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, course_id)
);

-- ─── 7. ENUMS ─────────────────────────────────────────────────
CREATE TYPE public.eval_status    AS ENUM ('draft', 'published', 'closed');
CREATE TYPE public.eval_type      AS ENUM ('multiple_choice', 'writing', 'listening', 'mixed');
CREATE TYPE public.question_type  AS ENUM ('multiple_choice', 'true_false', 'fill_blank', 'short_answer', 'essay', 'audio');
CREATE TYPE public.attempt_status AS ENUM ('in_progress', 'submitted', 'graded', 'timed_out');

-- ─── 8. EVALUATIONS ───────────────────────────────────────────
CREATE TABLE public.evaluations (
  id              UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID             NOT NULL REFERENCES public.organizations(id),
  title           TEXT             NOT NULL,
  description     TEXT,
  instructions    TEXT,
  cefr_level_id   INTEGER          REFERENCES public.cefr_levels(id),
  eval_type       public.eval_type NOT NULL DEFAULT 'multiple_choice',
  time_limit_min  INTEGER          DEFAULT 30,
  max_attempts    INTEGER          NOT NULL DEFAULT 1,
  pass_score      NUMERIC(5,2)     NOT NULL DEFAULT 60,
  available_from  TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  status          public.eval_status NOT NULL DEFAULT 'draft',
  created_by      UUID             REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- ─── 9. EVALUATION ↔ COURSE ───────────────────────────────────
CREATE TABLE public.evaluation_courses (
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES public.courses(id)     ON DELETE CASCADE,
  PRIMARY KEY (evaluation_id, course_id)
);

-- ─── 10. QUESTIONS ────────────────────────────────────────────
CREATE TABLE public.questions (
  id            UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluation_id UUID                  NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  sort_order    INTEGER               NOT NULL DEFAULT 1,
  q_type        public.question_type  NOT NULL DEFAULT 'multiple_choice',
  body          TEXT                  NOT NULL,
  image_url     TEXT,
  audio_url     TEXT,
  points        NUMERIC(5,2)          NOT NULL DEFAULT 1,
  explanation   TEXT,
  created_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

-- ─── 11. OPTIONS ──────────────────────────────────────────────
CREATE TABLE public.options (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID    NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  body        TEXT    NOT NULL,
  is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 1
);

-- ─── 12. ATTEMPTS ─────────────────────────────────────────────
CREATE TABLE public.attempts (
  id               UUID                   PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluation_id    UUID                   NOT NULL REFERENCES public.evaluations(id),
  student_id       UUID                   NOT NULL REFERENCES public.profiles(id),
  started_at       TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  submitted_at     TIMESTAMPTZ,
  graded_at        TIMESTAMPTZ,
  graded_by        UUID                   REFERENCES public.profiles(id) ON DELETE SET NULL,
  status           public.attempt_status  NOT NULL DEFAULT 'in_progress',
  score            NUMERIC(5,2),
  passed           BOOLEAN,
  time_taken_sec   INTEGER,
  teacher_feedback TEXT,
  created_at       TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

-- ─── 13. ANSWERS ──────────────────────────────────────────────
CREATE TABLE public.answers (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id    UUID         NOT NULL REFERENCES public.attempts(id)  ON DELETE CASCADE,
  question_id   UUID         NOT NULL REFERENCES public.questions(id),
  option_id     UUID         REFERENCES public.options(id),
  text_answer   TEXT,
  is_correct    BOOLEAN,
  points_earned NUMERIC(5,2) NOT NULL DEFAULT 0,
  grader_note   TEXT,
  answered_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, question_id)
);

-- ─── 14. NOTIFICATIONS ────────────────────────────────────────
CREATE TABLE public.notifications (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  type       TEXT        NOT NULL DEFAULT 'info',
  link       TEXT,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 15. TRIGGER: auto-create profile ─────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_role_id INTEGER;
BEGIN
  -- Obtener organización del metadata o usar la primera disponible
  IF NEW.raw_user_meta_data->>'organization_id' IS NOT NULL THEN
    v_org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
  ELSE
    SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at LIMIT 1;
  END IF;

  -- Obtener role_id del metadata o usar student (4)
  IF NEW.raw_user_meta_data->>'role_id' IS NOT NULL THEN
    v_role_id := (NEW.raw_user_meta_data->>'role_id')::INTEGER;
  ELSE
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'student' LIMIT 1;
  END IF;

  INSERT INTO public.profiles (
    id, organization_id, role_id,
    first_name, last_name, email
  ) VALUES (
    NEW.id,
    v_org_id,
    COALESCE(v_role_id, 4),
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name',  ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 16. HELPERS ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT r.name
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.role_id
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_org()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ─── 17. AUTO-GRADE FUNCTION ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_grade_attempt(p_attempt_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total   NUMERIC := 0;
  v_earned  NUMERIC := 0;
  v_score   NUMERIC := 0;
  v_pass    NUMERIC := 60;
BEGIN
  -- Corregir respuestas objetivas
  UPDATE public.answers ans
  SET
    is_correct    = opt.is_correct,
    points_earned = CASE WHEN opt.is_correct THEN q.points ELSE 0 END
  FROM public.options opt
  JOIN public.questions q ON q.id = ans.question_id
  WHERE ans.attempt_id = p_attempt_id
    AND ans.option_id  = opt.id
    AND q.q_type IN ('multiple_choice', 'true_false');

  -- Total de puntos posibles (solo preguntas objetivas)
  SELECT COALESCE(SUM(q.points), 0) INTO v_total
  FROM public.answers ans
  JOIN public.questions q ON q.id = ans.question_id
  WHERE ans.attempt_id = p_attempt_id
    AND q.q_type IN ('multiple_choice', 'true_false');

  -- Puntos ganados
  SELECT COALESCE(SUM(points_earned), 0) INTO v_earned
  FROM public.answers
  WHERE attempt_id = p_attempt_id;

  -- Score porcentual
  IF v_total > 0 THEN
    v_score := ROUND((v_earned / v_total) * 100, 2);
  ELSE
    v_score := 0;
  END IF;

  -- Nota de aprobación de la evaluación
  SELECT COALESCE(ev.pass_score, 60) INTO v_pass
  FROM public.attempts a
  JOIN public.evaluations ev ON ev.id = a.evaluation_id
  WHERE a.id = p_attempt_id;

  -- Actualizar intento
  UPDATE public.attempts
  SET
    score          = v_score,
    passed         = (v_score >= v_pass),
    submitted_at   = COALESCE(submitted_at, NOW()),
    status         = 'submitted',
    time_taken_sec = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
  WHERE id = p_attempt_id;

  RETURN v_score;
END;
$$;

-- ─── 18. VISTAS ───────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_student_stats AS
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
         p.is_active, cl.code, cl.label, c.name, c.id;

CREATE OR REPLACE VIEW public.v_evaluation_stats AS
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
  ROUND(AVG(a.score) FILTER (WHERE a.status IN ('submitted','graded')), 1) AS avg_score,
  MIN(a.score)  FILTER (WHERE a.status IN ('submitted','graded'))        AS min_score,
  MAX(a.score)  FILTER (WHERE a.status IN ('submitted','graded'))        AS max_score,
  COUNT(a.id)   FILTER (WHERE a.status = 'in_progress')                  AS in_progress_count
FROM public.evaluations ev
LEFT JOIN public.cefr_levels cl ON cl.id = ev.cefr_level_id
LEFT JOIN public.profiles p     ON p.id  = ev.created_by
LEFT JOIN public.attempts a     ON a.evaluation_id = ev.id
GROUP BY ev.id, ev.organization_id, ev.title, ev.eval_type, ev.status,
         ev.time_limit_min, ev.available_until, ev.pass_score,
         cl.code, p.first_name, p.last_name;

-- ─── 19. ROW LEVEL SECURITY ───────────────────────────────────
ALTER TABLE public.organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;

-- Organizations: visible para todos los autenticados
CREATE POLICY "orgs_read"
  ON public.organizations FOR SELECT
  USING (auth.role() = 'authenticated');

-- Profiles: solo dentro de la misma organización
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  USING (organization_id = public.my_org());

CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.my_role() IN ('director', 'secretary'));

CREATE POLICY "profiles_insert"
  ON public.profiles FOR INSERT
  WITH CHECK (public.my_role() IN ('director', 'secretary'));

-- Courses
CREATE POLICY "courses_select"
  ON public.courses FOR SELECT
  USING (organization_id = public.my_org());

CREATE POLICY "courses_write"
  ON public.courses FOR ALL
  USING (organization_id = public.my_org() AND public.my_role() IN ('director', 'coordinator'));

-- Enrollments
CREATE POLICY "enrollments_select"
  ON public.enrollments FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.my_role() IN ('director', 'coordinator', 'secretary')
  );

CREATE POLICY "enrollments_write"
  ON public.enrollments FOR ALL
  USING (public.my_role() IN ('director', 'coordinator', 'secretary'));

-- Evaluations
CREATE POLICY "evaluations_select"
  ON public.evaluations FOR SELECT
  USING (
    organization_id = public.my_org()
    AND (
      status = 'published'
      OR public.my_role() IN ('director', 'coordinator')
    )
  );

CREATE POLICY "evaluations_write"
  ON public.evaluations FOR ALL
  USING (
    organization_id = public.my_org()
    AND public.my_role() IN ('director', 'coordinator')
  );

-- Evaluation courses
CREATE POLICY "eval_courses_select"
  ON public.evaluation_courses FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "eval_courses_write"
  ON public.evaluation_courses FOR ALL
  USING (public.my_role() IN ('director', 'coordinator'));

-- Questions
CREATE POLICY "questions_select"
  ON public.questions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "questions_write"
  ON public.questions FOR ALL
  USING (public.my_role() IN ('director', 'coordinator'));

-- Options
CREATE POLICY "options_select"
  ON public.options FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "options_write"
  ON public.options FOR ALL
  USING (public.my_role() IN ('director', 'coordinator'));

-- Attempts
CREATE POLICY "attempts_select"
  ON public.attempts FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.my_role() IN ('director', 'coordinator')
  );

CREATE POLICY "attempts_insert"
  ON public.attempts FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "attempts_update"
  ON public.attempts FOR UPDATE
  USING (
    student_id = auth.uid()
    OR public.my_role() IN ('director', 'coordinator')
  );

-- Answers
CREATE POLICY "answers_select"
  ON public.answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.id = attempt_id
        AND (a.student_id = auth.uid() OR public.my_role() IN ('director', 'coordinator'))
    )
  );

CREATE POLICY "answers_insert"
  ON public.answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.id = attempt_id AND a.student_id = auth.uid()
    )
  );

CREATE POLICY "answers_update"
  ON public.answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.id = attempt_id
        AND (a.student_id = auth.uid() OR public.my_role() IN ('director', 'coordinator'))
    )
  );

-- Notifications
CREATE POLICY "notif_select"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notif_update"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ─── 20. DATOS DE EJEMPLO (seed) ──────────────────────────────

-- Organización base
INSERT INTO public.organizations (id, name, slug, primary_color)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Next English Institute',
  'next-ezeiza',
  '#642f8d'
);

-- Cursos de ejemplo
INSERT INTO public.courses (id, organization_id, name, description, cefr_level_id, is_active)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Beginner A',         'Turno mañana — A1',  1, TRUE),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Elementary B',       'Turno tarde — A2',   2, TRUE),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Intermediate C',     'Turno noche — B1',   3, TRUE),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Upper Intermediate', 'Turno tarde — B2',   4, TRUE),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Advanced C1',        'Turno noche — C1',   5, TRUE);

-- Evaluación de ejemplo (publicada)
INSERT INTO public.evaluations (
  id, organization_id, title, description, instructions,
  cefr_level_id, eval_type, time_limit_min, pass_score, status
) VALUES (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Grammar Test — Present Simple B1',
  'Evaluación de gramática nivel B1 — Unidad 1',
  'Leé cada pregunta con atención. Tenés 30 minutos para completar el examen. No podés volver atrás una vez enviado.',
  3, 'multiple_choice', 30, 60, 'published'
);

-- Preguntas
INSERT INTO public.questions (id, evaluation_id, sort_order, q_type, body, points) VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'multiple_choice', 'She ___ to school every day.',              1),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 2, 'multiple_choice', 'They ___ playing football right now.',       1),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 3, 'multiple_choice', 'I ___ never been to London.',               1),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 4, 'true_false',       'The Present Simple is used for habits.',    1),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 5, 'short_answer',     'Write a sentence using Present Continuous.', 2);

-- Opciones
INSERT INTO public.options (question_id, body, is_correct, sort_order) VALUES
  -- Q1
  ('30000000-0000-0000-0000-000000000001', 'go',    FALSE, 1),
  ('30000000-0000-0000-0000-000000000001', 'goes',  TRUE,  2),
  ('30000000-0000-0000-0000-000000000001', 'going', FALSE, 3),
  ('30000000-0000-0000-0000-000000000001', 'gone',  FALSE, 4),
  -- Q2
  ('30000000-0000-0000-0000-000000000002', 'are',  TRUE,  1),
  ('30000000-0000-0000-0000-000000000002', 'is',   FALSE, 2),
  ('30000000-0000-0000-0000-000000000002', 'were', FALSE, 3),
  ('30000000-0000-0000-0000-000000000002', 'be',   FALSE, 4),
  -- Q3
  ('30000000-0000-0000-0000-000000000003', 'have', TRUE,  1),
  ('30000000-0000-0000-0000-000000000003', 'has',  FALSE, 2),
  ('30000000-0000-0000-0000-000000000003', 'had',  FALSE, 3),
  ('30000000-0000-0000-0000-000000000003', 'am',   FALSE, 4),
  -- Q4 true/false
  ('30000000-0000-0000-0000-000000000004', 'True',  TRUE,  1),
  ('30000000-0000-0000-0000-000000000004', 'False', FALSE, 2);

-- Asignar evaluación al curso Intermediate C
INSERT INTO public.evaluation_courses (evaluation_id, course_id)
VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003');

-- ─── FIN ──────────────────────────────────────────────────────
-- ✅ Schema listo. Próximo paso:
--    1. Ir a Authentication → Users → "Add user" en Supabase Dashboard
--    2. Crear los usuarios con sus emails y contraseñas
--    3. Ejecutar el bloque de abajo con los UUIDs reales:

/*
── PASO POST-USUARIOS: copiar y ejecutar con UUIDs reales ──────

UPDATE public.profiles
SET role_id    = (SELECT id FROM public.roles WHERE name = 'director'),
    first_name = 'Admin',
    last_name  = 'Director'
WHERE email = 'director@nextenglish.com';

UPDATE public.profiles
SET role_id    = (SELECT id FROM public.roles WHERE name = 'coordinator'),
    first_name = 'María',
    last_name  = 'González'
WHERE email = 'coordinadora@nextenglish.com';

UPDATE public.profiles
SET role_id    = (SELECT id FROM public.roles WHERE name = 'secretary'),
    first_name = 'Laura',
    last_name  = 'Martínez'
WHERE email = 'secretaria@nextenglish.com';

UPDATE public.profiles
SET role_id    = (SELECT id FROM public.roles WHERE name = 'student'),
    first_name = 'Juan',
    last_name  = 'Alumno'
WHERE email = 'alumno@nextenglish.com';

── Inscribir al alumno en el curso Intermediate C ──────────────
INSERT INTO public.enrollments (student_id, course_id)
SELECT p.id, '10000000-0000-0000-0000-000000000003'
FROM public.profiles p
WHERE p.email = 'alumno@nextenglish.com';

*/
