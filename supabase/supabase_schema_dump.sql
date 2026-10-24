-- Supabase Schema Dump
-- Project ID: rucoach-production
-- Date: 2026-04-01
-- Nota: Incluye columnas bilingües _es en la tabla exercises (1,324 ejercicios traducidos al español)

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

-- 2. TABLES
CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    avatar_url text,
    xp_points integer DEFAULT 0,
    level integer DEFAULT 1,
    streak_days integer DEFAULT 0,
    last_workout_at timestamp with time zone,
    fitness_goal text,
    experience_level text,
    onboarding_completed boolean DEFAULT false,
    notifications_enabled boolean DEFAULT true,
    username text,
    subscription_status text DEFAULT 'active'::text,
    subscription_ends_at timestamp with time zone,
    phone text,
    birth_date date,
    gender text,
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_email_key UNIQUE (email),
    CONSTRAINT profiles_username_key UNIQUE (username)
);

CREATE TABLE public.membership_plans (
    id text NOT NULL,
    name text NOT NULL,
    duration_days integer NOT NULL,
    price numeric NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    coach_id uuid,
    CONSTRAINT membership_plans_pkey PRIMARY KEY (id)
);

CREATE TABLE public.routines (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    goal text,
    level text,
    duration_weeks integer,
    days_per_week integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    coach_id uuid,
    CONSTRAINT routines_pkey PRIMARY KEY (id)
);

CREATE TABLE public.clients (
    id text NOT NULL,
    user_id uuid,
    full_name text NOT NULL,
    phone text,
    email text,
    birth_date date,
    gender text,
    avatar_url text,
    initial_weight numeric,
    current_weight numeric,
    height numeric,
    goal text,
    experience_level text,
    current_plan_id text,
    membership_start date,
    membership_end date,
    status text NOT NULL DEFAULT 'active'::text,
    total_sessions integer DEFAULT 0,
    last_session_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    admin_approved boolean DEFAULT false,
    approval_date timestamp with time zone,
    suspension_reason text,
    last_payment_date timestamp with time zone,
    assigned_routine_id text,
    coach_id uuid,
    CONSTRAINT clients_pkey PRIMARY KEY (id),
    CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT clients_current_plan_id_fkey FOREIGN KEY (current_plan_id) REFERENCES public.membership_plans(id) ON DELETE SET NULL,
    CONSTRAINT clients_assigned_routine_id_fkey FOREIGN KEY (assigned_routine_id) REFERENCES public.routines(id) ON DELETE SET NULL
);

CREATE TABLE public.achievements (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text NOT NULL,
    rarity text NOT NULL,
    icon text NOT NULL,
    requirement text,
    xp_reward integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    category text,
    requirement_type text,
    requirement_value numeric,
    CONSTRAINT achievements_pkey PRIMARY KEY (id),
    CONSTRAINT achievements_name_key UNIQUE (name)
);

CREATE TABLE public.admin_setup (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    setup_code text NOT NULL,
    admin_email text,
    is_used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    used_at timestamp with time zone,
    CONSTRAINT admin_setup_pkey PRIMARY KEY (id),
    CONSTRAINT admin_setup_setup_code_key UNIQUE (setup_code)
);

CREATE TABLE public.exercises (
    id text NOT NULL,
    name text NOT NULL,
    primary_muscle text NOT NULL,
    secondary_muscle text,
    exercise_type text NOT NULL,
    equipment text,
    demo_video_url text,
    technique_notes text,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    gif_url text,
    target_muscles text[],
    body_parts text[],
    equipments text[],
    secondary_muscles text[],
    instructions text[],
    uses_external_load boolean,
    -- Traducciones al español (bilingüe: _es columns)
    name_es text,
    equipment_es text,
    body_parts_es text[],
    target_muscles_es text[],
    secondary_muscles_es text[],
    instructions_es text[],
    -- Enriquecimiento anatómico y biomecánico (openGym)
    muscle_weights jsonb,
    description text,
    description_es text,
    default_increment_kg numeric DEFAULT 2.5,
    CONSTRAINT exercises_pkey PRIMARY KEY (id)
);

-- Índices GIN para filtros de catálogo por array en español
CREATE INDEX IF NOT EXISTS idx_exercises_body_parts_es ON public.exercises USING GIN (body_parts_es);
CREATE INDEX IF NOT EXISTS idx_exercises_target_muscles_es ON public.exercises USING GIN (target_muscles_es);

CREATE TABLE public.gym_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    admin_id uuid,
    gym_name text NOT NULL DEFAULT 'RU Coach'::text,
    logo_url text,
    phone text DEFAULT '9612378473'::text,
    schedule text,
    currency text DEFAULT 'MXN'::text,
    timezone text DEFAULT 'America/Mexico_City'::text,
    alert_days_before_expiry integer DEFAULT 5,
    inactivity_alert_days integer DEFAULT 3,
    daily_summary_hour integer DEFAULT 8,
    setup_completed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT gym_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.invitation_codes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    code text NOT NULL,
    created_by uuid NOT NULL,
    email text,
    expires_at timestamp with time zone,
    max_uses integer DEFAULT 1,
    times_used integer DEFAULT 0,
    is_active boolean DEFAULT true,
    used_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    client_id text,
    for_role text NOT NULL DEFAULT 'client'::text,
    CONSTRAINT invitation_codes_pkey PRIMARY KEY (id),
    CONSTRAINT invitation_codes_code_key UNIQUE (code),
    CONSTRAINT invitation_codes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE
);

CREATE TABLE public.messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    from_user_id uuid NOT NULL,
    to_user_id uuid NOT NULL,
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT messages_pkey PRIMARY KEY (id)
);

CREATE TABLE public.payments (
    id text NOT NULL,
    client_id text NOT NULL,
    plan_id text,
    amount numeric NOT NULL,
    paid_at timestamp with time zone DEFAULT now(),
    payment_method text,
    period_start date,
    period_end date,
    reference text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payments_pkey PRIMARY KEY (id),
    CONSTRAINT payments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
    CONSTRAINT payments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.membership_plans(id) ON DELETE SET NULL
);

CREATE TABLE public.personal_records (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    client_id text NOT NULL,
    exercise_id text NOT NULL,
    exercise_name text NOT NULL,
    weight_kg numeric,
    reps integer,
    max_time_seconds integer,
    achieved_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    estimated_1rm numeric,
    CONSTRAINT personal_records_pkey PRIMARY KEY (id),
    CONSTRAINT personal_records_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE
);

CREATE TABLE public.progress_photos (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    client_id text NOT NULL,
    photo_url text NOT NULL,
    view_type text,
    weight_kg numeric,
    notes text,
    taken_at date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT progress_photos_pkey PRIMARY KEY (id),
    CONSTRAINT progress_photos_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE
);

CREATE TABLE public.routine_days (
    id text NOT NULL,
    routine_id text NOT NULL,
    day_number integer NOT NULL,
    day_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    focus text,
    is_rest_day boolean DEFAULT false,
    notes text,
    CONSTRAINT routine_days_pkey PRIMARY KEY (id),
    CONSTRAINT routine_days_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES public.routines(id) ON DELETE CASCADE,
    CONSTRAINT routine_days_routine_id_day_number_key UNIQUE (routine_id, day_number)
);

CREATE TABLE public.routine_exercises (
    id SERIAL PRIMARY KEY,
    routine_day_id text NOT NULL,
    exercise_id text NOT NULL,
    order_index integer NOT NULL,
    sets integer NOT NULL,
    reps text,
    duration_seconds integer,
    suggested_weight numeric,
    rest_seconds integer NOT NULL,
    notes text,
    superset_group text,
    warmup_sets text,
    progression_policy text DEFAULT 'linear',
    reps_min integer,
    reps_max integer,
    intensifier jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT routine_exercises_routine_day_id_fkey FOREIGN KEY (routine_day_id) REFERENCES public.routine_days(id) ON DELETE CASCADE,
    CONSTRAINT routine_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE
);

CREATE TABLE public.workout_sessions (
    id text NOT NULL DEFAULT (gen_random_uuid())::text,
    client_id text NOT NULL,
    routine_day_id text,
    started_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone,
    duration_minutes integer,
    total_volume_kg numeric,
    exercises_completed integer DEFAULT 0,
    exercises_skipped integer DEFAULT 0,
    feeling_score integer,
    feeling_note text,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workout_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT workout_sessions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
    CONSTRAINT workout_sessions_routine_day_id_fkey FOREIGN KEY (routine_day_id) REFERENCES public.routine_days(id) ON DELETE SET NULL
);

CREATE TABLE public.exercise_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    workout_session_id text NOT NULL,
    exercise_id text NOT NULL,
    exercise_name text NOT NULL DEFAULT ''::text,
    set_number integer NOT NULL,
    weight_kg numeric,
    reps integer,
    duration_seconds integer,
    rpe integer,
    is_warmup boolean DEFAULT false,
    is_pr boolean DEFAULT false,
    notes text,
    performed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    routine_exercise_id integer,
    CONSTRAINT exercise_logs_pkey PRIMARY KEY (id),
    CONSTRAINT exercise_logs_workout_session_id_fkey FOREIGN KEY (workout_session_id) REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
    CONSTRAINT exercise_logs_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE,
    CONSTRAINT exercise_logs_routine_exercise_id_fkey FOREIGN KEY (routine_exercise_id) REFERENCES public.routine_exercises(id) ON DELETE SET NULL
);

CREATE TABLE public.client_routines (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    client_id text NOT NULL,
    routine_id text NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid,
    is_current boolean DEFAULT true,
    is_active boolean DEFAULT true,
    current_week integer DEFAULT 1,
    current_day_index integer DEFAULT 0,
    override_next_day_id text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT client_routines_pkey PRIMARY KEY (id),
    CONSTRAINT client_routines_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
    CONSTRAINT client_routines_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES public.routines(id) ON DELETE CASCADE,
    CONSTRAINT client_routines_override_next_day_id_fkey FOREIGN KEY (override_next_day_id) REFERENCES public.routine_days(id) ON DELETE SET NULL
);

CREATE TABLE public.routine_week_progress (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    client_routine_id uuid NOT NULL,
    week_number integer NOT NULL,
    day_number integer NOT NULL,
    workout_session_id text,
    completed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT routine_week_progress_pkey PRIMARY KEY (id),
    CONSTRAINT routine_week_progress_client_routine_id_fkey FOREIGN KEY (client_routine_id) REFERENCES public.client_routines(id) ON DELETE CASCADE,
    CONSTRAINT routine_week_progress_workout_session_id_fkey FOREIGN KEY (workout_session_id) REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
    CONSTRAINT routine_week_progress_client_routine_id_week_number_day_num_key UNIQUE (client_routine_id, week_number, day_number)
);

CREATE TABLE public.pr_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    client_id text NOT NULL,
    exercise_id text NOT NULL,
    workout_session_id text,
    kind text NOT NULL,
    weight_kg numeric,
    reps integer,
    estimated_1rm numeric,
    achieved_at timestamp with time zone DEFAULT now(),
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT pr_events_pkey PRIMARY KEY (id),
    CONSTRAINT pr_events_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
    CONSTRAINT pr_events_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE,
    CONSTRAINT pr_events_workout_session_id_fkey FOREIGN KEY (workout_session_id) REFERENCES public.workout_sessions(id) ON DELETE CASCADE
);

CREATE TABLE public.body_measurements (
    id text NOT NULL,
    client_id text NOT NULL,
    recorded_at timestamp with time zone DEFAULT now(),
    weight numeric,
    body_fat_pct numeric,
    waist_cm numeric,
    hip_cm numeric,
    chest_cm numeric,
    arm_cm numeric,
    thigh_cm numeric,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT body_measurements_pkey PRIMARY KEY (id),
    CONSTRAINT body_measurements_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE
);

CREATE TABLE public.user_achievements (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_achievements_pkey PRIMARY KEY (id),
    CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE,
    CONSTRAINT user_achievements_user_id_achievement_id_key UNIQUE (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS public.client_pain_reports (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    client_id text NOT NULL,
    body_region text NOT NULL,
    severity integer NOT NULL CHECK (severity BETWEEN 0 AND 10),
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    reported_at timestamp with time zone NOT NULL DEFAULT now(),
    resolved_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT client_pain_reports_pkey PRIMARY KEY (id),
    CONSTRAINT client_pain_reports_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.client_exercise_overrides (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    client_routine_id uuid NOT NULL,
    original_routine_exercise_id integer NOT NULL,
    replacement_exercise_id text NOT NULL,
    reason text,
    changed_by text NOT NULL DEFAULT 'client'::text CHECK (changed_by IN ('client', 'coach')),
    notified_coach boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT client_exercise_overrides_pkey PRIMARY KEY (id),
    CONSTRAINT client_exercise_overrides_routine_exercise_key UNIQUE (client_routine_id, original_routine_exercise_id),
    CONSTRAINT client_exercise_overrides_client_routine_id_fkey FOREIGN KEY (client_routine_id) REFERENCES public.client_routines(id) ON DELETE CASCADE,
    CONSTRAINT client_exercise_overrides_original_routine_exercise_id_fkey FOREIGN KEY (original_routine_exercise_id) REFERENCES public.routine_exercises(id) ON DELETE CASCADE,
    CONSTRAINT client_exercise_overrides_replacement_exercise_id_fkey FOREIGN KEY (replacement_exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint),
    CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);


-- 3. FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'); $function$;

CREATE OR REPLACE FUNCTION public.is_admin_or_receptionist()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'receptionist')); $function$;

CREATE OR REPLACE FUNCTION public.add_user_xp(p_user_id uuid, p_amount integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_new_xp integer;
BEGIN
  UPDATE public.profiles
  SET xp_points = xp_points + p_amount
  WHERE id = p_user_id
  RETURNING xp_points INTO v_new_xp;
  RETURN v_new_xp;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_level()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  -- Update level based on XP (100 XP per level)
  NEW.level := LEAST(100, (NEW.xp_points / 100)::integer + 1);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_streak()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Update last_workout_at to today
  UPDATE public.profiles
  SET 
    last_workout_at = NOW(),
    streak_days = CASE
      WHEN DATE(last_workout_at) = CURRENT_DATE - INTERVAL '1 day' THEN streak_days + 1
      WHEN DATE(last_workout_at) = CURRENT_DATE THEN streak_days
      ELSE 1  -- Reset streak if more than 1 day missed
    END
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_client_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.membership_end IS NOT NULL THEN
    IF NEW.membership_end < CURRENT_DATE THEN
      NEW.status = 'expired';
    ELSIF NEW.membership_end <= CURRENT_DATE + INTERVAL '7 days' THEN
      NEW.status = 'expiring_soon';
    ELSIF NEW.status IN ('expired', 'expiring_soon') THEN
      NEW.status = 'active';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_client_status_to_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF (NEW.user_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status) THEN
    UPDATE public.profiles
    SET subscription_status = NEW.status
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_status_to_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF (NEW.subscription_status IS DISTINCT FROM OLD.subscription_status) THEN
    UPDATE public.clients
    SET status = NEW.subscription_status
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_client_avatar_from_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'UPDATE' and new.avatar_url is distinct from old.avatar_url then
    update public.clients
    set avatar_url = new.avatar_url,
        updated_at = now()
    where user_id = new.id;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_client_last_session_from_workout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    if new.status = 'completed' then
      update public.clients c
      set last_session_at = greatest(
        coalesce(c.last_session_at, '-infinity'::timestamptz),
        new.started_at
      )
      where c.id = new.client_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status = 'completed'
       and (
         old.status is distinct from new.status
         or old.started_at is distinct from new.started_at
       ) then
      update public.clients c
      set last_session_at = greatest(
        coalesce(c.last_session_at, '-infinity'::timestamptz),
        new.started_at
      )
      where c.id = new.client_id;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_payment_to_client_membership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Solo actualizamos si el pago tiene fechas de período
  IF (NEW.period_start IS NOT NULL OR NEW.period_end IS NOT NULL) THEN
    UPDATE public.clients
    SET 
      current_plan_id = NEW.plan_id,
      membership_start = NEW.period_start,
      membership_end = NEW.period_end,
      status = 'active', -- Al registrar un pago con fechas, el cliente se activa
      last_payment_date = NEW.paid_at
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_first_admin(p_user_id uuid, p_email text, p_setup_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_admin_count integer;
  v_valid_code boolean;
BEGIN
  -- Check if setup code is valid and unused
  SELECT EXISTS(
    SELECT 1 FROM public.admin_setup
    WHERE setup_code = p_setup_code
    AND is_used = false
  ) INTO v_valid_code;
  
  IF NOT v_valid_code THEN
    RAISE EXCEPTION 'Invalid or used setup code';
  END IF;
  
  -- Check if there are already admins
  SELECT COUNT(*) FROM public.profiles WHERE role = 'admin' INTO v_admin_count;
  
  IF v_admin_count > 0 THEN
    RAISE EXCEPTION 'Admin already exists. Only one coach per gym.';
  END IF;
  
  -- Mark code as used
  UPDATE public.admin_setup
  SET is_used = true, admin_email = p_email, used_at = now()
  WHERE setup_code = p_setup_code;
  
  -- Update user profile to admin
  UPDATE public.profiles
  SET role = 'admin'
  WHERE id = p_user_id;
  
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.use_invitation_code_atomic(code_text text, user_id_val uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  inv_record record;
BEGIN
  SELECT id, client_id, created_by, for_role, times_used, max_uses, expires_at
  INTO inv_record
  FROM public.invitation_codes
  WHERE upper(trim(code)) = upper(trim(code_text))
    AND is_active = true
    AND times_used < max_uses
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Código inválido, expirado o ya usado',
      'client_id', null,
      'created_by', null,
      'for_role', 'client'
    );
  END IF;

  UPDATE public.invitation_codes
  SET
    times_used = times_used + 1,
    used_by_user_id = user_id_val
  WHERE id = inv_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'error', null,
    'client_id', inv_record.client_id,
    'created_by', inv_record.created_by,
    'for_role', coalesce(inv_record.for_role, 'client')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid)
 RETURNS TABLE(total_workouts bigint, total_sets bigint, total_xp integer, current_level integer, current_streak integer, achievements_unlocked bigint, total_prs bigint)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT el.workout_session_id)::bigint,
    COUNT(DISTINCT el.id)::bigint,
    COALESCE(p.xp_points, 0)::integer,
    COALESCE(p.level, 1)::integer,
    COALESCE(p.streak_days, 0)::integer,
    COUNT(DISTINCT ua.achievement_id)::bigint,
    COUNT(DISTINCT CASE WHEN el.is_pr THEN 1 END)::bigint
  FROM public.profiles p
  LEFT JOIN public.exercise_logs el ON p.id = el.user_id
  LEFT JOIN public.user_achievements ua ON p.id = ua.user_id
  WHERE p.id = p_user_id
  GROUP BY p.id, p.xp_points, p.level, p.streak_days;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_achievements(p_user_id uuid)
 RETURNS TABLE(achievement_id uuid, achievement_name text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT a.id, a.name
  FROM public.achievements a
  WHERE a.id NOT IN (
    SELECT achievement_id FROM public.user_achievements
    WHERE user_id = p_user_id
  )
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_client(p_user_id uuid)
 RETURNS TABLE(client_id text, full_name text, status text, admin_approved boolean, membership_end date, current_plan_id text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.id, c.full_name, c.status, c.admin_approved, c.membership_end, c.current_plan_id
  FROM public.clients c
  WHERE c.user_id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_client_status text;
  v_is_approved boolean;
  v_membership_end date;
BEGIN
  SELECT c.status, c.admin_approved, c.membership_end
  FROM public.clients c
  WHERE c.user_id = p_user_id
  INTO v_client_status, v_is_approved, v_membership_end;
  
  -- User must be approved and have active status and membership not expired
  RETURN COALESCE(v_is_approved, false) 
    AND v_client_status = 'active'
    AND COALESCE(v_membership_end >= CURRENT_DATE, true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.latest_completed_session_by_clients(client_ids text[])
 RETURNS TABLE(client_id text, started_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select distinct on (ws.client_id)
    ws.client_id,
    ws.started_at
  from public.workout_sessions ws
  where ws.client_id = any(client_ids)
    and ws.status = 'completed'
  order by ws.client_id, ws.started_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.client_achievement_session_rollups(p_client_id text, p_tz text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'lifetime_volume_kg', coalesce(sum(ws.total_volume_kg), 0)::double precision,
    'early_workout_count', coalesce(sum(
      case
        when ws.started_at is not null
         and extract(
           hour from (
             ws.started_at at time zone coalesce(nullif(trim(p_tz), ''), 'Europe/Madrid')
           )
         ) < 8
        then 1
        else 0
      end
    ), 0)::double precision,
    'max_session_volume_kg', coalesce(max(ws.total_volume_kg), 0)::double precision
  )
  from public.workout_sessions ws
  where ws.client_id = p_client_id;
$function$;

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_gym_settings_admin_id ON public.gym_settings USING btree (admin_id);
CREATE UNIQUE INDEX IF NOT EXISTS personal_records_user_id_exercise_id_key ON public.personal_records USING btree (client_id, exercise_id);
CREATE INDEX IF NOT EXISTS personal_records_client_achieved_at_idx ON public.personal_records USING btree (client_id, achieved_at DESC);
CREATE INDEX IF NOT EXISTS client_pain_reports_client_reported_idx ON public.client_pain_reports USING btree (client_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS client_pain_reports_active_idx ON public.client_pain_reports USING btree (client_id, is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_client_exercise_overrides_routine ON public.client_exercise_overrides USING btree (client_routine_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages USING btree (from_user_id, to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_to_user_created ON public.messages USING btree (to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_to_unread ON public.messages USING btree (to_user_id) WHERE (is_read = false);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON public.user_achievements USING btree (achievement_id);
CREATE INDEX IF NOT EXISTS idx_routines_coach_id ON public.routines USING btree (coach_id);
CREATE INDEX IF NOT EXISTS idx_routine_days_routine_id ON public.routine_days USING btree (routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine_day_id ON public.routine_exercises USING btree (routine_day_id);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_exercise_id ON public.routine_exercises USING btree (exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_client_id ON public.workout_sessions USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_routine_day_id ON public.workout_sessions USING btree (routine_day_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_started_at ON public.workout_sessions USING btree (started_at);
CREATE INDEX IF NOT EXISTS workout_sessions_client_status_started_idx ON public.workout_sessions USING btree (client_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_is_active ON public.invitation_codes USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_created_by ON public.invitation_codes USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_client_id ON public.invitation_codes USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_achievements_rarity ON public.achievements USING btree (rarity);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_clients_coach_id ON public.clients USING btree (coach_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients USING btree (status);
CREATE INDEX IF NOT EXISTS idx_clients_membership_end ON public.clients USING btree (membership_end);
CREATE INDEX IF NOT EXISTS idx_clients_admin_approved ON public.clients USING btree (admin_approved);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_id ON public.exercise_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_exercise_id ON public.exercise_logs USING btree (exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_performed_at ON public.exercise_logs USING btree (performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_workout_session_id ON public.exercise_logs USING btree (workout_session_id);
CREATE INDEX IF NOT EXISTS exercise_logs_session_exercise_idx ON public.exercise_logs USING btree (workout_session_id, exercise_id, set_number);
CREATE INDEX IF NOT EXISTS exercise_logs_session_created_idx ON public.exercise_logs USING btree (workout_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_routines_client ON public.client_routines USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_client_routines_routine_id ON public.client_routines USING btree (routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_week_progress_client_routine ON public.routine_week_progress USING btree (client_routine_id);
CREATE INDEX IF NOT EXISTS pr_events_client_exercise_achieved_idx ON public.pr_events USING btree (client_id, exercise_id, achieved_at DESC);
CREATE INDEX IF NOT EXISTS pr_events_session_idx ON public.pr_events USING btree (workout_session_id);
CREATE INDEX IF NOT EXISTS pr_events_client_achieved_idx ON public.pr_events USING btree (client_id, achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_body_measurements_client_id ON public.body_measurements USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX IF NOT EXISTS idx_profiles_level ON public.profiles USING btree (level);
CREATE INDEX IF NOT EXISTS idx_profiles_xp_points ON public.profiles USING btree (xp_points DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_xp ON public.profiles USING btree (onboarding_completed, xp_points DESC);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments USING btree (paid_at);
CREATE INDEX IF NOT EXISTS idx_progress_photos_client_id ON public.progress_photos USING btree (client_id);

-- 5. VIEWS
CREATE OR REPLACE VIEW public.leaderboard AS
 SELECT p.id,
    p.full_name,
    p.avatar_url,
    COALESCE(p.level, 1) AS level,
    COALESCE(p.xp_points, 0) AS xp_points,
    (count(DISTINCT ua.achievement_id))::integer AS achievements_count,
    rank() OVER (ORDER BY COALESCE(p.xp_points, 0) DESC) AS rank
   FROM (public.profiles p
     LEFT JOIN public.user_achievements ua ON ((p.id = ua.user_id)))
  WHERE ((COALESCE(p.onboarding_completed, false) = true) AND (p.role = 'client'::text))
  GROUP BY p.id, p.full_name, p.avatar_url, p.level, p.xp_points;

-- 6. TRIGGERS
CREATE OR REPLACE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_routines_updated_at BEFORE UPDATE ON public.routines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_membership_plans_updated_at BEFORE UPDATE ON public.membership_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_status_trigger BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_client_status();
CREATE TRIGGER trigger_update_user_level BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_user_level();
CREATE TRIGGER tr_sync_client_status_to_profile AFTER UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.sync_client_status_to_profile();
CREATE TRIGGER tr_sync_profile_status_to_client AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profile_status_to_client();
CREATE TRIGGER tr_sync_payment_to_client_membership AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.sync_payment_to_client_membership();
CREATE TRIGGER workout_sessions_sync_client_last_session AFTER INSERT OR UPDATE ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION public.sync_client_last_session_from_workout();
CREATE TRIGGER profiles_avatar_sync_clients AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_client_avatar_from_profile();

-- 7. RLS POLICIES
ALTER TABLE public.gym_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage gym settings" ON public.gym_settings FOR ALL USING ((admin_id = (select auth.uid())) OR (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text)));
CREATE POLICY "Authenticated can read gym settings" ON public.gym_settings FOR SELECT USING ((select auth.uid()) IS NOT NULL);

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can update own PRs" ON public.personal_records FOR UPDATE USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = personal_records.client_id AND c.user_id = (select auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = personal_records.client_id AND c.user_id = (select auth.uid())));
CREATE POLICY "Clients can upsert own PRs" ON public.personal_records FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = personal_records.client_id AND c.user_id = (select auth.uid()) AND c.admin_approved = true AND c.status = 'active'::text));
CREATE POLICY "Clients can view own PRs" ON public.personal_records FOR SELECT USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = personal_records.client_id AND c.user_id = (select auth.uid())));
CREATE POLICY "Coaches can view their clients' PRs" ON public.personal_records FOR SELECT USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = personal_records.client_id AND c.coach_id = (select auth.uid())));

ALTER TABLE public.client_pain_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can manage own pain reports" ON public.client_pain_reports FOR ALL USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_pain_reports.client_id AND c.user_id = (select auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_pain_reports.client_id AND c.user_id = (select auth.uid())));
CREATE POLICY "Coaches can view their clients' pain reports" ON public.client_pain_reports FOR SELECT USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_pain_reports.client_id AND c.coach_id = (select auth.uid())));
CREATE POLICY "Coaches can update their clients' pain reports" ON public.client_pain_reports FOR UPDATE USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_pain_reports.client_id AND c.coach_id = (select auth.uid())));

ALTER TABLE public.client_exercise_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can manage own exercise overrides" ON public.client_exercise_overrides FOR ALL USING (EXISTS (SELECT 1 FROM public.client_routines cr JOIN public.clients c ON c.id = cr.client_id WHERE cr.id = client_exercise_overrides.client_routine_id AND c.user_id = (select auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.client_routines cr JOIN public.clients c ON c.id = cr.client_id WHERE cr.id = client_exercise_overrides.client_routine_id AND c.user_id = (select auth.uid())));
CREATE POLICY "Admins can manage exercise overrides" ON public.client_exercise_overrides FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text)) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own push subscriptions" ON public.push_subscriptions FOR ALL USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own messages" ON public.messages FOR SELECT USING ((from_user_id = (select auth.uid())) OR (to_user_id = (select auth.uid())));
CREATE POLICY "Users update own received" ON public.messages FOR UPDATE USING (to_user_id = (select auth.uid()));
CREATE POLICY "messages_insert_coach_client_pairs" ON public.messages FOR INSERT WITH CHECK ((from_user_id = (select auth.uid())) AND ((to_user_id IN (SELECT c.coach_id FROM public.clients c WHERE c.user_id = (select auth.uid()) AND c.coach_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM public.clients c WHERE c.coach_id = (select auth.uid()) AND c.user_id = messages.to_user_id)) OR (EXISTS (SELECT 1 FROM public.invitation_codes ic WHERE ic.used_by_user_id = (select auth.uid()) AND ic.created_by = messages.to_user_id)) OR ((EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = (select auth.uid()) AND c.coach_id IS NULL)) AND (to_user_id = (SELECT p.id FROM public.profiles p WHERE p.role = 'admin'::text ORDER BY p.created_at LIMIT 1)))));

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view exercises" ON public.exercises FOR SELECT USING (true);
CREATE POLICY "Only admins can delete exercises" ON public.exercises FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Only admins can insert exercises" ON public.exercises FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Only admins can update exercises" ON public.exercises FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view routines" ON public.routines FOR SELECT USING (true);
CREATE POLICY "Coaches can delete their own routines" ON public.routines FOR DELETE USING (coach_id = (select auth.uid()));
CREATE POLICY "Coaches can insert their own routines" ON public.routines FOR INSERT WITH CHECK (coach_id = (select auth.uid()));
CREATE POLICY "Coaches can update their own routines" ON public.routines FOR UPDATE USING (coach_id = (select auth.uid()));
CREATE POLICY "Coaches can view their own routines" ON public.routines FOR SELECT USING (coach_id = (select auth.uid()));
CREATE POLICY "Only admins can modify routines" ON public.routines FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own achievements" ON public.user_achievements FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can view own achievements" ON public.user_achievements FOR SELECT USING ((select auth.uid()) = user_id);

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view membership plans" ON public.membership_plans FOR SELECT USING (true);
CREATE POLICY "Only admins can insert membership plans" ON public.membership_plans FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Only admins can update membership plans" ON public.membership_plans FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));

ALTER TABLE public.routine_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view routine days" ON public.routine_days FOR SELECT USING (true);
CREATE POLICY "Only admins can modify routine days" ON public.routine_days FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));

ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view routine exercises" ON public.routine_exercises FOR SELECT USING (true);
CREATE POLICY "Client updates own routine suggested weights" ON public.routine_exercises FOR UPDATE USING (EXISTS (SELECT 1 FROM public.routine_days rd JOIN public.clients c ON c.user_id = (select auth.uid()) WHERE rd.id = routine_exercises.routine_day_id AND (c.assigned_routine_id = rd.routine_id OR EXISTS (SELECT 1 FROM public.client_routines cr WHERE cr.client_id = c.id AND cr.routine_id = rd.routine_id AND cr.is_active = true)))) WITH CHECK (EXISTS (SELECT 1 FROM public.routine_days rd JOIN public.clients c ON c.user_id = (select auth.uid()) WHERE rd.id = routine_exercises.routine_day_id AND (c.assigned_routine_id = rd.routine_id OR EXISTS (SELECT 1 FROM public.client_routines cr WHERE cr.client_id = c.id AND cr.routine_id = rd.routine_id AND cr.is_active = true))));
CREATE POLICY "Only admins can modify routine exercises" ON public.routine_exercises FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Client deletes own workout sessions" ON public.workout_sessions FOR DELETE USING (client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = (select auth.uid())));
CREATE POLICY "Client inserts own workout sessions" ON public.workout_sessions FOR INSERT WITH CHECK (client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = (select auth.uid())));
CREATE POLICY "Client selects own workout sessions" ON public.workout_sessions FOR SELECT USING (client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = (select auth.uid())));
CREATE POLICY "Client updates own workout sessions" ON public.workout_sessions FOR UPDATE USING (client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = (select auth.uid()))) WITH CHECK (client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = (select auth.uid())));
CREATE POLICY "Coaches can view their clients' workout sessions" ON public.workout_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = workout_sessions.client_id AND clients.coach_id = (select auth.uid())));

ALTER TABLE public.admin_setup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can delete admin_setup" ON public.admin_setup FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Admins can insert admin_setup" ON public.admin_setup FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Admins can read admin_setup" ON public.admin_setup FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Admins can update admin_setup" ON public.admin_setup FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));

ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can create and view codes" ON public.invitation_codes FOR ALL USING ((select auth.uid()) IN (SELECT profiles.id FROM public.profiles WHERE profiles.role = 'admin'::text));
CREATE POLICY "Coaches can insert their own invitations" ON public.invitation_codes FOR INSERT WITH CHECK (created_by = (select auth.uid()));
CREATE POLICY "Coaches can view their own invitations" ON public.invitation_codes FOR SELECT USING (created_by = (select auth.uid()));

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view achievements" ON public.achievements FOR SELECT USING (true);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can view own record" ON public.clients FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Clients can update own record" ON public.clients FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Coaches can delete their own clients" ON public.clients FOR DELETE USING (coach_id = (select auth.uid()));
CREATE POLICY "Coaches can insert their own clients" ON public.clients FOR INSERT WITH CHECK (coach_id = (select auth.uid()));
CREATE POLICY "Coaches can update their own clients" ON public.clients FOR UPDATE USING (coach_id = (select auth.uid()));
CREATE POLICY "Coaches can view their own clients" ON public.clients FOR SELECT USING ((coach_id = (select auth.uid())) OR (user_id = (select auth.uid())));

ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Client manages own logs" ON public.exercise_logs FOR ALL USING (workout_session_id IN (SELECT ws.id FROM public.workout_sessions ws JOIN public.clients c ON c.id = ws.client_id WHERE c.user_id = (select auth.uid()))) WITH CHECK (workout_session_id IN (SELECT ws.id FROM public.workout_sessions ws JOIN public.clients c ON c.id = ws.client_id WHERE c.user_id = (select auth.uid())));
CREATE POLICY "Coaches can view their clients' exercise logs" ON public.exercise_logs FOR SELECT USING (EXISTS (SELECT 1 FROM public.workout_sessions ws JOIN public.clients c ON c.id = ws.client_id WHERE ws.id = exercise_logs.workout_session_id AND c.coach_id = (select auth.uid())));
CREATE POLICY "Users can delete own exercise logs" ON public.exercise_logs FOR DELETE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own exercise logs" ON public.exercise_logs FOR INSERT WITH CHECK (((select auth.uid()) = user_id) AND public.has_active_subscription((select auth.uid())));
CREATE POLICY "Users can update own exercise logs" ON public.exercise_logs FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can view own exercise logs" ON public.exercise_logs FOR SELECT USING ((select auth.uid()) = user_id);

ALTER TABLE public.client_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages client_routines" ON public.client_routines FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Client views own routines" ON public.client_routines FOR SELECT USING (client_id IN (SELECT clients.id FROM public.clients WHERE clients.user_id = (select auth.uid())));
CREATE POLICY "Client updates own routines" ON public.client_routines FOR UPDATE USING (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = client_routines.client_id AND clients.user_id = (select auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = client_routines.client_id AND clients.user_id = (select auth.uid())));

ALTER TABLE public.routine_week_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages routine_week_progress" ON public.routine_week_progress FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Client views own routine_week_progress" ON public.routine_week_progress FOR SELECT USING (client_routine_id IN (SELECT cr.id FROM public.client_routines cr JOIN public.clients c ON c.id = cr.client_id WHERE c.user_id = (select auth.uid())));

ALTER TABLE public.pr_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can insert own PR events" ON public.pr_events FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = pr_events.client_id AND c.user_id = (select auth.uid()) AND c.admin_approved = true AND c.status = 'active'::text));
CREATE POLICY "Clients can view own PR events" ON public.pr_events FOR SELECT USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = pr_events.client_id AND c.user_id = (select auth.uid())));
CREATE POLICY "Coaches can view their clients' PR events" ON public.pr_events FOR SELECT USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = pr_events.client_id AND c.coach_id = (select auth.uid())));

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all body measurements" ON public.body_measurements FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Clients can create own body measurements" ON public.body_measurements FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = body_measurements.client_id AND clients.user_id = (select auth.uid())));
CREATE POLICY "Clients can view own body measurements" ON public.body_measurements FOR SELECT USING (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = body_measurements.client_id AND clients.user_id = (select auth.uid())));
CREATE POLICY "Coaches can view their clients' body measurements" ON public.body_measurements FOR SELECT USING (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = body_measurements.client_id AND clients.coach_id = (select auth.uid())));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((select auth.uid()) = id);
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = (select auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK ((select auth.uid()) = id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all payments" ON public.payments FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Clients can view own payments" ON public.payments FOR SELECT USING (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = payments.client_id AND clients.user_id = (select auth.uid())));
CREATE POLICY "Only admins can insert payments" ON public.payments FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Only admins can update payments" ON public.payments FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Only admins can delete payments" ON public.payments FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage all photos" ON public.progress_photos FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = ANY (ARRAY['admin'::text, 'receptionist'::text])));
CREATE POLICY "Client can manage own photos" ON public.progress_photos FOR ALL USING (client_id IN (SELECT clients.id FROM public.clients WHERE clients.user_id = (select auth.uid())));
CREATE POLICY "Coaches can view their clients' progress photos" ON public.progress_photos FOR SELECT USING (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = progress_photos.client_id AND clients.coach_id = (select auth.uid())));


-- 8. STORAGE BUCKETS & POLICIES
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('progress-photos', 'progress-photos', false),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- POLICIES FOR progress-photos
CREATE POLICY "Admin manage progress photos storage" ON storage.objects
FOR ALL TO authenticated USING (
  bucket_id = 'progress-photos' AND 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = ANY (ARRAY['admin', 'receptionist'])))
);

CREATE POLICY "Clients upload own progress photos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'progress-photos' AND 
  (storage.foldername(name))[1] = 'clients' AND 
  (storage.foldername(name))[2] IN (SELECT id::text FROM clients WHERE user_id = (select auth.uid()))
);

CREATE POLICY "Clients delete own progress photos" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'progress-photos' AND 
  (storage.foldername(name))[1] = 'clients' AND 
  (storage.foldername(name))[2] IN (SELECT id::text FROM clients WHERE user_id = (select auth.uid()))
);

-- POLICIES FOR avatars
CREATE POLICY "Public avatar read" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own profile avatar" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = (select auth.uid())::text AND 
  cardinality(storage.foldername(name)) = 1 AND 
  storage.filename(name) ~ '^profile\.(jpe?g|png|webp)$'
);

CREATE POLICY "Users update own profile avatar" ON storage.objects
FOR UPDATE TO authenticated USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = (select auth.uid())::text AND 
  cardinality(storage.foldername(name)) = 1 AND 
  storage.filename(name) ~ '^profile\.(jpe?g|png|webp)$'
) WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = (select auth.uid())::text AND 
  cardinality(storage.foldername(name)) = 1 AND 
  storage.filename(name) ~ '^profile\.(jpe?g|png|webp)$'
);

CREATE POLICY "Users delete own profile avatar" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = (select auth.uid())::text AND 
  cardinality(storage.foldername(name)) = 1 AND 
  storage.filename(name) ~ '^profile\.(jpe?g|png|webp)$'
);

-- 9. REALTIME PUBLICATIONS
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- DATOS DE EJERCICIOS (1,324 ejercicios bilingües EN/ES)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Los datos de ejercicios ya NO están incrustados en este archivo.
-- Se cargan mediante el script de migración:
--
--   1. Agrega al .env:
--      TARGET_SUPABASE_URL=https://<nuevo>.supabase.co
--      TARGET_SERVICE_ROLE_KEY=<service_role_key_nuevo>
--
--   2. Ejecuta:
--      npx tsx scripts/migrate-exercises.ts
--
-- El script lee tu .env automáticamente, descarga los 1,324 ejercicios
-- con TODAS las columnas (incluyendo name_es, equipment_es, body_parts_es,
-- target_muscles_es, secondary_muscles_es, instructions_es) y los
-- inserta con UPSERT en el proyecto destino.
--
-- Ver docs/DATABASE_GUIDE.md para instrucciones completas.
-- ═══════════════════════════════════════════════════════════════════════════

