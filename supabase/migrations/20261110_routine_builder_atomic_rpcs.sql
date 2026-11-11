-- Migration: Sincronización segura de secuencia y RPCs transaccionales para el constructor de rutinas
-- Aplicado parcialmente vía MCP (`sync_routine_exercises_sequence`, `save_routine_from_builder`).
-- Ejecutar en Supabase SQL Editor para instalar también `update_routine_from_builder` (contiene DELETE).

-- 1. Sincronizar de inmediato la secuencia de routine_exercises.id
SELECT setval(
  'public.routine_exercises_id_seq',
  COALESCE((SELECT MAX(id) FROM public.routine_exercises), 1),
  (SELECT MAX(id) IS NOT NULL FROM public.routine_exercises)
);

-- 2. Función de respaldo con lock transaccional para garantizar que routine_exercises_id_seq nunca quede atrás de MAX(id)
CREATE OR REPLACE FUNCTION public.sync_routine_exercises_sequence()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_id bigint;
  v_last_val bigint;
  v_is_called boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('public.routine_exercises_id_seq'));

  SELECT MAX(id)::bigint INTO v_max_id FROM public.routine_exercises;
  SELECT last_value, is_called INTO v_last_val, v_is_called FROM public.routine_exercises_id_seq;

  IF v_max_id IS NULL THEN
    IF v_last_val IS NULL OR v_last_val < 1 THEN
      PERFORM setval('public.routine_exercises_id_seq', 1, false);
      RETURN 1;
    END IF;
    RETURN v_last_val;
  END IF;

  IF v_last_val IS NULL OR v_last_val < v_max_id OR (v_last_val = v_max_id AND NOT v_is_called) THEN
    PERFORM setval('public.routine_exercises_id_seq', v_max_id, true);
    RETURN v_max_id;
  END IF;

  RETURN v_last_val;
END;
$$;

-- 3. RPC atómico para crear (o clonar) una rutina completa en una única transacción
CREATE OR REPLACE FUNCTION public.save_routine_from_builder(
  p_routine_id text,
  p_coach_id uuid,
  p_payload jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_routine_id text;
  v_name text;
  v_description text;
  v_duration_weeks integer;
  v_goal text;
  v_level text;
  v_days_per_week integer;
  v_days jsonb;
  v_day jsonb;
  v_day_id text;
  v_day_number integer;
  v_day_name text;
  v_day_focus text;
  v_day_notes text;
  v_is_rest boolean;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Payload de rutina inválido.';
  END IF;

  v_name := btrim(COALESCE(p_payload->>'name', ''));
  IF v_name = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El nombre de la rutina es obligatorio.';
  END IF;

  v_days := COALESCE(p_payload->'days', '[]'::jsonb);
  IF jsonb_typeof(v_days) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El formato de días de la rutina es inválido.';
  END IF;

  v_routine_id := COALESCE(NULLIF(btrim(p_routine_id), ''), gen_random_uuid()::text);
  v_description := NULLIF(btrim(COALESCE(p_payload->>'description', '')), '');
  v_goal := NULLIF(btrim(COALESCE(p_payload->>'goal', '')), '');
  v_level := NULLIF(btrim(COALESCE(p_payload->>'level', '')), '');

  IF p_payload ? 'duration_weeks'
     AND p_payload->>'duration_weeks' IS NOT NULL
     AND btrim(p_payload->>'duration_weeks') <> '' THEN
    v_duration_weeks := GREATEST(1, (p_payload->>'duration_weeks')::integer);
  ELSE
    v_duration_weeks := NULL;
  END IF;

  v_days_per_week := GREATEST(
    1,
    COALESCE(NULLIF(btrim(COALESCE(p_payload->>'days_per_week', '')), '')::integer, 1)
  );

  PERFORM public.sync_routine_exercises_sequence();

  INSERT INTO public.routines (
    id,
    coach_id,
    name,
    description,
    duration_weeks,
    goal,
    level,
    days_per_week
  )
  VALUES (
    v_routine_id,
    p_coach_id,
    v_name,
    v_description,
    v_duration_weeks,
    v_goal,
    v_level,
    v_days_per_week
  );

  FOR v_day IN
    SELECT value
    FROM jsonb_array_elements(v_days) AS t(value)
    ORDER BY COALESCE(NULLIF(btrim(value->>'day_number'), '')::integer, 0)
  LOOP
    v_day_id := gen_random_uuid()::text;
    v_day_number := (v_day->>'day_number')::integer;
    v_day_name := btrim(COALESCE(v_day->>'day_name', ''));
    IF v_day_name = '' THEN
      v_day_name := 'Día ' || v_day_number;
    END IF;
    v_day_focus := NULLIF(btrim(COALESCE(v_day->>'focus', '')), '');
    v_day_notes := NULLIF(btrim(COALESCE(v_day->>'notes', '')), '');
    v_is_rest := COALESCE((v_day->>'is_rest_day')::boolean, false);

    INSERT INTO public.routine_days (
      id,
      routine_id,
      day_number,
      day_name,
      focus,
      notes,
      is_rest_day
    )
    VALUES (
      v_day_id,
      v_routine_id,
      v_day_number,
      v_day_name,
      v_day_focus,
      v_day_notes,
      v_is_rest
    );

    IF NOT v_is_rest
       AND jsonb_typeof(v_day->'exercises') = 'array'
       AND jsonb_array_length(v_day->'exercises') > 0 THEN
      INSERT INTO public.routine_exercises (
        routine_day_id,
        exercise_id,
        order_index,
        sets,
        reps,
        rest_seconds,
        superset_group,
        notes,
        warmup_sets
      )
      SELECT
        v_day_id,
        ex.value->>'exercise_id',
        COALESCE(NULLIF(btrim(COALESCE(ex.value->>'order_index', '')), '')::integer, (ex.ord - 1)::integer),
        GREATEST(1, COALESCE(NULLIF(btrim(COALESCE(ex.value->>'sets', '')), '')::integer, 3)),
        COALESCE(NULLIF(btrim(COALESCE(ex.value->>'reps', '')), ''), '10-12'),
        GREATEST(0, COALESCE(NULLIF(btrim(COALESCE(ex.value->>'rest_seconds', '')), '')::integer, 60)),
        NULLIF(btrim(COALESCE(ex.value->>'superset_group', '')), ''),
        NULLIF(btrim(COALESCE(ex.value->>'notes', '')), ''),
        NULLIF(btrim(COALESCE(ex.value->>'warmup_sets', '')), '')
      FROM jsonb_array_elements(v_day->'exercises') WITH ORDINALITY AS ex(value, ord)
      ORDER BY
        COALESCE(NULLIF(btrim(COALESCE(ex.value->>'order_index', '')), '')::integer, (ex.ord - 1)::integer),
        ex.ord;
    END IF;
  END LOOP;

  RETURN v_routine_id;
END;
$$;

-- 4. RPC atómico para actualizar una rutina existente preservando routine_days.id, suggested_weight y client_exercise_overrides
CREATE OR REPLACE FUNCTION public.update_routine_from_builder(
  p_routine_id text,
  p_coach_id uuid,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_coach_id uuid;
  v_name text;
  v_description text;
  v_duration_weeks integer;
  v_goal text;
  v_level text;
  v_days_per_week integer;
  v_days jsonb;
  v_day jsonb;
  v_day_id text;
  v_day_number integer;
  v_day_name text;
  v_day_focus text;
  v_is_rest boolean;
  v_saved_weights jsonb;
  v_saved_overrides jsonb;
BEGIN
  IF p_routine_id IS NULL OR btrim(p_routine_id) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ID de rutina inválido.';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Payload de rutina inválido.';
  END IF;

  v_name := btrim(COALESCE(p_payload->>'name', ''));
  IF v_name = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El nombre de la rutina es obligatorio.';
  END IF;

  v_days := COALESCE(p_payload->'days', '[]'::jsonb);
  IF jsonb_typeof(v_days) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El formato de días de la rutina es inválido.';
  END IF;

  SELECT coach_id INTO v_existing_coach_id
  FROM public.routines
  WHERE id = p_routine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La rutina especificada no existe.';
  END IF;

  v_description := NULLIF(btrim(COALESCE(p_payload->>'description', '')), '');
  v_goal := NULLIF(btrim(COALESCE(p_payload->>'goal', '')), '');
  v_level := NULLIF(btrim(COALESCE(p_payload->>'level', '')), '');

  IF p_payload ? 'duration_weeks'
     AND p_payload->>'duration_weeks' IS NOT NULL
     AND btrim(p_payload->>'duration_weeks') <> '' THEN
    v_duration_weeks := GREATEST(1, (p_payload->>'duration_weeks')::integer);
  ELSE
    v_duration_weeks := NULL;
  END IF;

  v_days_per_week := GREATEST(
    1,
    COALESCE(NULLIF(btrim(COALESCE(p_payload->>'days_per_week', '')), '')::integer, 1)
  );

  PERFORM public.sync_routine_exercises_sequence();

  UPDATE public.routines
  SET
    coach_id = COALESCE(v_existing_coach_id, p_coach_id),
    name = v_name,
    description = v_description,
    duration_weeks = v_duration_weeks,
    goal = v_goal,
    level = v_level,
    days_per_week = v_days_per_week,
    updated_at = now()
  WHERE id = p_routine_id;

  -- Eliminar días removidos del plan
  DELETE FROM public.routine_days rd
  WHERE rd.routine_id = p_routine_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_days) AS d(value)
      WHERE (d.value->>'day_number')::integer = rd.day_number
    );

  FOR v_day IN
    SELECT value
    FROM jsonb_array_elements(v_days) AS t(value)
    ORDER BY COALESCE(NULLIF(btrim(value->>'day_number'), '')::integer, 0)
  LOOP
    v_day_number := (v_day->>'day_number')::integer;
    v_day_name := btrim(COALESCE(v_day->>'day_name', ''));
    IF v_day_name = '' THEN
      v_day_name := 'Día ' || v_day_number;
    END IF;
    v_day_focus := NULLIF(btrim(COALESCE(v_day->>'focus', '')), '');
    v_is_rest := COALESCE((v_day->>'is_rest_day')::boolean, false);

    SELECT id INTO v_day_id
    FROM public.routine_days
    WHERE routine_id = p_routine_id AND day_number = v_day_number;

    IF v_day_id IS NOT NULL THEN
      UPDATE public.routine_days
      SET
        day_name = v_day_name,
        focus = v_day_focus,
        is_rest_day = v_is_rest
      WHERE id = v_day_id;

      -- Snapshot de suggested_weight por ocurrencia de exercise_id en el día
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'exercise_id', oe.exercise_id,
            'occ', oe.occ,
            'suggested_weight', oe.suggested_weight
          )
        ),
        '[]'::jsonb
      )
      INTO v_saved_weights
      FROM (
        SELECT * FROM (
          SELECT
            re.exercise_id,
            re.suggested_weight,
            row_number() OVER (PARTITION BY re.exercise_id ORDER BY re.order_index, re.id) AS occ
          FROM public.routine_exercises re
          WHERE re.routine_day_id = v_day_id
        ) ranked
        WHERE ranked.suggested_weight IS NOT NULL
      ) oe;

      -- Snapshot de client_exercise_overrides antes de reemplazar ejercicios del día
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'client_routine_id', ov.client_routine_id,
            'exercise_id', re.exercise_id,
            'replacement_exercise_id', ov.replacement_exercise_id,
            'reason', ov.reason,
            'changed_by', ov.changed_by,
            'notified_coach', ov.notified_coach
          )
        ),
        '[]'::jsonb
      )
      INTO v_saved_overrides
      FROM public.client_exercise_overrides ov
      JOIN public.routine_exercises re ON re.id = ov.original_routine_exercise_id
      WHERE re.routine_day_id = v_day_id;

      DELETE FROM public.routine_exercises
      WHERE routine_day_id = v_day_id;
    ELSE
      v_day_id := gen_random_uuid()::text;
      INSERT INTO public.routine_days (
        id,
        routine_id,
        day_number,
        day_name,
        focus,
        is_rest_day
      )
      VALUES (
        v_day_id,
        p_routine_id,
        v_day_number,
        v_day_name,
        v_day_focus,
        v_is_rest
      );

      v_saved_weights := '[]'::jsonb;
      v_saved_overrides := '[]'::jsonb;
    END IF;

    IF NOT v_is_rest
       AND jsonb_typeof(v_day->'exercises') = 'array'
       AND jsonb_array_length(v_day->'exercises') > 0 THEN
      WITH incoming AS (
        SELECT
          ex.value->>'exercise_id' AS exercise_id,
          COALESCE(NULLIF(btrim(COALESCE(ex.value->>'order_index', '')), '')::integer, (ex.ord - 1)::integer) AS order_index,
          GREATEST(1, COALESCE(NULLIF(btrim(COALESCE(ex.value->>'sets', '')), '')::integer, 3)) AS sets,
          COALESCE(NULLIF(btrim(COALESCE(ex.value->>'reps', '')), ''), '10-12') AS reps,
          GREATEST(0, COALESCE(NULLIF(btrim(COALESCE(ex.value->>'rest_seconds', '')), '')::integer, 60)) AS rest_seconds,
          NULLIF(btrim(COALESCE(ex.value->>'superset_group', '')), '') AS superset_group,
          NULLIF(btrim(COALESCE(ex.value->>'notes', '')), '') AS notes,
          NULLIF(btrim(COALESCE(ex.value->>'warmup_sets', '')), '') AS warmup_sets,
          ex.ord
        FROM jsonb_array_elements(v_day->'exercises') WITH ORDINALITY AS ex(value, ord)
      ),
      numbered_incoming AS (
        SELECT
          i.*,
          row_number() OVER (PARTITION BY i.exercise_id ORDER BY i.order_index, i.ord) AS occ
        FROM incoming i
      ),
      saved_weights AS (
        SELECT
          w.value->>'exercise_id' AS exercise_id,
          (w.value->>'occ')::bigint AS occ,
          (w.value->>'suggested_weight')::numeric AS suggested_weight
        FROM jsonb_array_elements(v_saved_weights) AS w(value)
      ),
      inserted AS (
        INSERT INTO public.routine_exercises (
          routine_day_id,
          exercise_id,
          order_index,
          sets,
          reps,
          rest_seconds,
          superset_group,
          notes,
          warmup_sets,
          suggested_weight
        )
        SELECT
          v_day_id,
          ni.exercise_id,
          ni.order_index,
          ni.sets,
          ni.reps,
          ni.rest_seconds,
          ni.superset_group,
          ni.notes,
          ni.warmup_sets,
          sw.suggested_weight
        FROM numbered_incoming ni
        LEFT JOIN saved_weights sw
          ON sw.exercise_id = ni.exercise_id AND sw.occ = ni.occ
        ORDER BY ni.order_index, ni.ord
        RETURNING id, exercise_id, order_index
      ),
      first_inserted_by_ex AS (
        SELECT DISTINCT ON (exercise_id)
          exercise_id,
          id AS new_routine_exercise_id
        FROM inserted
        ORDER BY exercise_id, order_index, id
      )
      INSERT INTO public.client_exercise_overrides (
        client_routine_id,
        original_routine_exercise_id,
        replacement_exercise_id,
        reason,
        changed_by,
        notified_coach
      )
      SELECT
        (ov.value->>'client_routine_id')::uuid,
        fi.new_routine_exercise_id,
        ov.value->>'replacement_exercise_id',
        ov.value->>'reason',
        COALESCE(NULLIF(btrim(COALESCE(ov.value->>'changed_by', '')), ''), 'client'),
        COALESCE((ov.value->>'notified_coach')::boolean, false)
      FROM jsonb_array_elements(v_saved_overrides) AS ov(value)
      JOIN first_inserted_by_ex fi
        ON fi.exercise_id = ov.value->>'exercise_id'
      ON CONFLICT (client_routine_id, original_routine_exercise_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- 5. Permisos estrictos: solo service_role (invocado vía Server Actions autenticadas)
REVOKE ALL ON FUNCTION public.sync_routine_exercises_sequence() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_routine_exercises_sequence() TO service_role;

REVOKE ALL ON FUNCTION public.save_routine_from_builder(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_routine_from_builder(text, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.update_routine_from_builder(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_routine_from_builder(text, uuid, jsonb) TO service_role;
