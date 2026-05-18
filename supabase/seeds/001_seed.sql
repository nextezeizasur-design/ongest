-- ============================================================
-- SEEDS — Datos de ejemplo para desarrollo
-- Ejecutar DESPUÉS de 001_schema.sql
-- ============================================================

-- 1. Organización base
INSERT INTO public.organizations (id, name, slug, primary_color)
VALUES ('00000000-0000-0000-0000-000000000001', 'Next English Institute', 'next-ezeiza', '#642f8d')
ON CONFLICT DO NOTHING;

-- 2. Crear usuarios via Supabase Auth (hacerlo desde Dashboard o con service_role key)
-- Luego asignar roles manualmente:

/*
-- Ejemplo: una vez que crees los usuarios en Auth, actualizá sus perfiles:

-- Director
UPDATE public.profiles
SET role_id = (SELECT id FROM roles WHERE name = 'director'),
    first_name = 'Admin', last_name = 'Director'
WHERE email = 'director@nextenglish.edu.ar';

-- Coordinator
UPDATE public.profiles
SET role_id = (SELECT id FROM roles WHERE name = 'coordinator'),
    first_name = 'María', last_name = 'González'
WHERE email = 'coordinadora@nextenglish.edu.ar';

-- Secretary
UPDATE public.profiles
SET role_id = (SELECT id FROM roles WHERE name = 'secretary'),
    first_name = 'Laura', last_name = 'Martínez'
WHERE email = 'secretaria@nextenglish.edu.ar';
*/

-- 3. Cursos de ejemplo (reemplazar teacher_id con UUID real)
INSERT INTO public.courses (id, organization_id, name, description, cefr_level_id, is_active)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Beginner A',        'Turno mañana — A1', 1, TRUE),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Elementary B',      'Turno tarde — A2',  2, TRUE),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Intermediate C',    'Turno noche — B1',  3, TRUE),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Upper Intermediate', 'Turno tarde — B2',  4, TRUE),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Advanced C1',       'Turno noche — C1',  5, TRUE)
ON CONFLICT DO NOTHING;

-- 4. Evaluación de ejemplo
INSERT INTO public.evaluations (
  id, organization_id, title, description, instructions,
  cefr_level_id, eval_type, time_limit_min, pass_score, status
) VALUES (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Grammar Test — Present Simple B1',
  'Evaluación de gramática nivel B1 — Unidad 1',
  'Leé cada pregunta con atención. Tenés 30 minutos para completar el examen.',
  3, 'multiple_choice', 30, 60, 'published'
) ON CONFLICT DO NOTHING;

-- 5. Preguntas de ejemplo
INSERT INTO public.questions (id, evaluation_id, sort_order, q_type, body, points) VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'multiple_choice', 'She ___ to school every day.', 1),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 2, 'multiple_choice', 'They ___ playing football right now.', 1),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 3, 'multiple_choice', 'I ___ never been to London.', 1),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 4, 'true_false',       'The Present Simple is used for habits and routines.', 1),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 5, 'short_answer',     'Write a sentence using the Present Continuous.', 2)
ON CONFLICT DO NOTHING;

-- 6. Opciones de las preguntas MC
INSERT INTO public.options (question_id, body, is_correct, sort_order) VALUES
  ('30000000-0000-0000-0000-000000000001', 'go',   FALSE, 1),
  ('30000000-0000-0000-0000-000000000001', 'goes', TRUE,  2),
  ('30000000-0000-0000-0000-000000000001', 'going',FALSE, 3),
  ('30000000-0000-0000-0000-000000000001', 'gone', FALSE, 4),

  ('30000000-0000-0000-0000-000000000002', 'are',  TRUE,  1),
  ('30000000-0000-0000-0000-000000000002', 'is',   FALSE, 2),
  ('30000000-0000-0000-0000-000000000002', 'were', FALSE, 3),
  ('30000000-0000-0000-0000-000000000002', 'be',   FALSE, 4),

  ('30000000-0000-0000-0000-000000000003', 'have', TRUE,  1),
  ('30000000-0000-0000-0000-000000000003', 'has',  FALSE, 2),
  ('30000000-0000-0000-0000-000000000003', 'had',  FALSE, 3),
  ('30000000-0000-0000-0000-000000000003', 'am',   FALSE, 4),

  ('30000000-0000-0000-0000-000000000004', 'True',  TRUE,  1),
  ('30000000-0000-0000-0000-000000000004', 'False', FALSE, 2)
ON CONFLICT DO NOTHING;

-- 7. Asignar evaluación al curso Intermediate C
INSERT INTO public.evaluation_courses (evaluation_id, course_id)
VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;
