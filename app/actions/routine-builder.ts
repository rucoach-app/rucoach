"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getUserProfile } from "@/lib/auth-utils";
import { normalizeRoutineLevel } from "@/lib/constants";

export async function getRoutineMeta(routineId: string): Promise<{
  goal: string | null;
  level: string | null;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("routines")
    .select("goal, level")
    .eq("id", routineId)
    .maybeSingle();
  return data ? { goal: data.goal ?? null, level: data.level ?? null } : null;
}

export interface BuilderRoutinePayload {
  name: string;
  description: string | null;
  duration_weeks: number | null;
  goal?: string | null;
  level?: string | null;
  days: {
    day_number: number;
    day_name: string;
    focus?: string | null;
    is_rest_day: boolean;
    exercises: {
      exercise_id: string;
      order_index: number;
      sets: number;
      reps: string;
      rest_seconds: number;
      superset_group: string | null;
      notes?: string | null;
      warmup_sets?: string | null;
    }[];
  }[];
}

function computeTrainingDaysCount(days: BuilderRoutinePayload["days"]): number {
  const withExercises = days.filter(
    (d) => !d.is_rest_day && d.exercises.length > 0,
  ).length;
  if (withExercises > 0) return withExercises;
  const nonRest = days.filter((d) => !d.is_rest_day).length;
  return nonRest > 0 ? nonRest : 1;
}

export async function saveRoutineFromBuilder(
  data: BuilderRoutinePayload,
): Promise<string> {
  const user = await getAuthUser();
  const profile = await getUserProfile();

  if (!user || profile?.role !== "admin") {
    throw new Error("No autorizado");
  }

  const supabase = createAdminClient();
  const routineId = crypto.randomUUID();
  const normalizedLevel =
    normalizeRoutineLevel(data.level) || data.level || null;
  const trainingDaysCount = computeTrainingDaysCount(data.days);

  const { error: routineError } = await supabase.from("routines").insert({
    id: routineId,
    coach_id: user.id,
    name: data.name,
    description: data.description,
    duration_weeks: data.duration_weeks,
    goal: data.goal || null,
    level: normalizedLevel,
    days_per_week: trainingDaysCount,
  });

  if (routineError) throw new Error(routineError.message);

  for (const day of data.days) {
    const dayId = crypto.randomUUID();
    const { error: dayError } = await supabase.from("routine_days").insert({
      id: dayId,
      routine_id: routineId,
      day_number: day.day_number,
      day_name: day.day_name,
      focus: day.focus?.trim() || null,
      is_rest_day: day.is_rest_day,
    });

    if (dayError) throw new Error(dayError.message);

    if (!day.is_rest_day && day.exercises.length > 0) {
      const exercisesPayload = day.exercises.map((ex, i) => ({
        routine_day_id: dayId,
        exercise_id: ex.exercise_id,
        order_index: typeof ex.order_index === "number" ? ex.order_index : i,
        sets: Math.max(1, Math.floor(Number(ex.sets) || 3)),
        reps: String(ex.reps || "10-12").trim(),
        rest_seconds: Math.max(
          0,
          Math.floor(
            Number(ex.rest_seconds) >= 0 ? Number(ex.rest_seconds) : 60,
          ),
        ),
        superset_group: ex.superset_group ?? null,
        notes: ex.notes?.trim() || null,
        warmup_sets: ex.warmup_sets?.trim() || null,
      }));
      let { error: reError } = await supabase
        .from("routine_exercises")
        .insert(exercisesPayload);

      if (
        reError &&
        (reError.message?.includes("warmup_sets") ||
          reError.code === "PGRST204" ||
          reError.code === "42703")
      ) {
        const fallbackPayload = exercisesPayload.map(
          ({ warmup_sets: _w, ...rest }) => rest,
        );
        const retry = await supabase
          .from("routine_exercises")
          .insert(fallbackPayload);
        reError = retry.error;
      }

      if (reError) throw new Error(reError.message);
    }
  }

  revalidatePath("/admin/routines");
  revalidatePath("/admin/dashboard");
  return routineId;
}

export async function updateRoutineFromBuilder(
  routineId: string,
  data: BuilderRoutinePayload,
): Promise<void> {
  const user = await getAuthUser();
  const profile = await getUserProfile();

  if (!user || profile?.role !== "admin") {
    throw new Error("No autorizado");
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("routines")
    .select("id, coach_id")
    .eq("id", routineId)
    .single();

  if (!existing) {
    throw new Error("La rutina especificada no existe");
  }

  const coachIdToSave = existing.coach_id || user.id;

  const normalizedLevel =
    normalizeRoutineLevel(data.level) || data.level || null;
  const trainingDaysCount = computeTrainingDaysCount(data.days);

  const { error: routineError } = await supabase
    .from("routines")
    .update({
      coach_id: coachIdToSave,
      name: data.name,
      description: data.description,
      duration_weeks: data.duration_weeks,
      goal: data.goal || null,
      level: normalizedLevel,
      days_per_week: trainingDaysCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", routineId);

  if (routineError) throw new Error(routineError.message);

  // Obtener los routine_days existentes para preservar sus IDs (no romper workout_sessions.routine_day_id ni override_next_day_id)
  const { data: existingDays } = await supabase
    .from("routine_days")
    .select("id, day_number")
    .eq("routine_id", routineId);

  const existingDayByNumber = new Map<number, string>();
  for (const ed of existingDays ?? []) {
    existingDayByNumber.set(ed.day_number, ed.id);
  }

  const incomingDayNumbers = new Set(data.days.map((d) => d.day_number));
  const removedDayIds = (existingDays ?? [])
    .filter((ed) => !incomingDayNumbers.has(ed.day_number))
    .map((ed) => ed.id);

  if (removedDayIds.length > 0) {
    await supabase.from("routine_days").delete().in("id", removedDayIds);
  }

  for (const day of data.days) {
    const existingDayId = existingDayByNumber.get(day.day_number);
    const dayId = existingDayId ?? crypto.randomUUID();

    if (existingDayId) {
      const { error: updateDayError } = await supabase
        .from("routine_days")
        .update({
          day_name: day.day_name,
          focus: day.focus?.trim() || null,
          is_rest_day: day.is_rest_day,
        })
        .eq("id", existingDayId);
      if (updateDayError) throw new Error(updateDayError.message);
    } else {
      const { error: insertDayError } = await supabase
        .from("routine_days")
        .insert({
          id: dayId,
          routine_id: routineId,
          day_number: day.day_number,
          day_name: day.day_name,
          focus: day.focus?.trim() || null,
          is_rest_day: day.is_rest_day,
        });
      if (insertDayError) throw new Error(insertDayError.message);
    }

    // Preservar client_exercise_overrides si el cliente había intercambiado un ejercicio que sigue en este día
    let savedOverrides: {
      client_routine_id: string;
      exercise_id: string;
      replacement_exercise_id: string;
      reason: string | null;
      changed_by: string;
      notified_coach: boolean;
    }[] = [];

    if (existingDayId) {
      const { data: oldExercises } = await supabase
        .from("routine_exercises")
        .select("id, exercise_id")
        .eq("routine_day_id", existingDayId);

      const oldExIds = (oldExercises ?? []).map((oe) => oe.id);
      if (oldExIds.length > 0) {
        const oldExIdToExerciseId = new Map(
          (oldExercises ?? []).map((oe) => [oe.id, oe.exercise_id]),
        );
        const { data: overrides } = await supabase
          .from("client_exercise_overrides")
          .select(
            "client_routine_id, original_routine_exercise_id, replacement_exercise_id, reason, changed_by, notified_coach",
          )
          .in("original_routine_exercise_id", oldExIds);

        savedOverrides = (overrides ?? [])
          .map((ov) => {
            const origExId = oldExIdToExerciseId.get(
              ov.original_routine_exercise_id,
            );
            if (!origExId) return null;
            return {
              client_routine_id: ov.client_routine_id,
              exercise_id: origExId,
              replacement_exercise_id: ov.replacement_exercise_id,
              reason: ov.reason,
              changed_by: ov.changed_by,
              notified_coach: ov.notified_coach,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);
      }

      const { error: delExError } = await supabase
        .from("routine_exercises")
        .delete()
        .eq("routine_day_id", existingDayId);
      if (delExError) throw new Error(delExError.message);
    }

    if (!day.is_rest_day && day.exercises.length > 0) {
      const exercisesPayload = day.exercises.map((ex, i) => ({
        routine_day_id: dayId,
        exercise_id: ex.exercise_id,
        order_index: typeof ex.order_index === "number" ? ex.order_index : i,
        sets: Math.max(1, Math.floor(Number(ex.sets) || 3)),
        reps: String(ex.reps || "10-12").trim(),
        rest_seconds: Math.max(
          0,
          Math.floor(
            Number(ex.rest_seconds) >= 0 ? Number(ex.rest_seconds) : 60,
          ),
        ),
        superset_group: ex.superset_group ?? null,
        notes: ex.notes?.trim() || null,
        warmup_sets: ex.warmup_sets?.trim() || null,
      }));
      let { data: insertedExercises, error: reError } = await supabase
        .from("routine_exercises")
        .insert(exercisesPayload)
        .select("id, exercise_id");

      if (
        reError &&
        (reError.message?.includes("warmup_sets") ||
          reError.code === "PGRST204" ||
          reError.code === "42703")
      ) {
        const fallbackPayload = exercisesPayload.map(
          ({ warmup_sets: _w, ...rest }) => rest,
        );
        const retry = await supabase
          .from("routine_exercises")
          .insert(fallbackPayload)
          .select("id, exercise_id");
        insertedExercises = retry.data;
        reError = retry.error;
      }

      if (reError) throw new Error(reError.message);

      if (savedOverrides.length > 0 && insertedExercises?.length) {
        const newExIdByExerciseId = new Map<string, number>();
        for (const ie of insertedExercises) {
          if (!newExIdByExerciseId.has(ie.exercise_id)) {
            newExIdByExerciseId.set(ie.exercise_id, ie.id);
          }
        }
        const overridesToRestore = savedOverrides
          .map((ov) => {
            const newRoutineExId = newExIdByExerciseId.get(ov.exercise_id);
            if (!newRoutineExId) return null;
            return {
              client_routine_id: ov.client_routine_id,
              original_routine_exercise_id: newRoutineExId,
              replacement_exercise_id: ov.replacement_exercise_id,
              reason: ov.reason,
              changed_by: ov.changed_by,
              notified_coach: ov.notified_coach,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (overridesToRestore.length > 0) {
          await supabase
            .from("client_exercise_overrides")
            .upsert(overridesToRestore, {
              onConflict: "client_routine_id,original_routine_exercise_id",
            });
        }
      }
    }
  }

  revalidatePath("/admin/routines");
  revalidatePath(`/admin/routines/${routineId}`);
  revalidatePath("/client/routines");
  revalidatePath("/client/dashboard");
}

export async function cloneRoutine(routineId: string): Promise<{
  success: boolean;
  routineId?: string;
  name?: string;
  error?: string;
}> {
  const user = await getAuthUser();
  const profile = await getUserProfile();

  if (!user || profile?.role !== "admin") {
    return { success: false, error: "No autorizado" };
  }

  const supabase = createAdminClient();

  const { data: source, error: fetchError } = await supabase
    .from("routines")
    .select(
      `
      *,
      routine_days (
        day_number,
        day_name,
        focus,
        notes,
        is_rest_day,
        routine_exercises (
          *
        )
      )
    `,
    )
    .eq("id", routineId)
    .single();

  if (fetchError || !source) {
    return { success: false, error: "No se encontró la rutina a duplicar" };
  }

  const newRoutineId = crypto.randomUUID();
  const newName = `${source.name} (Copia)`;
  const normalizedLevel =
    normalizeRoutineLevel(source.level) || source.level || null;

  const sortedDays = [...(source.routine_days ?? [])].sort(
    (a, b) => a.day_number - b.day_number,
  );
  const trainingDaysCount =
    sortedDays.filter(
      (d) => !d.is_rest_day && (d.routine_exercises?.length ?? 0) > 0,
    ).length ||
    sortedDays.filter((d) => !d.is_rest_day).length ||
    source.days_per_week ||
    1;

  const { error: insertRoutineErr } = await supabase.from("routines").insert({
    id: newRoutineId,
    coach_id: user.id,
    name: newName,
    description: source.description,
    duration_weeks: source.duration_weeks,
    goal: source.goal,
    level: normalizedLevel,
    days_per_week: trainingDaysCount,
  });

  if (insertRoutineErr) {
    return { success: false, error: insertRoutineErr.message };
  }

  for (const day of sortedDays) {
    const newDayId = crypto.randomUUID();
    const { error: dayErr } = await supabase.from("routine_days").insert({
      id: newDayId,
      routine_id: newRoutineId,
      day_number: day.day_number,
      day_name: day.day_name,
      focus: day.focus ?? null,
      notes: day.notes ?? null,
      is_rest_day: day.is_rest_day ?? false,
    });

    if (dayErr) {
      return { success: false, error: dayErr.message };
    }

    const sortedExercises = [...(day.routine_exercises ?? [])].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
    );

    if (!day.is_rest_day && sortedExercises.length > 0) {
      const payload = sortedExercises.map((ex, idx) => ({
        routine_day_id: newDayId,
        exercise_id: ex.exercise_id,
        order_index: ex.order_index ?? idx,
        sets: ex.sets ?? 3,
        reps: ex.reps ?? "10-12",
        rest_seconds: ex.rest_seconds ?? 60,
        superset_group: ex.superset_group ?? null,
        notes: ex.notes ?? null,
        warmup_sets: (ex as { warmup_sets?: string | null }).warmup_sets ?? null,
      }));
      let { error: exErr } = await supabase
        .from("routine_exercises")
        .insert(payload);

      if (
        exErr &&
        (exErr.message?.includes("warmup_sets") ||
          exErr.code === "PGRST204" ||
          exErr.code === "42703")
      ) {
        const fallbackPayload = payload.map(
          ({ warmup_sets: _w, ...rest }) => rest,
        );
        const retry = await supabase
          .from("routine_exercises")
          .insert(fallbackPayload);
        exErr = retry.error;
      }

      if (exErr) {
        return { success: false, error: exErr.message };
      }
    }
  }

  revalidatePath("/admin/routines");
  revalidatePath("/admin/dashboard");

  return {
    success: true,
    routineId: newRoutineId,
    name: newName,
  };
}

export async function deleteRoutine(
  routineId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser();
  const profile = await getUserProfile();

  if (!user || profile?.role !== "admin") {
    return { success: false, error: "No autorizado" };
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("routines")
    .select("id, coach_id")
    .eq("id", routineId)
    .single();

  if (!existing) {
    return { success: false, error: "No se encontró la rutina para eliminar" };
  }

  const { error } = await supabase
    .from("routines")
    .delete()
    .eq("id", routineId);

  if (error) {
    if (error.code === "23503") {
      return {
        success: false,
        error:
          "No se puede eliminar: la rutina está asignada a clientes o tiene sesiones registradas.",
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/routines");
  revalidatePath("/admin/dashboard");
  return { success: true };
}

