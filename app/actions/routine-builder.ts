"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getUserProfile } from "@/lib/auth-utils";
import {
  extractAllExerciseIds,
  formatRoutineBuilderDbError,
  normalizeBuilderPayload,
  validateBuilderPayload,
  type BuilderRoutinePayload,
  type NormalizedBuilderRoutinePayload,
  type SaveRoutineResult,
} from "@/lib/routine-builder-payload";

export type { BuilderRoutinePayload, SaveRoutineResult };

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

export async function saveRoutineFromBuilder(
  data: BuilderRoutinePayload,
): Promise<SaveRoutineResult> {
  try {
    const user = await getAuthUser();
    const profile = await getUserProfile();

    if (!user || profile?.role !== "admin") {
      return { success: false, error: "No autorizado" };
    }

    const validationError = validateBuilderPayload(data);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const normalized = normalizeBuilderPayload(data);
    const supabase = createAdminClient();
    const exerciseIds = extractAllExerciseIds(normalized);

    if (exerciseIds.length > 0) {
      const { data: existingExercises, error: exCheckError } = await supabase
        .from("exercises")
        .select("id")
        .in("id", exerciseIds);

      if (exCheckError) {
        return {
          success: false,
          error: formatRoutineBuilderDbError(exCheckError),
        };
      }

      const foundIds = new Set((existingExercises ?? []).map((e) => e.id));
      const missingIds = exerciseIds.filter((id) => !foundIds.has(id));
      if (missingIds.length > 0) {
        return {
          success: false,
          error:
            "Uno o más ejercicios seleccionados ya no existen en el catálogo. Actualiza la página e inténtalo de nuevo.",
        };
      }
    }

    const routineId = crypto.randomUUID();
    const { data: rpcRoutineId, error: rpcError } = await supabase.rpc(
      "save_routine_from_builder",
      {
        p_routine_id: routineId,
        p_coach_id: user.id,
        p_payload: normalized,
      },
    );

    if (rpcError) {
      console.error("saveRoutineFromBuilder rpc error:", rpcError);
      return {
        success: false,
        error: formatRoutineBuilderDbError(rpcError),
      };
    }

    const savedId =
      typeof rpcRoutineId === "string" && rpcRoutineId.trim()
        ? rpcRoutineId.trim()
        : routineId;

    revalidatePath("/admin/routines");
    revalidatePath(`/admin/routines/${savedId}`);
    revalidatePath("/admin/dashboard");

    return { success: true, routineId: savedId };
  } catch (err) {
    console.error("Unexpected saveRoutineFromBuilder error:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al guardar la rutina.",
    };
  }
}

interface SnapshotExerciseRow {
  id: number;
  routine_day_id: string;
  exercise_id: string;
  order_index: number;
  sets: number;
  reps: string | null;
  duration_seconds: number | null;
  suggested_weight: number | null;
  rest_seconds: number;
  notes: string | null;
  superset_group: string | null;
  warmup_sets: string | null;
  progression_policy: string | null;
  reps_min: number | null;
  reps_max: number | null;
  intensifier: unknown;
}

interface SavedOverrideItem {
  client_routine_id: string;
  exercise_id: string;
  replacement_exercise_id: string;
  reason: string | null;
  changed_by: string;
  notified_coach: boolean;
}

async function restoreOverridesForDay(
  supabase: ReturnType<typeof createAdminClient>,
  savedOverrides: SavedOverrideItem[],
  insertedExercises: { id: number; exercise_id: string }[],
) {
  if (savedOverrides.length === 0 || insertedExercises.length === 0) return;

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
    await supabase.from("client_exercise_overrides").upsert(overridesToRestore, {
      onConflict: "client_routine_id,original_routine_exercise_id",
    });
  }
}

interface ExistingDaySnapshot {
  id: string;
  day_number: number;
  day_name: string;
  focus: string | null;
  is_rest_day: boolean | null;
}

interface TouchedDayRecord {
  dayId: string;
  isNewDay: boolean;
  oldDay?: ExistingDaySnapshot;
  snapshotExercises: SnapshotExerciseRow[];
  savedOverrides: SavedOverrideItem[];
}

async function updateRoutineWithCompensation(
  supabase: ReturnType<typeof createAdminClient>,
  routineId: string,
  coachIdToSave: string,
  normalized: NormalizedBuilderRoutinePayload,
): Promise<SaveRoutineResult> {
  // Asegurar que routine_exercises_id_seq está sincronizado antes de insertar
  const { error: syncError } = await supabase.rpc(
    "sync_routine_exercises_sequence",
  );
  if (syncError) {
    console.error("sync_routine_exercises_sequence error:", syncError);
    return {
      success: false,
      error: formatRoutineBuilderDbError(syncError),
    };
  }

  // Snapshot completo previo (rutina, días, ejercicios y overrides) antes de mutar
  const { data: oldRoutine, error: oldRoutineErr } = await supabase
    .from("routines")
    .select(
      "coach_id, name, description, duration_weeks, goal, level, days_per_week",
    )
    .eq("id", routineId)
    .single();

  if (oldRoutineErr || !oldRoutine) {
    return {
      success: false,
      error: formatRoutineBuilderDbError(oldRoutineErr),
    };
  }

  const { data: existingDays, error: daysFetchError } = await supabase
    .from("routine_days")
    .select("id, day_number, day_name, focus, is_rest_day")
    .eq("routine_id", routineId);

  if (daysFetchError) {
    return {
      success: false,
      error: formatRoutineBuilderDbError(daysFetchError),
    };
  }

  const existingDayRows = (existingDays ?? []) as ExistingDaySnapshot[];
  const existingDayIds = existingDayRows.map((d) => d.id);

  let allOldExercises: SnapshotExerciseRow[] = [];
  if (existingDayIds.length > 0) {
    const { data: oldExercisesData, error: oldExErr } = await supabase
      .from("routine_exercises")
      .select(
        "id, routine_day_id, exercise_id, order_index, sets, reps, duration_seconds, suggested_weight, rest_seconds, notes, superset_group, warmup_sets, progression_policy, reps_min, reps_max, intensifier",
      )
      .in("routine_day_id", existingDayIds)
      .order("order_index", { ascending: true })
      .order("id", { ascending: true });

    if (oldExErr) {
      return {
        success: false,
        error: formatRoutineBuilderDbError(oldExErr),
      };
    }
    allOldExercises = (oldExercisesData ?? []) as SnapshotExerciseRow[];
  }

  const oldExByDayId = new Map<string, SnapshotExerciseRow[]>();
  const oldExIdToDayAndEx = new Map<
    number,
    { dayId: string; exerciseId: string }
  >();
  for (const ex of allOldExercises) {
    const list = oldExByDayId.get(ex.routine_day_id) ?? [];
    list.push(ex);
    oldExByDayId.set(ex.routine_day_id, list);
    oldExIdToDayAndEx.set(ex.id, {
      dayId: ex.routine_day_id,
      exerciseId: ex.exercise_id,
    });
  }

  const overridesByDayId = new Map<string, SavedOverrideItem[]>();
  const allOldExIds = allOldExercises.map((ex) => ex.id);
  if (allOldExIds.length > 0) {
    const { data: overridesData, error: overridesErr } = await supabase
      .from("client_exercise_overrides")
      .select(
        "client_routine_id, original_routine_exercise_id, replacement_exercise_id, reason, changed_by, notified_coach",
      )
      .in("original_routine_exercise_id", allOldExIds);

    if (overridesErr) {
      return {
        success: false,
        error: formatRoutineBuilderDbError(overridesErr),
      };
    }

    for (const ov of overridesData ?? []) {
      const ref = oldExIdToDayAndEx.get(ov.original_routine_exercise_id);
      if (!ref) continue;
      const list = overridesByDayId.get(ref.dayId) ?? [];
      list.push({
        client_routine_id: ov.client_routine_id,
        exercise_id: ref.exerciseId,
        replacement_exercise_id: ov.replacement_exercise_id,
        reason: ov.reason,
        changed_by: ov.changed_by,
        notified_coach: ov.notified_coach,
      });
      overridesByDayId.set(ref.dayId, list);
    }
  }

  const existingDayByNumber = new Map<number, ExistingDaySnapshot>();
  for (const ed of existingDayRows) {
    existingDayByNumber.set(ed.day_number, ed);
  }

  const touchedDays: TouchedDayRecord[] = [];
  let routineHeaderMutated = false;

  const rollbackWholeRoutine = async () => {
    try {
      await supabase.rpc("sync_routine_exercises_sequence");
      for (const touched of touchedDays) {
        if (touched.isNewDay) {
          await supabase.from("routine_days").delete().eq("id", touched.dayId);
          continue;
        }
        await supabase
          .from("routine_exercises")
          .delete()
          .eq("routine_day_id", touched.dayId);

        if (touched.oldDay) {
          await supabase
            .from("routine_days")
            .update({
              day_name: touched.oldDay.day_name,
              focus: touched.oldDay.focus,
              is_rest_day: touched.oldDay.is_rest_day,
            })
            .eq("id", touched.dayId);
        }

        if (touched.snapshotExercises.length > 0) {
          const rollbackRows = touched.snapshotExercises.map(
            ({ id: _oldId, ...rest }) => rest,
          );
          const { data: restoredRows } = await supabase
            .from("routine_exercises")
            .insert(rollbackRows)
            .select("id, exercise_id");

          if (restoredRows?.length && touched.savedOverrides.length > 0) {
            await restoreOverridesForDay(
              supabase,
              touched.savedOverrides,
              restoredRows as { id: number; exercise_id: string }[],
            );
          }
        }
      }

      if (routineHeaderMutated) {
        await supabase.from("routines").update(oldRoutine).eq("id", routineId);
      }
    } catch (rollbackErr) {
      console.error("updateRoutineWithCompensation rollback error:", rollbackErr);
    }
  };

  const { error: routineError } = await supabase
    .from("routines")
    .update({
      coach_id: coachIdToSave,
      name: normalized.name,
      description: normalized.description,
      duration_weeks: normalized.duration_weeks,
      goal: normalized.goal,
      level: normalized.level,
      days_per_week: normalized.days_per_week,
      updated_at: new Date().toISOString(),
    })
    .eq("id", routineId);

  if (routineError) {
    return {
      success: false,
      error: formatRoutineBuilderDbError(routineError),
    };
  }
  routineHeaderMutated = true;

  for (const day of normalized.days) {
    const existingDay = existingDayByNumber.get(day.day_number);
    const dayId = existingDay?.id ?? crypto.randomUUID();
    const snapshotExercises = existingDay
      ? (oldExByDayId.get(existingDay.id) ?? [])
      : [];
    const savedOverrides = existingDay
      ? (overridesByDayId.get(existingDay.id) ?? [])
      : [];

    if (existingDay) {
      const { error: updateDayError } = await supabase
        .from("routine_days")
        .update({
          day_name: day.day_name,
          focus: day.focus,
          is_rest_day: day.is_rest_day,
        })
        .eq("id", existingDay.id);

      if (updateDayError) {
        await rollbackWholeRoutine();
        return {
          success: false,
          error: formatRoutineBuilderDbError(updateDayError),
        };
      }

      touchedDays.push({
        dayId,
        isNewDay: false,
        oldDay: existingDay,
        snapshotExercises,
        savedOverrides,
      });

      const { error: delExError } = await supabase
        .from("routine_exercises")
        .delete()
        .eq("routine_day_id", existingDay.id);

      if (delExError) {
        await rollbackWholeRoutine();
        return {
          success: false,
          error: formatRoutineBuilderDbError(delExError),
        };
      }
    } else {
      const { error: insertDayError } = await supabase
        .from("routine_days")
        .insert({
          id: dayId,
          routine_id: routineId,
          day_number: day.day_number,
          day_name: day.day_name,
          focus: day.focus,
          is_rest_day: day.is_rest_day,
        });

      if (insertDayError) {
        await rollbackWholeRoutine();
        return {
          success: false,
          error: formatRoutineBuilderDbError(insertDayError),
        };
      }

      touchedDays.push({
        dayId,
        isNewDay: true,
        snapshotExercises: [],
        savedOverrides: [],
      });
    }

    const savedWeightByExerciseOcc = new Map<string, number>();
    const occCounter = new Map<string, number>();
    for (const oe of snapshotExercises) {
      const nextOcc = (occCounter.get(oe.exercise_id) ?? 0) + 1;
      occCounter.set(oe.exercise_id, nextOcc);
      if (oe.suggested_weight !== null && oe.suggested_weight !== undefined) {
        savedWeightByExerciseOcc.set(
          `${oe.exercise_id}::${nextOcc}`,
          oe.suggested_weight,
        );
      }
    }

    if (!day.is_rest_day && day.exercises.length > 0) {
      const incomingOccCounter = new Map<string, number>();
      const exercisesPayload = day.exercises.map((ex) => {
        const nextOcc = (incomingOccCounter.get(ex.exercise_id) ?? 0) + 1;
        incomingOccCounter.set(ex.exercise_id, nextOcc);
        const preservedWeight = savedWeightByExerciseOcc.get(
          `${ex.exercise_id}::${nextOcc}`,
        );
        return {
          routine_day_id: dayId,
          exercise_id: ex.exercise_id,
          order_index: ex.order_index,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.rest_seconds,
          superset_group: ex.superset_group,
          notes: ex.notes,
          warmup_sets: ex.warmup_sets,
          ...(preservedWeight !== undefined
            ? { suggested_weight: preservedWeight }
            : {}),
        };
      });

      const { data: insertedExercises, error: reError } = await supabase
        .from("routine_exercises")
        .insert(exercisesPayload)
        .select("id, exercise_id");

      if (reError) {
        await rollbackWholeRoutine();
        return {
          success: false,
          error: formatRoutineBuilderDbError(reError),
        };
      }

      if (savedOverrides.length > 0 && insertedExercises?.length) {
        await restoreOverridesForDay(
          supabase,
          savedOverrides,
          insertedExercises as { id: number; exercise_id: string }[],
        );
      }
    }
  }

  const incomingDayNumbers = new Set(normalized.days.map((d) => d.day_number));
  const removedDayIds = existingDayRows
    .filter((ed) => !incomingDayNumbers.has(ed.day_number))
    .map((ed) => ed.id);

  if (removedDayIds.length > 0) {
    const { error: delDaysError } = await supabase
      .from("routine_days")
      .delete()
      .in("id", removedDayIds);
    if (delDaysError) {
      return {
        success: false,
        error: formatRoutineBuilderDbError(delDaysError),
      };
    }
  }

  return { success: true, routineId };
}

export async function updateRoutineFromBuilder(
  routineId: string,
  data: BuilderRoutinePayload,
): Promise<SaveRoutineResult> {
  try {
    const user = await getAuthUser();
    const profile = await getUserProfile();

    if (!user || profile?.role !== "admin") {
      return { success: false, error: "No autorizado" };
    }

    if (!routineId?.trim()) {
      return { success: false, error: "ID de rutina inválido." };
    }

    const validationError = validateBuilderPayload(data);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const supabase = createAdminClient();

    const { data: existing, error: fetchError } = await supabase
      .from("routines")
      .select("id, coach_id")
      .eq("id", routineId)
      .maybeSingle();

    if (fetchError) {
      return {
        success: false,
        error: formatRoutineBuilderDbError(fetchError),
      };
    }

    if (!existing) {
      return { success: false, error: "La rutina especificada no existe." };
    }

    if (existing.coach_id && existing.coach_id !== user.id) {
      return {
        success: false,
        error: "No tienes permiso para editar esta rutina.",
      };
    }

    const normalized = normalizeBuilderPayload(data);
    const exerciseIds = extractAllExerciseIds(normalized);

    if (exerciseIds.length > 0) {
      const { data: existingExercises, error: exCheckError } = await supabase
        .from("exercises")
        .select("id")
        .in("id", exerciseIds);

      if (exCheckError) {
        return {
          success: false,
          error: formatRoutineBuilderDbError(exCheckError),
        };
      }

      const foundIds = new Set((existingExercises ?? []).map((e) => e.id));
      const missingIds = exerciseIds.filter((id) => !foundIds.has(id));
      if (missingIds.length > 0) {
        return {
          success: false,
          error:
            "Uno o más ejercicios seleccionados ya no existen en el catálogo. Actualiza la página e inténtalo de nuevo.",
        };
      }
    }

    const coachIdToSave = existing.coach_id || user.id;

    // Usar RPC transaccional si ya está desplegado; en caso de PGRST202 usar ruta compensatoria segura
    const { error: rpcError } = await supabase.rpc(
      "update_routine_from_builder",
      {
        p_routine_id: routineId,
        p_coach_id: coachIdToSave,
        p_payload: normalized,
      },
    );

    if (rpcError) {
      const isMissingRpc =
        rpcError.code === "PGRST202" ||
        rpcError.message?.includes("Could not find the function");

      if (!isMissingRpc) {
        console.error("updateRoutineFromBuilder rpc error:", rpcError);
        return {
          success: false,
          error: formatRoutineBuilderDbError(rpcError),
        };
      }

      const fallbackResult = await updateRoutineWithCompensation(
        supabase,
        routineId,
        coachIdToSave,
        normalized,
      );
      if (!fallbackResult.success) {
        return fallbackResult;
      }
    }

    revalidatePath("/admin/routines");
    revalidatePath(`/admin/routines/${routineId}`);
    revalidatePath("/client/routines");
    revalidatePath("/client/dashboard");

    return { success: true, routineId };
  } catch (err) {
    console.error("Unexpected updateRoutineFromBuilder error:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al actualizar la rutina.",
    };
  }
}

export async function cloneRoutine(routineId: string): Promise<{
  success: boolean;
  routineId?: string;
  name?: string;
  error?: string;
}> {
  try {
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

    if (source.coach_id && source.coach_id !== user.id) {
      return {
        success: false,
        error: "No tienes permiso para duplicar esta rutina",
      };
    }

    const newRoutineId = crypto.randomUUID();
    const newName = `${source.name} (Copia)`;

    const sortedDays = [...(source.routine_days ?? [])].sort(
      (a, b) => a.day_number - b.day_number,
    );

    const builderPayload: BuilderRoutinePayload = {
      name: newName,
      description: source.description ?? null,
      duration_weeks: source.duration_weeks ?? null,
      goal: source.goal ?? null,
      level: source.level ?? null,
      days: sortedDays.map((day) => {
        const sortedExercises = [...(day.routine_exercises ?? [])].sort(
          (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
        );
        return {
          day_number: day.day_number,
          day_name: day.day_name,
          focus: day.focus ?? null,
          notes: day.notes ?? null,
          is_rest_day: day.is_rest_day ?? false,
          exercises: sortedExercises.map((ex, idx) => ({
            exercise_id: ex.exercise_id,
            order_index: ex.order_index ?? idx,
            sets: ex.sets ?? 3,
            reps: ex.reps ?? "10-12",
            rest_seconds: ex.rest_seconds ?? 60,
            superset_group: ex.superset_group ?? null,
            notes: ex.notes ?? null,
            warmup_sets:
              (ex as { warmup_sets?: string | null }).warmup_sets ?? null,
          })),
        };
      }),
    };

    const normalized = normalizeBuilderPayload(builderPayload);
    if (sortedDays.length === 0) {
      normalized.days_per_week = source.days_per_week || 1;
    }

    const { data: rpcRoutineId, error: rpcError } = await supabase.rpc(
      "save_routine_from_builder",
      {
        p_routine_id: newRoutineId,
        p_coach_id: user.id,
        p_payload: normalized,
      },
    );

    if (rpcError) {
      console.error("cloneRoutine rpc error:", rpcError);
      return { success: false, error: formatRoutineBuilderDbError(rpcError) };
    }

    const createdId =
      typeof rpcRoutineId === "string" && rpcRoutineId.trim()
        ? rpcRoutineId.trim()
        : newRoutineId;

    revalidatePath("/admin/routines");
    revalidatePath(`/admin/routines/${createdId}`);
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      routineId: createdId,
      name: newName,
    };
  } catch (err) {
    console.error("Unexpected cloneRoutine error:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al duplicar la rutina.",
    };
  }
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

  if (existing.coach_id && existing.coach_id !== user.id) {
    return {
      success: false,
      error: "No tienes permiso para eliminar esta rutina",
    };
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
