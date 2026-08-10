-- ═══════════════════════════════════════════════════════════════════════
-- reopen_attempt: reabre el intento de UN alumno puntual para que pueda
-- volver a rendir, sin subir el max_attempts general del examen ni
-- afectar a otros alumnos.
--
-- Seguridad: SECURITY DEFINER, valida adentro de la función que quien
-- llama sea director o coordinator — no confía solo en el frontend.
--
-- Ejecutar completo en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reopen_attempt(p_attempt_id UUID)
RETURNS TABLE(ok BOOLEAN, error_code TEXT, error_msg TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role_name TEXT;
  v_attempt   RECORD;
BEGIN
  -- Solo director/coordinator pueden reabrir, sin importar quién invoque el RPC
  SELECT r.name INTO v_role_name
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.role_id
  WHERE p.id = auth.uid();

  IF v_role_name IS NULL OR v_role_name NOT IN ('director', 'coordinator') THEN
    RETURN QUERY SELECT FALSE, 'forbidden'::TEXT, 'No autorizado para reabrir intentos.'::TEXT;
    RETURN;
  END IF;

  SELECT a.id, a.evaluation_id, a.student_id, e.organization_id
  INTO v_attempt
  FROM public.attempts a
  JOIN public.evaluations e ON e.id = a.evaluation_id
  WHERE a.id = p_attempt_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'not_found'::TEXT, 'Intento no encontrado.'::TEXT;
    RETURN;
  END IF;

  -- El que reabre debe pertenecer a la misma organización que el examen
  IF v_attempt.organization_id != (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) THEN
    RETURN QUERY SELECT FALSE, 'forbidden'::TEXT, 'No autorizado para reabrir este intento.'::TEXT;
    RETURN;
  END IF;

  -- Reinicio limpio: borra respuestas previas y devuelve el intento a in_progress
  DELETE FROM public.answers WHERE attempt_id = p_attempt_id;

  UPDATE public.attempts
  SET submitted_at     = NULL,
      graded_at        = NULL,
      status           = 'in_progress',
      score            = NULL,
      passed           = NULL,
      time_taken_sec   = NULL,
      teacher_feedback = NULL,
      started_at       = now()
  WHERE id = p_attempt_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT, NULL::TEXT;
END;
$function$;
