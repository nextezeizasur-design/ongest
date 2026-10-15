-- 012_mark_reading_question_sentence.sql
--
-- Complementa la migración 010/011 (consigna repetida) y el pedido del
-- 2026-10-14: en las preguntas de comprensión de Reading, la oración
-- final (la consigna/afirmación puntual que el alumno tiene que
-- responder) quedaba visualmente igual al párrafo de lectura que la
-- precede, y era difícil distinguir dónde termina el texto y empieza
-- la pregunta.
--
-- Desde ahora ExerciseEditor.tsx antepone el marcador "❓ " a esa
-- oración final al crear preguntas de Reading (multiple_choice,
-- true_false y underline dentro del bloque de comprensión), y las
-- pantallas de examen/resultados/vista previa la resaltan en una caja
-- celeste cuando detectan ese marcador. Esta migración retrofittea el
-- marcador en las preguntas 27-33 de "A2 Final Exam Written"
-- (evaluation_id = '94faeb5f-2646-45f2-8034-cbe4846e513b'), que ya
-- tienen el párrafo insertado por la migración 011 pero sin el
-- marcador nuevo.
--
-- Es idempotente: solo toca filas que todavía no tengan "❓" en el body.

BEGIN;

UPDATE questions
SET body = regexp_replace(body, E'\\n\\n([^\\n]+)$', E'\n\n❓ \\1')
WHERE evaluation_id = '94faeb5f-2646-45f2-8034-cbe4846e513b'
  AND id IN (
    '635def56-b893-4d99-b29e-ad4642bf56d6',  -- sort_order 27
    '2ed91841-da4f-4a89-bd6a-c814895c9062',  -- sort_order 28
    '886760a3-335c-467c-8aef-87a043452a1b',  -- sort_order 29
    '0d3f02e9-c856-47b4-bdf8-86d3461a1d70',  -- sort_order 30
    'a3cab686-fa87-463e-b9b4-54f944097020',  -- sort_order 31
    '10d9ac49-67d0-409b-b5df-2a1633d3b7de',  -- sort_order 32
    '72a50155-c1e5-4182-bde7-0295be578430'   -- sort_order 33
  )
  AND body NOT LIKE '%❓%';

COMMIT;

-- Verificación:
-- SELECT sort_order, right(body, 90) AS tail
-- FROM questions
-- WHERE evaluation_id = '94faeb5f-2646-45f2-8034-cbe4846e513b'
-- ORDER BY sort_order;
