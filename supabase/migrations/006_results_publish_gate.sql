-- ============================================================
-- 006_results_publish_gate.sql
-- ============================================================
-- Ejecutar manualmente en el SQL Editor de Supabase, EN ORDEN,
-- bloque por bloque. No es "correr todo de una" — el PASO 2 es
-- destructivo (borra opciones y recalcula scores), revisá el
-- resultado del PASO 1 (diagnóstico) antes de avanzar.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- PASO 0: Nueva columna — el único semáforo que decide si el
-- alumno puede ver un resultado/certificado.
--   NULL          → el alumno NO ve nada todavía
--   NOT NULL      → resultado publicado (por corrección manual
--                    finalizada, o por publicación manual de un
--                    intento auto-corregido)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS results_published_at TIMESTAMPTZ;

-- Los intentos que YA tienen status='graded' (corrección manual
-- ya finalizada por un docente) se consideran publicados desde
-- ya — no hay que esconder algo que el docente ya cerró.
UPDATE public.attempts
SET results_published_at = COALESCE(graded_at, submitted_at)
WHERE status = 'graded'
  AND results_published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attempts_pending_publish
  ON public.attempts (evaluation_id)
  WHERE status = 'submitted' AND results_published_at IS NULL;


-- ────────────────────────────────────────────────────────────
-- PASO 1: DIAGNÓSTICO (solo lectura) — preguntas con opciones
-- de texto duplicado dentro de la misma pregunta.
-- Corré esto primero y revisá los resultados antes del PASO 2.
-- ────────────────────────────────────────────────────────────
SELECT
  q.id            AS question_id,
  q.body          AS pregunta,
  e.title         AS evaluacion,
  lower(trim(o.body)) AS texto_opcion_duplicado,
  COUNT(*)        AS cantidad_copias,
  array_agg(o.id ORDER BY o.is_correct DESC) AS option_ids,
  bool_or(o.is_correct) AS alguna_marcada_correcta
FROM public.options o
JOIN public.questions q  ON q.id = o.question_id
JOIN public.evaluations e ON e.id = q.evaluation_id
GROUP BY q.id, q.body, e.title, lower(trim(o.body))
HAVING COUNT(*) > 1
ORDER BY e.title, q.body;

-- También: cuántos intentos de alumnos ya fueron afectados
-- (respondieron una pregunta que tiene este problema).
SELECT
  e.title AS evaluacion,
  q.body  AS pregunta,
  COUNT(DISTINCT a.attempt_id) AS intentos_afectados
FROM public.answers a
JOIN public.questions q ON q.id = a.question_id
JOIN public.evaluations e ON e.id = q.evaluation_id
WHERE q.id IN (
  SELECT o.question_id
  FROM public.options o
  GROUP BY o.question_id, lower(trim(o.body))
  HAVING COUNT(*) > 1
)
GROUP BY e.title, q.body
ORDER BY intentos_afectados DESC;


-- ────────────────────────────────────────────────────────────
-- PASO 2: LIMPIEZA (destructivo) — correr recién después de
-- revisar el PASO 1.
--
-- Qué hace:
--  a) Para cada grupo de opciones duplicadas (mismo texto, misma
--     pregunta), conserva UNA sola copia — prioriza quedarse con
--     la marcada is_correct=true si existe.
--  b) Reasigna las respuestas de alumnos (`answers.option_id`)
--     que apuntaban a la copia eliminada, hacia la que sobrevive.
--  c) Recalcula is_correct / points_earned de esas respuestas.
--  d) Recalcula el score final de los attempts afectados que
--     estén 100% objetivos (usa auto_grade_attempt, no toca
--     los que tienen corrección manual pendiente).
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_group RECORD;
  v_survivor UUID;
  v_attempt RECORD;
BEGIN
  FOR v_group IN
    SELECT question_id, lower(trim(body)) AS norm_body
    FROM public.options
    GROUP BY question_id, lower(trim(body))
    HAVING COUNT(*) > 1
  LOOP
    -- Elegir sobreviviente: la marcada correcta, si hay varias
    -- marcadas correctas (no debería pasar) toma la de menor sort_order.
    SELECT id INTO v_survivor
    FROM public.options
    WHERE question_id = v_group.question_id
      AND lower(trim(body)) = v_group.norm_body
    ORDER BY is_correct DESC, sort_order ASC
    LIMIT 1;

    -- Reasignar respuestas de alumnos que apuntaban a una copia
    -- que va a ser borrada.
    UPDATE public.answers
    SET option_id = v_survivor
    WHERE question_id = v_group.question_id
      AND option_id IN (
        SELECT id FROM public.options
        WHERE question_id = v_group.question_id
          AND lower(trim(body)) = v_group.norm_body
          AND id <> v_survivor
      );

    -- Borrar las copias duplicadas (deja solo el sobreviviente).
    DELETE FROM public.options
    WHERE question_id = v_group.question_id
      AND lower(trim(body)) = v_group.norm_body
      AND id <> v_survivor;
  END LOOP;

  -- Recalcular is_correct/points_earned de las respuestas tocadas.
  UPDATE public.answers ans
  SET
    is_correct    = opt.is_correct,
    points_earned = CASE WHEN opt.is_correct THEN q.points ELSE 0 END
  FROM public.options opt, public.questions q
  WHERE ans.option_id = opt.id
    AND q.id = ans.question_id
    AND q.q_type IN ('multiple_choice','true_false');

  -- Recalcular el score final SOLO de attempts sin preguntas de
  -- corrección manual pendiente (no queremos tocar essays/speaking
  -- ya corregidos a mano).
  FOR v_attempt IN
    SELECT DISTINCT a.attempt_id
    FROM public.answers a
    JOIN public.questions q ON q.id = a.question_id
    JOIN public.attempts att ON att.id = a.attempt_id
    WHERE att.status IN ('submitted','graded')
      AND NOT EXISTS (
        SELECT 1 FROM public.answers a2
        JOIN public.questions q2 ON q2.id = a2.question_id
        WHERE a2.attempt_id = att.id
          AND q2.q_type IN ('short_answer','essay','speaking')
      )
  LOOP
    PERFORM public.auto_grade_attempt(v_attempt.attempt_id);
  END LOOP;
END $$;


-- ────────────────────────────────────────────────────────────
-- PASO 3: PREVENCIÓN — bloquear a nivel de base de datos que
-- se vuelva a guardar una opción con texto duplicado dentro de
-- la misma pregunta (case/espacios insensitive). Cualquier
-- INSERT que lo intente falla con error, ya sea desde la UI,
-- la importación PDF, o un script manual.
-- Correr esto SOLO después de que el PASO 2 haya terminado sin
-- errores (si quedan duplicados, este índice no se va a poder crear).
-- ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS options_no_dup_text_idx
  ON public.options (question_id, lower(trim(body)));
