import { getAuthUser, getCurrentClientRecord } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { Award, Dumbbell, Sparkles, TrendingUp, Trophy, Activity, CalendarDays } from "lucide-react";
import {
  MuscleBalanceCard,
  type RichWorkoutSession,
} from "@/components/anatomy/muscle-balance-card";
import { ActivityHeatmap } from "@/components/anatomy/activity-heatmap";
import { computeRoutineMuscleVolume } from "@/lib/anatomy/muscles";
import {
  VolumeChartLazy,
  ExerciseProgressChartLazy,
} from "@/components/charts/progress-charts-lazy";
import {
  CLIENT_DATA_PAGE_SHELL,
  ClientIncompleteProfileCard,
  ClientStackPageHeader,
} from "@/components/client/client-app-page-parts";
import {
  buildExerciseProgressFromLogs,
  exerciseOptionsFromPoints,
  mergePrEventsIntoPoints,
} from "@/lib/client-exercise-progress";
import { exerciseUsesExternalLoad } from "@/lib/exercise-tracking";
import {
  computeStrengthProgressInsight,
  computeVolumeInsightFromVolumes,
} from "@/lib/progress-insights";
import { toZonedWallClockDate } from "@/lib/calendar-date";

export default async function ClientProgressPage() {
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const [supabase, clientRecord] = await Promise.all([
    createClient(),
    getCurrentClientRecord(user.id),
  ]);

  if (!clientRecord) {
    return (
      <>
        <ClientStackPageHeader
          title="Progreso"
          subtitle="Completa tu perfil para ver volumen, PRs e insights."
        />
        <div className={CLIENT_DATA_PAGE_SHELL}>
          <ClientIncompleteProfileCard />
        </div>
      </>
    );
  }

  const clientId = clientRecord.id as string;

  const [
    { data: completedSessionsDesc },
    { data: prRowsDesc },
    { data: exerciseLogRows },
    { data: activeRoutineRows },
  ] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("started_at,total_volume_kg,duration_seconds,status")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(200),
    supabase
      .from("pr_events")
      .select(
        "achieved_at,weight_kg,reps,exercise_id,exercises(name,name_es,primary_muscle,exercise_type,uses_external_load,equipment)",
      )
      .eq("client_id", clientId)
      .order("achieved_at", { ascending: false })
      .limit(250),
    supabase
      .from("exercise_logs")
      .select(
        `exercise_id, exercise_name, weight_kg, reps, is_warmup, workout_session_id,
           exercises(name, name_es, exercise_type, uses_external_load, equipment, primary_muscle, secondary_muscles),
           workout_sessions!inner(started_at, client_id, status)`,
      )
      .eq("workout_sessions.client_id", clientId)
      .eq("workout_sessions.status", "completed")
      .order("workout_session_id", { ascending: false })
      .limit(1200),
    supabase
      .from("client_routines")
      .select(
        `id, is_active,
         routines (
           id,
           routine_days (
             id,
             routine_exercises (
               sets,
               exercises (
                 id, name, name_es, primary_muscle, secondary_muscles
               )
             )
           )
         )`,
      )
      .eq("client_id", clientId)
      .eq("is_active", true)
      .limit(1),
  ]);

  const completedSessions = [...(completedSessionsDesc ?? [])].reverse();
  const prRows = [...(prRowsDesc ?? [])].reverse();

  // Compute plannedWeeklyLoad from active routine if present
  const activeRoutineLink = activeRoutineRows?.[0] as any;
  const activeRoutine = activeRoutineLink?.routines
    ? Array.isArray(activeRoutineLink.routines)
      ? activeRoutineLink.routines[0]
      : activeRoutineLink.routines
    : activeRoutineLink;
  const plannedExercisesList: Array<{ exercise: any; sets: number }> = [];
  if (activeRoutine?.routine_days) {
    for (const d of activeRoutine.routine_days) {
      for (const re of d.routine_exercises || []) {
        const exObj = Array.isArray(re.exercises)
          ? re.exercises[0]
          : re.exercises;
        if (exObj) {
          plannedExercisesList.push({
            exercise: exObj,
            sets: Number(re.sets) || 3,
          });
        }
      }
    }
  }
  const plannedWeeklyLoad = computeRoutineMuscleVolume(plannedExercisesList);

  const loadAwarePrRows = prRows.filter((r) => {
    const ex =
      r.exercises && !Array.isArray(r.exercises)
        ? (r.exercises as {
            exercise_type?: string | null;
            uses_external_load?: boolean | null;
            equipment?: string | null;
          })
        : Array.isArray(r.exercises)
          ? r.exercises[0]
          : null;
    return exerciseUsesExternalLoad(
      ex?.exercise_type,
      ex?.uses_external_load,
      ex?.equipment,
    );
  });

  const loadAwareExerciseLogRows = ((exerciseLogRows as any[]) ?? []).filter((r: any) => {
    const ex =
      r.exercises && !Array.isArray(r.exercises)
        ? (r.exercises as {
            exercise_type?: string | null;
            uses_external_load?: boolean | null;
            equipment?: string | null;
          })
        : Array.isArray(r.exercises)
          ? r.exercises[0]
          : null;
    return exerciseUsesExternalLoad(
      ex?.exercise_type,
      ex?.uses_external_load,
      ex?.equipment,
    );
  });

  const fromLogs = buildExerciseProgressFromLogs(loadAwareExerciseLogRows);
  const nameById = new Map(fromLogs.nameById);
  const pointsByExerciseId = mergePrEventsIntoPoints(
    fromLogs.pointsByExerciseId,
    nameById,
    loadAwarePrRows,
  );
  const exercises = exerciseOptionsFromPoints(pointsByExerciseId, nameById);

  // Build RichWorkoutSession[] for MuscleBalanceCard (Balance, Fatigue, and Retained Strength)
  const sessionsMap = new Map<
    string,
    {
      timestamp: number;
      items: Map<
        string,
        {
          exercise: any;
          sets: number;
          bestWeightKg: number;
          bestReps: number;
          est1rm: number;
        }
      >;
    }
  >();

  for (const row of (exerciseLogRows as any[]) ?? []) {
    if (!row.workout_session_id) continue;
    if (row.is_warmup) continue;
    const sessionDate = (row.workout_sessions as any)?.started_at;
    const timestamp = sessionDate
      ? new Date(sessionDate).getTime()
      : Date.now();

    if (!sessionsMap.has(row.workout_session_id)) {
      sessionsMap.set(row.workout_session_id, {
        timestamp,
        items: new Map(),
      });
    }

    const sessionData = sessionsMap.get(row.workout_session_id)!;
    const exData = (
      Array.isArray(row.exercises) ? row.exercises[0] : row.exercises
    ) as any;
    if (!exData) continue;

    const wKg = Number(row.weight_kg) || 0;
    const reps = Number(row.reps) || 0;
    const e1rm =
      wKg > 0
        ? reps <= 1
          ? wKg
          : Math.round(wKg * (1 + Math.min(reps, 30) / 30) * 10) / 10
        : 0;

    const exKey = row.exercise_id || row.exercise_name;
    const currentItem = sessionData.items.get(exKey);
    if (currentItem) {
      currentItem.sets += 1;
      if (e1rm > currentItem.est1rm) {
        currentItem.est1rm = e1rm;
        currentItem.bestWeightKg = wKg;
        currentItem.bestReps = reps;
      }
    } else {
      sessionData.items.set(exKey, {
        exercise: {
          id: row.exercise_id,
          name: row.exercise_name || exData.name_es || exData.name,
          primary_muscle: exData.primary_muscle,
          secondary_muscles: exData.secondary_muscles,
          muscle_weights: exData.muscle_weights,
        },
        sets: 1,
        bestWeightKg: wKg,
        bestReps: reps,
        est1rm: e1rm,
      });
    }
  }

  const richWorkoutHistory: RichWorkoutSession[] = Array.from(
    sessionsMap.values(),
  ).map((s) => ({
    timestamp: s.timestamp,
    items: Array.from(s.items.values()),
  }));

  const currentExercisePrs = exercises
    .map((ex) => {
      const pts = pointsByExerciseId[ex.id] || [];
      if (pts.length === 0) return null;
      const sortedPts = [...pts].sort(
        (a, b) =>
          new Date(a.achieved_at).getTime() - new Date(b.achieved_at).getTime(),
      );
      const firstPoint = sortedPts[0];
      let bestPoint = sortedPts[0];

      for (const pt of sortedPts) {
        const ptTime = new Date(pt.achieved_at).getTime();
        const bestTime = new Date(bestPoint.achieved_at).getTime();
        if (
          pt.weight_kg > bestPoint.weight_kg ||
          (pt.weight_kg === bestPoint.weight_kg &&
            (pt.reps ?? 0) > (bestPoint.reps ?? 0)) ||
          (pt.weight_kg === bestPoint.weight_kg &&
            (pt.reps ?? 0) === (bestPoint.reps ?? 0) &&
            ptTime >= bestTime)
        ) {
          bestPoint = pt;
        }
      }

      const reps = bestPoint.reps ?? null;
      const est1rm =
        reps == null || reps <= 1
          ? bestPoint.weight_kg
          : Math.round(
              bestPoint.weight_kg * (1 + Math.min(reps, 30) / 30) * 10,
            ) / 10;

      const gainKg =
        sortedPts.length >= 2
          ? Math.round((bestPoint.weight_kg - firstPoint.weight_kg) * 10) / 10
          : 0;

      return {
        id: ex.id,
        name: ex.name,
        weightKg: bestPoint.weight_kg,
        reps,
        est1rm,
        achievedAt: bestPoint.achieved_at,
        dateLabel: format(toZonedWallClockDate(bestPoint.achieved_at), "dd MMM yyyy", {
          locale: es,
        }),
        sessionsCount: sortedPts.length,
        gainKg,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      const timeDiff =
        new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.weightKg - a.weightKg;
    });

  const now = new Date();

  const strengthEntries = exercises.map((ex) => ({
    name: ex.name,
    points: (pointsByExerciseId[ex.id] || []).map((p) => ({
      achieved_at:
        typeof p.achieved_at === "string"
          ? p.achieved_at
          : new Date(p.achieved_at).toISOString(),
      weight_kg: p.weight_kg,
    })),
  }));
  const strengthInsight = computeStrengthProgressInsight(strengthEntries, now);

  const volumeSeries = (completedSessions || [])
    .map((s) => {
      const raw = s.total_volume_kg;
      const n = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    })
    .filter((v): v is number => v != null);
  const volumeInsight = computeVolumeInsightFromVolumes(volumeSeries);

  const sessionCountForChart = (completedSessions || []).length;
  const exerciseTrackCount = exercises.length;
  const progressSubtitle =
    sessionCountForChart === 0 && exerciseTrackCount === 0
      ? "Sin datos aún · completa entrenos para ver volumen y curvas por ejercicio."
      : `${sessionCountForChart} ${sessionCountForChart === 1 ? "sesión" : "sesiones"} en volumen · ${exerciseTrackCount} ${exerciseTrackCount === 1 ? "ejercicio en seguimiento" : "ejercicios en seguimiento"}`;

  return (
    <>
      <ClientStackPageHeader title="Progreso" subtitle={progressSubtitle} />

      <div
        className={`${CLIENT_DATA_PAGE_SHELL} grid gap-6 lg:grid-cols-12 lg:items-start`}
      >
        <aside className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-4 lg:sticky lg:top-[calc(112px+1.5rem)] lg:self-start">
          <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl transition-all hover:shadow-lg">
            <CardHeader className="pb-5 pt-6 px-6">
              <div className="flex items-center gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 transition-transform active:scale-95">
                  <Sparkles className="size-5 text-primary" aria-hidden />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold tracking-tight">Análisis Inteligente</CardTitle>
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Insights pro</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-6 pb-6 pt-0">
              {strengthInsight.status === "ok" &&
                strengthInsight.recentMilestone && (
                  <div className="group relative overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-5 ring-1 ring-primary/10 transition-all hover:bg-primary/10">
                    <div className="absolute -right-2 -top-2 opacity-10 transition-transform group-hover:scale-110 group-hover:rotate-12">
                      <Award className="size-20 text-primary" />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1 bg-primary rounded-md shadow-sm">
                        <Award className="size-3.5 text-primary-foreground" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                        Nuevo Récord Personal
                      </p>
                    </div>
                    <p className="text-xl font-black leading-none tracking-tight text-foreground">
                      {strengthInsight.recentMilestone.name}
                    </p>
                    <p className="mt-3 text-3xl font-black tabular-nums tracking-tighter text-primary">
                      {strengthInsight.recentMilestone.weight_kg.toFixed(1)} <span className="text-lg font-bold">kg</span>
                    </p>
                    <p className="mt-4 text-xs font-medium text-muted-foreground leading-relaxed">
                      ¡Brutal! Superaste tu marca anterior. Tu técnica y consistencia están dando frutos.
                    </p>
                  </div>
                )}

              {strengthInsight.status === "ok" &&
              strengthInsight.deltaPct > 0 ? (
                <div className="group rounded-2xl border bg-muted/20 p-5 transition-all hover:bg-muted/30">
                  <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                      Progreso de Carga
                    </p>
                    <TrendingUp className="size-3.5 text-primary" />
                  </div>
                  <div className="flex justify-between items-end">
                    <p className="text-lg font-black leading-none text-foreground">
                      {strengthInsight.exerciseName}
                    </p>
                    <p className="text-2xl font-black tabular-nums text-primary">
                      +{strengthInsight.deltaPct.toFixed(1)}%
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1 overflow-hidden rounded-full bg-muted h-1.5 ring-1 ring-border/20">
                       <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, strengthInsight.deltaPct * 5)}%` }} />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">Últimos 30 días</p>
                  </div>
                  <p className="mt-3 text-[11px] font-bold text-muted-foreground tabular-nums flex gap-2">
                    <span className="bg-background px-1.5 py-0.5 rounded border shadow-sm">{strengthInsight.fromKg.toFixed(1)} kg</span>
                    <span className="opacity-40">→</span>
                    <span className="bg-background px-1.5 py-0.5 rounded border shadow-sm text-foreground">{strengthInsight.toKg.toFixed(1)} kg</span>
                  </p>
                </div>
              ) : strengthInsight.status === "ok" &&
                strengthInsight.recentMilestone ? null : (
                <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-5 py-8 text-center transition-opacity hover:opacity-80">
                   <p className="text-sm font-bold text-foreground">Construyendo análisis...</p>
                  <p className="mt-2 text-xs font-medium text-muted-foreground text-pretty leading-relaxed">
                    Registra más sesiones del mismo ejercicio para desbloquear proyecciones de carga.
                  </p>
                </div>
              )}

              {volumeInsight.status === "ok" ? (
                <div className="group rounded-2xl border bg-muted/20 p-5 transition-all hover:bg-muted/30">
                   <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                      Dinámica de Volumen
                    </p>
                    <Sparkles className="size-3.5 text-primary" />
                  </div>
                  <p className="text-sm font-black leading-snug text-foreground">
                    {volumeInsight.direction === "up"
                      ? "Tendencia ascendente"
                      : volumeInsight.direction === "down"
                        ? "Ajuste de volumen detectado"
                        : "Consistencia sólida"}
                  </p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-black tabular-nums tracking-tighter text-primary">
                      {Math.abs(volumeInsight.diffPct).toFixed(1)}%
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">
                      {volumeInsight.diffPct >= 0 ? "incremento" : "decrecimiento"}
                    </span>
                  </div>
                  <p className="mt-3 text-[10px] font-medium leading-relaxed text-muted-foreground/80 italic">
                    {volumeInsight.window === "4v4"
                      ? "Basado en balance de 4 vs 4 bloques de entrenamiento."
                      : "Comparativa de 3 vs 3 sesiones recientes."}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-5 py-8 text-center">
                  <p className="text-sm font-bold text-foreground">Faltan datos de volumen</p>
                  <p className="mt-2 text-xs font-medium text-muted-foreground text-pretty leading-relaxed">
                    {volumeInsight.sessionsWithVolume > 0 ? (
                      <>
                        Necesitamos <span className="tabular-nums font-black text-primary">{volumeInsight.needed}</span> sesiones más para calcular la curva de fatiga y progreso acumulado.
                      </>
                    ) : (
                      <>
                        Empieza a entrenar para generar tu primera tendencia de volumen.
                      </>
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        <section className="order-1 flex min-w-0 flex-col gap-6 lg:order-2 lg:col-span-8">
          <div className="grid gap-6">
            <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl transition-all hover:shadow-lg">
              <CardHeader className="pb-4 pt-6 px-6 border-b bg-muted/5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <Activity className="size-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight">
                      Mapa Anatómico: Balance, Fatiga y Fuerza Retenida
                    </CardTitle>
                    <CardDescription className="text-xs font-medium">
                      Volumen ponderado por músculo (100% primario / 40% secundario), recuperación biomecánica y retención de 1RM
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <MuscleBalanceCard
                  workoutHistory={richWorkoutHistory}
                  plannedWeeklyLoad={plannedWeeklyLoad}
                  gender={clientRecord.gender === "female" ? "female" : "male"}
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl transition-all hover:shadow-lg">
              <CardHeader className="pb-4 pt-6 px-6 border-b bg-muted/5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <CalendarDays className="size-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight">
                      Consistencia Anual
                    </CardTitle>
                    <CardDescription className="text-xs font-medium">
                      Mapa de actividad de las últimas 52 semanas por volumen o sesiones
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <ActivityHeatmap
                  sessions={(completedSessions || []).map((s: any) => ({
                    started_at: s.started_at as string,
                    total_volume_kg: Number(s.total_volume_kg) || 0,
                    duration_seconds: Number(s.duration_seconds) || null,
                  }))}
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl transition-all hover:shadow-lg">
              <CardHeader className="pb-4 pt-6 px-6 border-b bg-muted/5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <TrendingUp className="size-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight">Carga de Volumen</CardTitle>
                    <CardDescription className="text-xs font-medium">Kilogramos totales movilizados por sesión</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <VolumeChartLazy
                  sessions={(completedSessions || []).map((s) => {
                    const raw = s.total_volume_kg;
                    const n = typeof raw === "number" ? raw : Number(raw);
                    return {
                      started_at: s.started_at as string,
                      total_volume_kg: Number.isFinite(n) ? n : null,
                    };
                  })}
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl transition-all hover:shadow-lg">
              <CardHeader className="pb-4 pt-6 px-6 border-b bg-muted/5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <Award className="size-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight">Progreso de Fuerza</CardTitle>
                    <CardDescription className="text-xs font-medium">Curva de rendimiento histórico y récords personales</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <ExerciseProgressChartLazy
                  exercises={exercises}
                  pointsByExerciseId={pointsByExerciseId}
                  defaultExerciseId={exercises[0]?.id}
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl transition-all hover:shadow-lg">
              <CardHeader className="pb-4 pt-6 px-6 border-b bg-muted/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                      <Trophy className="size-5 text-primary" aria-hidden />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold tracking-tight">
                        Mis Récords Personales (PRs por Ejercicio)
                      </CardTitle>
                      <CardDescription className="text-xs font-medium">
                        Mejores marcas históricas de carga y 1RM estimado (Epley)
                      </CardDescription>
                    </div>
                  </div>
                  {currentExercisePrs.length > 0 && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tabular-nums text-primary">
                      {currentExercisePrs.length}{" "}
                      {currentExercisePrs.length === 1 ? "PR" : "PRs"}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {currentExercisePrs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border/40">
                      <Dumbbell className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Aún no tienes récords personales registrados
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      Completa tu primera sesión con carga para construir tu muro de PRs.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {currentExercisePrs.map((pr) => (
                      <div
                        key={pr.id}
                        className="group relative flex flex-col justify-between gap-3 rounded-2xl border border-border/70 bg-muted/15 p-4 transition-all hover:border-primary/30 hover:bg-muted/25"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
                            {pr.name}
                          </p>
                          <span className="shrink-0 rounded-lg border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {pr.dateLabel}
                          </span>
                        </div>

                        <div className="flex items-end justify-between gap-2 pt-1">
                          <div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-2xl font-black tabular-nums tracking-tight text-foreground">
                                {pr.weightKg}
                              </span>
                              <span className="text-xs font-bold text-muted-foreground">
                                kg
                              </span>
                              {pr.reps != null && pr.reps > 0 && (
                                <span className="ml-0.5 text-xs font-bold tabular-nums text-muted-foreground">
                                  × {pr.reps} reps
                                </span>
                              )}
                            </div>
                            {pr.sessionsCount >= 2 && pr.gainKg > 0 && (
                              <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-emerald-500">
                                +{pr.gainKg.toFixed(1)} kg desde el inicio
                              </p>
                            )}
                          </div>

                          <div className="rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-1 text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-primary/80">
                              1RM Est.
                            </p>
                            <p className="text-xs font-black tabular-nums text-primary">
                              ~{pr.est1rm} kg 1RM
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}
