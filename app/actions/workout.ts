"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth-utils";
import { calculate1RM } from "@/lib/types";
import {
  isPRBeatingBaseline,
  prBaselineFromDbRow,
  suggestWeightForTargetReps,
} from "@/lib/progression";
import {
  awardXP,
  updateStreak,
  checkAchievements,
  XP_REWARDS,
} from "@/lib/gamification";
import { exerciseUsesExternalLoad } from "@/lib/exercise-tracking";
import { didCompleteMicrocycle } from "@/lib/next-routine-day";
import { notifyUser } from "@/lib/push";

interface SetData {
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number;
  isWarmup?: boolean;
  isPR?: boolean;
}

interface WorkoutCompletionData {
  clientId: string;
  routineDayId?: string;
  sets: SetData[];
  durationMinutes: number;
  startedAt?: string;
  rating?: number;
  notes?: string;
}

export async function startWorkoutSession(
  clientId: string,
  routineDayId?: string,
) {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) {
    return {
      success: false,
      error: "Sesión no válida. Inicia sesión de nuevo.",
    };
  }

  const { data: row } = await supabase
    .from("clients")
    .select("user_id")
    .eq("id", clientId)
    .maybeSingle();

  if (!row?.user_id || row.user_id !== user.id) {
    return { success: false, error: "No autorizado" };
  }

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      client_id: clientId,
      routine_day_id: routineDayId,
      status: "in_progress",
      started_at: new Date().toISOString(),
      exercises_completed: 0,
      exercises_skipped: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("Error starting workout:", error);
    return { success: false, error: error.message };
  }

  return { success: true, sessionId: data.id };
}

export async function completeWorkoutSession(data: WorkoutCompletionData) {
  const supabase = await createClient();

  const sessionUser = await getAuthUser();
  if (!sessionUser) {
    return {
      success: false,
      error: "Sesión no válida. Inicia sesión de nuevo.",
    };
  }

  // Get user ID and total_sessions from client
  const { data: client, error: clientFetchError } = await supabase
    .from("clients")
    .select("user_id, coach_id, full_name, total_sessions")
    .eq("id", data.clientId)
    .single();

  if (clientFetchError || !client?.user_id) {
    return { success: false, error: "Cliente no encontrado" };
  }

  if (client.user_id !== sessionUser.id) {
    return { success: false, error: "No autorizado" };
  }

  // Create workout session
  const totalVolume = data.sets.reduce(
    (sum, set) => sum + set.weight * set.reps,
    0,
  );
  const uniqueExercises = new Set(data.sets.map((s) => s.exerciseId)).size;

  const finishedAtIso = new Date().toISOString();
  const parsedStartedAtMs = data.startedAt ? new Date(data.startedAt).getTime() : Number.NaN;
  const startedAtIso =
    Number.isFinite(parsedStartedAtMs) && parsedStartedAtMs <= Date.now()
      ? new Date(parsedStartedAtMs).toISOString()
      : new Date(Date.now() - Math.max(0, data.durationMinutes) * 60000).toISOString();

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      client_id: data.clientId,
      routine_day_id: data.routineDayId,
      status: "completed",
      started_at: startedAtIso,
      finished_at: finishedAtIso,
      duration_minutes: data.durationMinutes,
      exercises_completed: uniqueExercises,
      exercises_skipped: 0,
      total_volume_kg: totalVolume,
      feeling_score: data.rating,
      feeling_note: data.notes,
    })
    .select()
    .single();

  if (sessionError) {
    console.error("Error creating session:", sessionError);
    return { success: false, error: sessionError.message };
  }

  const uniqueExerciseIds = [...new Set(data.sets.map((s) => s.exerciseId))];
  const { data: exerciseRows } =
    uniqueExerciseIds.length > 0
      ? await supabase
          .from("exercises")
          .select("id, name, name_es, exercise_type, uses_external_load, equipment")
          .in("id", uniqueExerciseIds)
      : {
          data: [] as {
            id: string;
            name: string;
            exercise_type: string;
            uses_external_load: boolean | null;
            equipment: string | null;
          }[],
        };
  const nameById = new Map((exerciseRows ?? []).map((e) => [e.id, (e as any).name_es || e.name]));
  const usesLoadByExerciseId = new Map(
    (exerciseRows ?? []).map((e) => [
      e.id,
      exerciseUsesExternalLoad(
        e.exercise_type,
        e.uses_external_load,
        e.equipment,
      ),
    ]),
  );

  const { data: currentPRRows } =
    uniqueExerciseIds.length > 0
      ? await supabase
          .from("personal_records")
          .select("exercise_id, weight_kg, reps, estimated_1rm")
          .eq("client_id", data.clientId)
          .in("exercise_id", uniqueExerciseIds)
      : {
          data: [] as {
            exercise_id: string;
            weight_kg: number | null;
            reps: number | null;
            estimated_1rm: number | null;
          }[],
        };
  const currentPrByExercise = new Map(
    (currentPRRows ?? []).map((r) => [r.exercise_id, r]),
  );

  const setsInPRorder = [...data.sets].sort((a, b) => {
    if (a.exerciseId !== b.exerciseId)
      return a.exerciseId.localeCompare(b.exerciseId);
    return a.setNumber - b.setNumber;
  });
  const runningPRBestByExercise = new Map<
    string,
    ReturnType<typeof prBaselineFromDbRow>
  >();
  for (const exId of uniqueExerciseIds) {
    runningPRBestByExercise.set(
      exId,
      prBaselineFromDbRow(currentPrByExercise.get(exId)),
    );
  }
  const isPRByExerciseSet = new Map<string, boolean>();
  for (const set of setsInPRorder) {
    const baseline = runningPRBestByExercise.get(set.exerciseId) ?? null;
    const trackLoad = usesLoadByExerciseId.get(set.exerciseId) ?? true;
    const beats =
      trackLoad && isPRBeatingBaseline(set.weight, set.reps, baseline);
    isPRByExerciseSet.set(`${set.exerciseId}:${set.setNumber}`, beats);
    if (beats) {
      runningPRBestByExercise.set(set.exerciseId, {
        weight: set.weight,
        reps: set.reps,
        estimated_1rm: calculate1RM(set.weight, set.reps),
      });
    }
  }

  // Log all sets (exercise_logs requiere user_id)
  const exerciseLogs = data.sets.map((set) => ({
    workout_session_id: session.id,
    user_id: client.user_id,
    exercise_id: set.exerciseId,
    exercise_name: nameById.get(set.exerciseId) ?? "",
    set_number: set.setNumber,
    weight_kg: set.weight,
    reps: set.reps,
    rpe: set.rpe,
    is_warmup: set.isWarmup || false,
    is_pr: isPRByExerciseSet.get(`${set.exerciseId}:${set.setNumber}`) ?? false,
  }));

  await supabase.from("exercise_logs").insert(exerciseLogs);

  const prSets = data.sets.filter(
    (s) => isPRByExerciseSet.get(`${s.exerciseId}:${s.setNumber}`) ?? false,
  );
  if (prSets.length > 0) {
    // Anclar todos los PR de la sesión a started_at de la sesión (no a finished_at)
    // y guardar solo el mejor PR por ejercicio en la sesión para evitar puntos duplicados el mismo día.
    const achievedAtIso = session.started_at ?? startedAtIso;
    const bestPrByExercise = new Map<
      string,
      {
        client_id: string;
        exercise_id: string;
        exercise_name: string;
        weight_kg: number;
        reps: number;
        estimated_1rm: number;
        achieved_at: string;
      }
    >();

    for (const prSet of prSets) {
      const estimated1RM = calculate1RM(prSet.weight, prSet.reps);
      const prev = bestPrByExercise.get(prSet.exerciseId);
      if (
        !prev ||
        estimated1RM > prev.estimated_1rm ||
        (estimated1RM === prev.estimated_1rm && prSet.weight >= prev.weight_kg)
      ) {
        bestPrByExercise.set(prSet.exerciseId, {
          client_id: data.clientId,
          exercise_id: prSet.exerciseId,
          exercise_name: nameById.get(prSet.exerciseId) ?? "",
          weight_kg: prSet.weight,
          reps: prSet.reps,
          estimated_1rm: estimated1RM,
          achieved_at: achievedAtIso,
        });
      }
    }

    const prEvents = Array.from(bestPrByExercise.values()).map((best) => ({
      client_id: best.client_id,
      exercise_id: best.exercise_id,
      workout_session_id: session.id,
      kind: "estimated_1rm" as const,
      weight_kg: best.weight_kg,
      reps: best.reps,
      estimated_1rm: best.estimated_1rm,
      achieved_at: best.achieved_at,
      meta: {
        source: "client_flag",
      },
    }));

    if (prEvents.length > 0) {
      await supabase.from("pr_events").insert(prEvents);
    }

    const prUpsertPayload = Array.from(bestPrByExercise.values());
    if (prUpsertPayload.length > 0) {
      const { error: prError } = await supabase
        .from("personal_records")
        .upsert(prUpsertPayload, {
          onConflict: "client_id,exercise_id",
        });

      if (prError) {
        console.error("Error upserting personal records:", prError);
      }
    }
  }

  // Sync denormalized session count from completed rows (avoids drift if increment fails under RLS)
  const { count: completedCount, error: completedCountError } = await supabase
    .from("workout_sessions")
    .select("*", { count: "exact", head: true })
    .eq("client_id", data.clientId)
    .eq("status", "completed");

  if (completedCountError) {
    console.error(
      "[completeWorkoutSession] completed session count",
      completedCountError,
    );
  }

  // --- PROGRESS WEEK LOGIC & CLEAR OVERRIDE ---
  try {
    await supabase
      .from("client_routines")
      .update({ override_next_day_id: null })
      .eq("client_id", data.clientId)
      .eq("is_active", true);
  } catch (err) {
    console.error("[completeWorkoutSession] clear override_next_day_id error", err);
  }

  if (data.routineDayId) {
    try {
      const { data: rd } = await supabase
        .from("routine_days")
        .select("routine_id")
        .eq("id", data.routineDayId)
        .single();
      if (rd?.routine_id) {
        const { data: activeRoutine } = await supabase
          .from("client_routines")
          .select("id, current_week")
          .eq("client_id", data.clientId)
          .eq("routine_id", rd.routine_id)
          .eq("is_active", true)
          .single();

        if (activeRoutine) {
          const { data: allDays } = await supabase
            .from("routine_days")
            .select("id, day_number, is_rest_day, routine_exercises(id)")
            .eq("routine_id", rd.routine_id);

          if (allDays && didCompleteMicrocycle(allDays, data.routineDayId)) {
            await supabase
              .from("client_routines")
              .update({ current_week: (activeRoutine.current_week ?? 1) + 1 })
              .eq("id", activeRoutine.id);
          }
        }
      }
    } catch (err) {
      console.error("[completeWorkoutSession] week progression error", err);
    }
  }
  // ---------------------------

  const lastSessionInstant =
    (session.finished_at as string | null) ??
    (session.started_at as string | null) ??
    new Date().toISOString();

  const adminClient = createAdminClient();
  const { error: clientUpdateError } = await adminClient
    .from("clients")
    .update({
      total_sessions: completedCount ?? (client.total_sessions ?? 0) + 1,
      last_session_at: lastSessionInstant,
    })
    .eq("id", data.clientId);

  if (clientUpdateError) {
    console.error("[completeWorkoutSession] clients update", clientUpdateError);
  }

  revalidatePath("/client/dashboard");
  revalidatePath("/client/calendar");
  revalidatePath("/client/progress");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${data.clientId}`);

  // Gamification: Award XP
  let totalXP = XP_REWARDS.COMPLETE_WORKOUT;
  if (prSets.length > 0) {
    totalXP += XP_REWARDS.NEW_PR * prSets.length;
  }

  const xpResult = await awardXP(client.user_id, totalXP);

  // Update streak
  const streakResult = await updateStreak(client.user_id);
  if (streakResult.streakDays > 1) {
    await awardXP(client.user_id, XP_REWARDS.STREAK_DAY);
  }

  // Check for new achievements
  const newAchievements = await checkAchievements(client.user_id);

  // Notify Coach via Web Push
  if (client.coach_id) {
    const clientName = client.full_name || "Tu asesorado";
    const prBadge =
      prSets.length > 0
        ? ` · 🏆 ${prSets.length} PR${prSets.length > 1 ? "s" : ""}`
        : "";
    const volText =
      totalVolume > 0
        ? `${Math.round(totalVolume).toLocaleString("es-MX")} kg`
        : `${uniqueExercises} ejercicios`;
    await notifyUser(client.coach_id, {
      title: `💪 Entreno completado · ${clientName}`,
      body: `Completó ${data.sets.length} series (${volText})${prBadge}.`,
      url: `/admin/clients/${data.clientId}`,
      tag: `workout-${data.clientId}`,
    });
  }

  return {
    success: true,
    sessionId: session.id,
    stats: {
      totalVolume,
      prsCount: prSets.length,
      xpEarned: totalXP,
      leveledUp: xpResult.leveledUp,
      newLevel: xpResult.newLevel,
      streakDays: streakResult.streakDays,
      newAchievements,
    },
  };
}

export async function getExerciseHistory(
  clientId: string,
  exerciseId: string,
  limit: number = 10,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("exercise_logs")
    .select(
      `
      *,
      workout_sessions!inner(client_id)
    `,
    )
    .eq("workout_sessions.client_id", clientId)
    .eq("exercise_id", exerciseId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching exercise history:", error);
    return [];
  }

  return data;
}

export async function getPersonalRecords(clientId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("personal_records")
    .select(
      `
      *,
      exercises(name, name_es, primary_muscle)
    `,
    )
    .eq("client_id", clientId)
    .order("achieved_at", { ascending: false });

  if (error) {
    console.error("Error fetching PRs:", error);
    return [];
  }

  return data;
}

export async function updateWorkoutSessionFeelingNote(
  sessionId: string,
  feelingNote: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false as const, error: "No autenticado" };
  }

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .select("client_id")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return { success: false as const, error: "Sesión no encontrada" };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("user_id")
    .eq("id", session.client_id)
    .single();

  if (!client || client.user_id !== user.id) {
    return { success: false as const, error: "No autorizado" };
  }

  const { error: updateError } = await supabase
    .from("workout_sessions")
    .update({ feeling_note: feelingNote.trim() || null })
    .eq("id", sessionId);

  if (updateError) {
    return { success: false as const, error: updateError.message };
  }

  return { success: true as const };
}

export async function getWorkoutSessionSummary(sessionId: string) {
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .select(
      `
      *,
      routine_days (
        day_name,
        routines ( name )
      )
    `,
    )
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return {
      success: false as const,
      error: sessionError?.message ?? "Sesión no encontrada",
    };
  }

  const { data: logs, error: logsError } = await supabase
    .from("exercise_logs")
    .select(
      "exercise_id, exercise_name, set_number, weight_kg, reps, rpe, is_warmup, is_pr, exercises(name, name_es, primary_muscle, secondary_muscles)",
    )
    .eq("workout_session_id", sessionId)
    .order("exercise_id", { ascending: true })
    .order("set_number", { ascending: true });

  if (logsError) {
    return { success: false as const, error: logsError.message };
  }

  const totalSets = (logs ?? []).length;
  const prsCount = (logs ?? []).filter((l) => l.is_pr).length;
  const totalVolume = (logs ?? []).reduce(
    (sum, l) => sum + Number(l.weight_kg ?? 0) * Number(l.reps ?? 0),
    0,
  );

  return {
    success: true as const,
    session,
    logs: logs ?? [],
    stats: {
      totalSets,
      prsCount,
      totalVolume,
    },
  };
}

export async function applyProgressionToRoutineDay(args: {
  clientId: string;
  routineDayId: string;
}) {
  const supabase = await createClient();

  const user = await getAuthUser();
  if (!user) {
    return {
      success: false as const,
      error: "Sesión no válida. Inicia sesión de nuevo.",
    };
  }

  const { data: clientRow, error: clientErr } = await supabase
    .from("clients")
    .select("id, user_id, assigned_routine_id")
    .eq("id", args.clientId)
    .single();

  if (clientErr || !clientRow?.user_id || clientRow.user_id !== user.id) {
    return { success: false as const, error: "No autorizado" };
  }

  const { data: dayRow, error: dayErr } = await supabase
    .from("routine_days")
    .select("routine_id")
    .eq("id", args.routineDayId)
    .single();

  if (dayErr || !dayRow?.routine_id) {
    return { success: false as const, error: "Día de rutina no válido" };
  }

  const routineId = dayRow.routine_id;
  const matchesAssigned = clientRow.assigned_routine_id === routineId;

  const { data: activeLink } = await supabase
    .from("client_routines")
    .select("id")
    .eq("client_id", args.clientId)
    .eq("routine_id", routineId)
    .eq("is_active", true)
    .maybeSingle();

  if (!matchesAssigned && !activeLink) {
    return {
      success: false as const,
      error: "Este día no pertenece a tu rutina asignada",
    };
  }

  const { data: painReports } = await supabase
    .from("client_pain_reports")
    .select("severity, reported_at")
    .eq("client_id", args.clientId)
    .eq("is_active", true)
    .order("reported_at", { ascending: false })
    .limit(3);

  const hasRelevantPain = (painReports ?? []).some(
    (r) => (r.severity ?? 0) >= 5,
  );

  const { data: routineExercises, error: reError } = await supabase
    .from("routine_exercises")
    .select("id, exercise_id, reps, suggested_weight")
    .eq("routine_day_id", args.routineDayId)
    .order("order_index", { ascending: true });

  if (reError) return { success: false as const, error: reError.message };

  const exerciseIds = [
    ...new Set((routineExercises ?? []).map((r) => r.exercise_id)),
  ];

  const { data: prs, error: prError } =
    exerciseIds.length > 0
      ? await supabase
          .from("personal_records")
          .select("exercise_id, estimated_1rm, weight_kg, reps")
          .eq("client_id", args.clientId)
          .in("exercise_id", exerciseIds)
      : { data: [], error: null };

  if (prError) return { success: false as const, error: prError.message };

  const prByExercise = new Map((prs ?? []).map((p) => [p.exercise_id, p]));

  for (const row of routineExercises ?? []) {
    const pr = prByExercise.get(row.exercise_id);
    const targetReps = parseInt((row.reps ?? "10").split("-")[0] ?? "10");

    const suggestion = suggestWeightForTargetReps({
      estimated1RM: pr?.estimated_1rm,
      lastWeight: pr?.weight_kg,
      lastReps: pr?.reps,
      targetReps,
      incrementKg: hasRelevantPain ? 0 : 2.5,
      defaultWeightKg: Number(row.suggested_weight ?? 20),
    });

    const { error: updateError } = await supabase
      .from("routine_exercises")
      .update({ suggested_weight: suggestion.weight })
      .eq("id", row.id);

    if (updateError)
      return { success: false as const, error: updateError.message };
  }

  return { success: true as const };
}
