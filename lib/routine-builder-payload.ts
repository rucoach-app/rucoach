import { normalizeRoutineLevel } from "@/lib/constants";

export interface BuilderRoutineExerciseInput {
  exercise_id: string;
  order_index: number;
  sets: number;
  reps: string;
  rest_seconds: number;
  superset_group: string | null;
  notes?: string | null;
  warmup_sets?: string | null;
}

export interface BuilderRoutineDayInput {
  day_number: number;
  day_name: string;
  focus?: string | null;
  notes?: string | null;
  is_rest_day: boolean;
  exercises: BuilderRoutineExerciseInput[];
}

export interface BuilderRoutinePayload {
  name: string;
  description: string | null;
  duration_weeks: number | null;
  goal?: string | null;
  level?: string | null;
  days: BuilderRoutineDayInput[];
}

export interface NormalizedBuilderRoutinePayload {
  name: string;
  description: string | null;
  duration_weeks: number | null;
  goal: string | null;
  level: string | null;
  days_per_week: number;
  days: {
    day_number: number;
    day_name: string;
    focus: string | null;
    notes: string | null;
    is_rest_day: boolean;
    exercises: {
      exercise_id: string;
      order_index: number;
      sets: number;
      reps: string;
      rest_seconds: number;
      superset_group: string | null;
      notes: string | null;
      warmup_sets: string | null;
    }[];
  }[];
}

export interface SaveRoutineResult {
  success: boolean;
  routineId?: string;
  error?: string;
}

export function computeTrainingDaysCount(
  days: readonly Pick<BuilderRoutineDayInput, "is_rest_day" | "exercises">[],
): number {
  const withExercises = days.filter(
    (d) => !d.is_rest_day && d.exercises.length > 0,
  ).length;
  if (withExercises > 0) return withExercises;
  const nonRest = days.filter((d) => !d.is_rest_day).length;
  return nonRest > 0 ? nonRest : 1;
}

export function validateBuilderPayload(
  data: BuilderRoutinePayload,
  options?: { allowEmptyExercises?: boolean },
): string | null {
  if (!data || !data.name?.trim()) {
    return "Escribe un nombre para la rutina.";
  }

  if (!Array.isArray(data.days) || data.days.length === 0) {
    return "La rutina debe incluir al menos un día configurado.";
  }

  const seenDayNumbers = new Set<number>();
  for (const day of data.days) {
    if (!Number.isInteger(day.day_number) || day.day_number < 1) {
      return "Uno de los días tiene un número de día inválido.";
    }
    if (seenDayNumbers.has(day.day_number)) {
      return "Hay días duplicados en la configuración de la rutina.";
    }
    seenDayNumbers.add(day.day_number);
  }

  const activeDaysWithExercises = data.days.filter(
    (d) => !d.is_rest_day && Array.isArray(d.exercises) && d.exercises.length > 0,
  );

  if (!options?.allowEmptyExercises && activeDaysWithExercises.length === 0) {
    return "Agrega al menos un ejercicio en un día de entrenamiento.";
  }

  for (const day of activeDaysWithExercises) {
    for (const ex of day.exercises) {
      if (!ex.exercise_id?.trim()) {
        return `Falta seleccionar un ejercicio válido en ${day.day_name || `Día ${day.day_number}`}.`;
      }
      if (!String(ex.reps ?? "").trim()) {
        return "Completa el objetivo o repeticiones de cada ejercicio antes de guardar.";
      }
    }
  }

  return null;
}

function parseSetsValue(rawSets: unknown): number {
  const parsed = Number(rawSets);
  if (!Number.isFinite(parsed) || parsed === 0) return 3;
  return Math.max(1, Math.floor(parsed));
}

function parseRestSecondsValue(rawRest: unknown): number {
  if (
    rawRest === null ||
    rawRest === undefined ||
    (typeof rawRest === "string" && rawRest.trim() === "")
  ) {
    return 60;
  }
  const parsed = Number(rawRest);
  if (!Number.isFinite(parsed) || parsed < 0) return 60;
  return Math.floor(parsed);
}

export function normalizeBuilderPayload(
  data: BuilderRoutinePayload,
): NormalizedBuilderRoutinePayload {
  const normalizedDays = [...data.days]
    .sort((a, b) => a.day_number - b.day_number)
    .map((day) => {
      const isRest = Boolean(day.is_rest_day);
      const dayName = day.day_name?.trim() || `Día ${day.day_number}`;
      const rawExercises = !isRest && Array.isArray(day.exercises) ? day.exercises : [];

      return {
        day_number: day.day_number,
        day_name: dayName,
        focus: day.focus?.trim() || null,
        notes: day.notes?.trim() || null,
        is_rest_day: isRest,
        exercises: rawExercises.map((ex, i) => ({
          exercise_id: ex.exercise_id.trim(),
          order_index:
            typeof ex.order_index === "number" && Number.isFinite(ex.order_index)
              ? Math.max(0, Math.floor(ex.order_index))
              : i,
          sets: parseSetsValue(ex.sets),
          reps: String(ex.reps || "10-12").trim() || "10-12",
          rest_seconds: parseRestSecondsValue(ex.rest_seconds),
          superset_group: ex.superset_group?.trim() || null,
          notes: ex.notes?.trim() || null,
          warmup_sets: ex.warmup_sets?.trim() || null,
        })),
      };
    });

  const durationRaw = data.duration_weeks;
  const normalizedDuration =
    durationRaw !== null &&
    durationRaw !== undefined &&
    Number.isFinite(Number(durationRaw)) &&
    Number(durationRaw) > 0
      ? Math.max(1, Math.floor(Number(durationRaw)))
      : null;

  const trimmedLevel = data.level?.trim() || null;
  const normalizedLevel = normalizeRoutineLevel(trimmedLevel) || trimmedLevel;

  return {
    name: data.name.trim(),
    description: data.description?.trim() || null,
    duration_weeks: normalizedDuration,
    goal: data.goal?.trim() || null,
    level: normalizedLevel,
    days_per_week: computeTrainingDaysCount(normalizedDays),
    days: normalizedDays,
  };
}

export function extractAllExerciseIds(
  payload: Pick<NormalizedBuilderRoutinePayload, "days">,
): string[] {
  const ids = new Set<string>();
  for (const day of payload.days) {
    if (day.is_rest_day) continue;
    for (const ex of day.exercises) {
      if (ex.exercise_id) ids.add(ex.exercise_id);
    }
  }
  return [...ids];
}

export function formatRoutineBuilderDbError(
  error: { code?: string; message?: string; details?: string } | null | undefined,
): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  const details = error?.details ?? "";
  const combined = `${message} ${details}`.toLowerCase();

  if (code === "23505" || combined.includes("duplicate key")) {
    if (combined.includes("routine_days_routine_id_day_number_key")) {
      return "Ya existe un día duplicado en esta rutina.";
    }
    if (combined.includes("routine_exercises_pkey")) {
      return "Conflicto de secuencia al guardar ejercicios en la rutina. Intenta guardar nuevamente.";
    }
    return "Registro duplicado al guardar la rutina. Intenta de nuevo.";
  }

  if (code === "23503" || combined.includes("foreign key")) {
    return "Uno de los ejercicios seleccionados ya no existe en el catálogo. Recarga la página e inténtalo de nuevo.";
  }

  if (code === "P0002") {
    return "La rutina especificada ya no existe.";
  }

  if (code === "22023" && message) {
    return message;
  }

  return message || "No pudimos guardar la rutina. Revisa los datos e inténtalo de nuevo.";
}
