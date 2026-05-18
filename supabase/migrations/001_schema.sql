-- ============================================================
-- NEXT ENGLISH INSTITUTE — Schema completo
-- Multi-tenant | RLS | Producción
-- ============================================================

-- ─── Extensiones ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. ORGANIZATIONS (multi-tenant) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  logo_url    TEXT,
  primary_color TEXT DEFAULT '#642f8d',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. ROLES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
  id   SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL  -- director | coordinator | secretary | student
);

INSERT INTO public.roles (name) VALUES
  ('director'), ('coordinator'), ('secretary'), ('student')
ON CONFLICT DO NOTHING;

-- ─── 3. PROFILES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  role_id         INTEGER NOT NULL REFERENCES public.roles(id) DEFAULT 4,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_org UUID;
BEGIN
  SELECT id INTO default_org FROM public.organizations LIMIT 1;
  INSERT INTO public.profiles (id, organization_id, role_id, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'organization_id')::UUID, default_org),
    COALESCE((NEW.raw_user_meta_data->>'role_id')::INTEGER, 4),
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 4. CEFR LEVELS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cefr_levels (
  id         SERIAL PRIMARY KEY,
  code       TEXT UNIQUE NOT NULL,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

INSERT INTO public.cefr_levels (code, label, sort_order) VALUES
  ('A1','Beginner',1),('A2','Elementary',2),
  ('B1','Intermediate',3),('B2','Upper Intermediate',4),
  ('C1','Advanced',5),('C2','Proficiency',6)
ON CONFLICT DO NOTHING;

-- ─── 5. COURSES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name            TEXT NOT NULL,
  description     TEXT,
  cefr_level_id   INTEGER REFERENCES public.cefr_levels(id),
  teacher_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 6. ENROLLMENTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enrollments (
  id          SERIAL PRIMARY KEY,
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES public.courses(id)  ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, course_id)
);

-- ─── 7. EVALUATIONS ───────────────────────────────────────────
CREATE TYPE eval_status AS ENUM ('draft','published','closed');
CREATE TYPE eval_type   AS ENUM ('multiple_choice','writing','listening','mixed');

CREATE TABLE IF NOT EXISTS public.evaluations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  title           TEXT NOT NULL,
  description     TEXT,
  instructions    TEXT,
  cefr_level_id   INTEGER REFERENCES public.cefr_levels(id),
  eval_type       eval_type NOT NULL DEFAULT 'multiple_choice',
  time_limit_min  INTEGER DEFAULT 30,
  max_attempts    INTEGER DEFAULT 1,
  pass_score      NUMERIC(5,2) DEFAULT 60,
  available_from  TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  status          eval_status NOT NULL DEFAULT 'draft',
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 8. EVALUATION ↔ COURSE ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_courses (
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES public.courses(id)     ON DELETE CASCADE,
  PRIMARY KEY (evaluation_id, course_id)
);

-- ─── 9. QUESTIONS ─────────────────────────────────────────────
CREATE TYPE question_type AS ENUM ('multiple_choice','true_false','fill_blank','short_answer','essay','audio');

CREATE TABLE IF NOT EXISTS public.questions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 1,
  q_type        question_type NOT NULL DEFAULT 'multiple_choice',
  body          TEXT NOT NULL,
  image_url     TEXT,
  audio_url     TEXT,
  points        NUMERIC(5,2) NOT NULL DEFAULT 1,
  explanation   TEXT,          -- feedback visible al alumno tras corregir
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 10. OPTIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.options (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 1
);

-- ─── 11. ATTEMPTS ─────────────────────────────────────────────
CREATE TYPE attempt_status AS ENUM ('in_progress','submitted','graded','timed_out');

CREATE TABLE IF NOT EXISTS public.attempts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluation_id   UUID NOT NULL REFERENCES public.evaluations(id),
  student_id      UUID NOT NULL REFERENCES public.profiles(id),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  submitted_at    TIMESTAMPTZ,
  graded_at       TIMESTAMPTZ,
  graded_by       UUID REFERENCES public.profiles(id),
  status          attempt_status NOT NULL DEFAULT 'in_progress',
  score           NUMERIC(5,2),       -- 0–100
  passed          BOOLEAN,
  time_taken_sec  INTEGER,
  teacher_feedback TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 12. ANSWERS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.answers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id    UUID NOT NULL REFERENCES public.attempts(id)  ON DELETE CASCADE,
  question_id   UUID NOT NULL REFERENCES public.questions(id),
  option_id     UUID REFERENCES public.options(id),
  text_answer   TEXT,
  is_correct    BOOLEAN,
  points_earned NUMERIC(5,2) DEFAULT 0,
  grader_note   TEXT,
  answered_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (attempt_id, question_id)
);

-- ─── 13. NOTIFICATIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  type       TEXT DEFAULT 'info',
  link       TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 14. VIEWS ────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_student_stats AS
SELECT
  p.id,
  p.organization_id,
  p.first_name,
  p.last_name,
  p.email,
  p.is_active,
  cl.code  AS cefr_code,
  cl.label AS cefr_label,
  c.name   AS course_name,
  c.id     AS course_id,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status IN ('submitted','graded')) AS total_attempts,
  ROUND(AVG(a.score)   FILTER (WHERE a.status IN ('submitted','graded')), 1) AS avg_score,
  COUNT(DISTINCT a.id) FILTER (WHERE a.passed = TRUE)  AS passed_count,
  COUNT(DISTINCT a.id) FILTER (WHERE a.passed = FALSE) AS failed_count
FROM public.profiles p
JOIN public.roles r ON r.id = p.role_id AND r.name = 'student'
LEFT JOIN public.enrollments e  ON e.student_id = p.id
LEFT JOIN public.courses c      ON c.id = e.course_id
LEFT JOIN public.cefr_levels cl ON cl.id = c.cefr_level_id
LEFT JOIN public.attempts a     ON a.student_id = p.id
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
  cl.code AS cefr_code,
  p.first_name || ' ' || p.last_name AS created_by_name,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status IN ('submitted','graded')) AS completed_count,
  COUNT(DISTINCT a.student_id) AS unique_students,
  ROUND(AVG(a.score) FILTER (WHERE a.status IN ('submitted','graded')), 1) AS avg_score,
  MIN(a.score) FILTER (WHERE a.status IN ('submitted','graded')) AS min_score,
  MAX(a.score) FILTER (WHERE a.status IN ('submitted','graded')) AS max_score,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'in_progress') AS in_progress_count
FROM public.evaluations ev
LEFT JOIN public.cefr_levels cl ON cl.id = ev.cefr_level_id
LEFT JOIN public.profiles p     ON p.id  = ev.created_by
LEFT JOIN public.attempts a     ON a.evaluation_id = ev.id
GROUP BY ev.id, ev.organization_id, ev.title, ev.eval_type, ev.status,
         ev.time_limit_min, ev.available_until, ev.pass_score, cl.code,
         p.first_name, p.last_name;

-- ─── 15. FUNCTIONS ────────────────────────────────────────────

-- Helper: my role
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT r.name FROM public.profiles p
  JOIN public.roles r ON r.id = p.role_id
  WHERE p.id = auth.uid() LIMIT 1;
$$;

-- Helper: my org
CREATE OR REPLACE FUNCTION public.my_org()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Auto-grade attempt (multiple choice only)
CREATE OR REPLACE FUNCTION public.auto_grade_attempt(p_attempt_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total   NUMERIC := 0;
  v_earned  NUMERIC := 0;
  v_score   NUMERIC := 0;
  v_pass    NUMERIC;
BEGIN
  -- Calcular puntos de preguntas objetivas
  UPDATE public.answers ans
  SET
    is_correct    = opt.is_correct,
    points_earned = CASE WHEN opt.is_correct THEN q.points ELSE 0 END
  FROM public.options opt
  JOIN public.questions q ON q.id = ans.question_id
  WHERE ans.attempt_id = p_attempt_id
    AND ans.option_id = opt.id
    AND q.q_type IN ('multiple_choice','true_false');

  SELECT SUM(q.points) INTO v_total
  FROM public.answers ans
  JOIN public.questions q ON q.id = ans.question_id
  WHERE ans.attempt_id = p_attempt_id
    AND q.q_type IN ('multiple_choice','true_false');

  SELECT SUM(points_earned) INTO v_earned
  FROM public.answers
  WHERE attempt_id = p_attempt_id;

  v_score := CASE WHEN COALESCE(v_total,0) > 0
             THEN ROUND((COALESCE(v_earned,0) / v_total) * 100, 2)
             ELSE 0 END;

  SELECT ev.pass_score INTO v_pass
  FROM public.attempts a
  JOIN public.evaluations ev ON ev.id = a.evaluation_id
  WHERE a.id = p_attempt_id;

  UPDATE public.attempts
  SET
    score          = v_score,
    passed         = (v_score >= COALESCE(v_pass, 60)),
    submitted_at   = NOW(),
    status         = 'submitted',
    time_taken_sec = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
  WHERE id = p_attempt_id;

  RETURN v_score;
END;
$$;

-- ─── 16. RLS ──────────────────────────────────────────────────
ALTER TABLE public.organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;

-- Organizations
CREATE POLICY "org_read" ON public.organizations FOR SELECT USING (TRUE);

-- Profiles: same org only
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (organization_id = public.my_org());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (organization_id = public.my_org() OR public.my_role() = 'director');
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.my_role() IN ('director','secretary'));
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE
  USING (public.my_role() = 'director');

-- Courses
CREATE POLICY "courses_select" ON public.courses FOR SELECT
  USING (organization_id = public.my_org());
CREATE POLICY "courses_write" ON public.courses FOR ALL
  USING (organization_id = public.my_org() AND public.my_role() IN ('director','coordinator'));

-- Enrollments
CREATE POLICY "enrollments_select" ON public.enrollments FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.my_role() IN ('director','coordinator','secretary')
  );
CREATE POLICY "enrollments_write" ON public.enrollments FOR ALL
  USING (public.my_role() IN ('director','coordinator','secretary'));

-- Evaluations: same org
CREATE POLICY "evaluations_select" ON public.evaluations FOR SELECT
  USING (
    organization_id = public.my_org()
    AND (status = 'published' OR public.my_role() IN ('director','coordinator'))
  );
CREATE POLICY "evaluations_write" ON public.evaluations FOR ALL
  USING (organization_id = public.my_org() AND public.my_role() IN ('director','coordinator'));

-- Evaluation courses
CREATE POLICY "eval_courses_select" ON public.evaluation_courses FOR SELECT USING (TRUE);
CREATE POLICY "eval_courses_write"  ON public.evaluation_courses FOR ALL
  USING (public.my_role() IN ('director','coordinator'));

-- Questions
CREATE POLICY "questions_select" ON public.questions FOR SELECT USING (TRUE);
CREATE POLICY "questions_write"  ON public.questions FOR ALL
  USING (public.my_role() IN ('director','coordinator'));

-- Options
CREATE POLICY "options_select" ON public.options FOR SELECT USING (TRUE);
CREATE POLICY "options_write"  ON public.options FOR ALL
  USING (public.my_role() IN ('director','coordinator'));

-- Attempts
CREATE POLICY "attempts_select" ON public.attempts FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.my_role() IN ('director','coordinator')
  );
CREATE POLICY "attempts_insert" ON public.attempts FOR INSERT
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "attempts_update" ON public.attempts FOR UPDATE
  USING (student_id = auth.uid() OR public.my_role() IN ('director','coordinator'));

-- Answers
CREATE POLICY "answers_select" ON public.answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.id = attempt_id AND (a.student_id = auth.uid() OR public.my_role() IN ('director','coordinator'))
    )
  );
CREATE POLICY "answers_write" ON public.answers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.id = attempt_id AND a.student_id = auth.uid()
    )
    OR public.my_role() IN ('director','coordinator')
  );

-- Notifications
CREATE POLICY "notif_select" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
