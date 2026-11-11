import type { ExercisePoint, ExerciseOption } from '@/components/charts/exercise-progress-chart'
import { DEFAULT_TIMEZONE, formatDateKeyInTimezone } from '@/lib/calendar-date'

export type ExerciseLogProgressRow = {
  exercise_id: string
  exercise_name: string | null
  weight_kg: number | null
  reps: number | null
  is_warmup: boolean | null
  workout_session_id: string
  exercises?:
    | {
        name?: string | null
        name_es?: string | null
        exercise_type?: string | null
        uses_external_load?: boolean | null
        equipment?: string | null
      }
    | {
        name?: string | null
        name_es?: string | null
        exercise_type?: string | null
        uses_external_load?: boolean | null
        equipment?: string | null
      }[]
    | null
  workout_sessions:
    | { started_at: string }
    | { started_at: string }[]
    | null
}

function sessionStartedAt(row: ExerciseLogProgressRow): string | null {
  const ws = row.workout_sessions
  if (!ws) return null
  return Array.isArray(ws) ? ws[0]?.started_at ?? null : ws.started_at
}

/** Mejor carga por ejercicio en cada día calendario local (excl. calentamiento) para tendencia sin depender solo de pr_events. */
export function buildExerciseProgressFromLogs(
  logs: ExerciseLogProgressRow[] | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): {
  exercises: ExerciseOption[]
  pointsByExerciseId: Record<string, ExercisePoint[]>
  nameById: Map<string, string>
} {
  const bestPerDay = new Map<
    string,
    {
      achieved_at: string
      exercise_id: string
      exercise_name: string
      weight_kg: number
      reps: number | null
    }
  >()

  for (const row of logs ?? []) {
    if (row.is_warmup) continue
    const w = typeof row.weight_kg === 'number' ? row.weight_kg : Number(row.weight_kg)
    if (!Number.isFinite(w) || w <= 0) continue
    const startedAt = sessionStartedAt(row)
    if (!startedAt) continue
    const dayKey = formatDateKeyInTimezone(startedAt, timeZone)
    const key = `${dayKey}:${row.exercise_id}`
    const prev = bestPerDay.get(key)
    const exMeta = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises
    const resolvedName =
      exMeta?.name_es?.trim() ||
      exMeta?.name?.trim() ||
      row.exercise_name?.trim() ||
      'Ejercicio'
    if (
      !prev ||
      w > prev.weight_kg ||
      (w === prev.weight_kg && (row.reps ?? 0) > (prev.reps ?? 0))
    ) {
      bestPerDay.set(key, {
        achieved_at: startedAt,
        exercise_id: row.exercise_id,
        exercise_name: resolvedName,
        weight_kg: w,
        reps: row.reps ?? null,
      })
    }
  }

  const pointsByExerciseId: Record<string, ExercisePoint[]> = {}
  const nameById = new Map<string, string>()

  for (const v of bestPerDay.values()) {
    nameById.set(v.exercise_id, v.exercise_name)
    if (!pointsByExerciseId[v.exercise_id]) pointsByExerciseId[v.exercise_id] = []
    pointsByExerciseId[v.exercise_id].push({
      achieved_at: v.achieved_at,
      weight_kg: v.weight_kg,
      reps: v.reps,
    })
  }

  for (const id of Object.keys(pointsByExerciseId)) {
    pointsByExerciseId[id].sort(
      (a, b) => new Date(a.achieved_at).getTime() - new Date(b.achieved_at).getTime(),
    )
  }

  const exercises: ExerciseOption[] = [...nameById.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return { exercises, pointsByExerciseId, nameById }
}

type PrEventRow = {
  exercise_id: string | null
  achieved_at: string | null
  weight_kg: number | null
  reps: number | null
  exercises?: { name: string; name_es?: string | null } | { name: string; name_es?: string | null }[] | null
}

/** Añade hitos de pr_events que no estén ya cubiertos por el mismo día local (sesión vs historial PR). */
export function mergePrEventsIntoPoints(
  pointsByExerciseId: Record<string, ExercisePoint[]>,
  nameById: Map<string, string>,
  prRows: PrEventRow[] | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): Record<string, ExercisePoint[]> {
  const out: Record<string, ExercisePoint[]> = {}
  for (const [id, pts] of Object.entries(pointsByExerciseId)) {
    out[id] = [...pts]
  }

  for (const r of prRows ?? []) {
    const id = r.exercise_id
    if (!id || r.achieved_at == null || r.weight_kg == null) continue
    const w = Number(r.weight_kg)
    if (!Number.isFinite(w) || w <= 0) continue

    const ex = r.exercises
    const meta = Array.isArray(ex) ? ex[0] : ex
    if (meta) nameById.set(id, meta.name_es || meta.name)

    if (!out[id]) out[id] = []
    const dayKey = formatDateKeyInTimezone(r.achieved_at, timeZone)
    const existingIdx = out[id].findIndex(
      (x) => formatDateKeyInTimezone(x.achieved_at, timeZone) === dayKey,
    )
    if (existingIdx !== -1) {
      const existing = out[id][existingIdx]
      if (
        w > existing.weight_kg ||
        (w === existing.weight_kg && (r.reps ?? 0) > (existing.reps ?? 0))
      ) {
        out[id][existingIdx] = {
          achieved_at: r.achieved_at,
          weight_kg: w,
          reps: r.reps ?? null,
        }
      }
      continue
    }
    out[id].push({
      achieved_at: r.achieved_at,
      weight_kg: w,
      reps: r.reps ?? null,
    })
  }

  for (const id of Object.keys(out)) {
    out[id].sort((a, b) => new Date(a.achieved_at).getTime() - new Date(b.achieved_at).getTime())
  }

  return out
}

export function exerciseOptionsFromPoints(
  pointsByExerciseId: Record<string, ExercisePoint[]>,
  nameById: Map<string, string>,
): ExerciseOption[] {
  return Object.keys(pointsByExerciseId)
    .filter((id) => (pointsByExerciseId[id]?.length ?? 0) > 0)
    .map((id) => ({ id, name: nameById.get(id) || 'Ejercicio' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
