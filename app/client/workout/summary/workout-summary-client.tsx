"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  applyProgressionToRoutineDay,
  updateWorkoutSessionFeelingNote,
} from "@/app/actions/workout";
import {
  Clock,
  Dumbbell,
  Layers,
  Trophy,
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Activity,
} from "lucide-react";
import { WeeklyMuscleCoverage } from "@/components/anatomy/weekly-muscle-coverage";
import { computeRoutineMuscleVolume } from "@/lib/anatomy/muscles";

const AUTO_APPLY_PREF_KEY = "gym-coaching:auto-apply-progression";

function getAppliedStorageKey(sessionId: string) {
  return `gym-progression-applied:${sessionId}`;
}

function readAutoApplyPref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(AUTO_APPLY_PREF_KEY) !== "false";
  } catch {
    return true;
  }
}

function writeAutoApplyPref(value: boolean) {
  try {
    window.localStorage.setItem(AUTO_APPLY_PREF_KEY, value ? "true" : "false");
  } catch {
    /* noop */
  }
}

type ProgressionPhase = "applying" | "done" | "error" | "manual" | "no_day";

export interface SummaryExerciseLog {
  exercise_id: string | null;
  exercise_name?: string | null;
  set_number: number | null;
  weight_kg: number | null;
  reps: number | null;
  rpe?: number | null;
  is_warmup?: boolean | null;
  is_pr?: boolean | null;
  exercises?:
    | {
        name?: string | null;
        name_es?: string | null;
        primary_muscle?: string | null;
        secondary_muscles?: string[] | null;
        muscle_weights?: Record<string, number> | null;
      }
    | {
        name?: string | null;
        name_es?: string | null;
        primary_muscle?: string | null;
        secondary_muscles?: string[] | null;
        muscle_weights?: Record<string, number> | null;
      }[]
    | null;
}

export function WorkoutSummaryClient({
  sessionId,
  clientId,
  routineDayId,
  routineName,
  dayName,
  durationMinutes,
  totalVolumeKg,
  finishedAt,
  initialFeelingNote,
  stats,
  logs = [],
}: {
  sessionId: string;
  clientId: string;
  routineDayId: string | null;
  routineName?: string | null;
  dayName?: string | null;
  durationMinutes: number | null;
  totalVolumeKg: number | null;
  finishedAt: string | null;
  initialFeelingNote: string | null;
  stats: { totalSets: number; prsCount: number; totalVolume: number };
  logs?: SummaryExerciseLog[];
}) {
  const isRecentSession = useMemo(() => {
    if (!finishedAt) return false;
    const diffMs = Date.now() - new Date(finishedAt).getTime();
    return (
      Number.isFinite(diffMs) && diffMs >= -60_000 && diffMs < 30 * 60 * 1000
    );
  }, [finishedAt]);

  const [autoApplyAfterSessions, setAutoApplyAfterSessions] = useState(true);
  const [progressionPhase, setProgressionPhase] = useState<ProgressionPhase>(
    () => {
      if (!routineDayId) return "no_day";
      return isRecentSession ? "applying" : "done";
    },
  );
  const [progressionError, setProgressionError] = useState<string | null>(null);
  const [isApplyingManual, setIsApplyingManual] = useState(false);
  const ranAutoRef = useRef(false);

  const [note, setNote] = useState(initialFeelingNote ?? "");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const groupedLogs = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        name: string;
        sets: SummaryExerciseLog[];
      }
    >();

    for (const log of logs) {
      const key = log.exercise_id || log.exercise_name || "unknown";
      const exRel = Array.isArray(log.exercises)
        ? log.exercises[0]
        : log.exercises;
      const displayName =
        exRel?.name_es ||
        log.exercise_name ||
        exRel?.name ||
        "Ejercicio";

      const existing = groups.get(key);
      if (existing) {
        existing.sets.push(log);
      } else {
        groups.set(key, {
          key,
          name: displayName,
          sets: [log],
        });
      }
    }

    return Array.from(groups.values()).map((g) => ({
      ...g,
      sets: [...g.sets].sort(
        (a, b) => Number(a.set_number ?? 0) - Number(b.set_number ?? 0),
      ),
    }));
  }, [logs]);

  const volumeKg = useMemo(() => {
    if (totalVolumeKg != null && totalVolumeKg > 0)
      return Math.round(totalVolumeKg);
    return Math.round(stats.totalVolume);
  }, [totalVolumeKg, stats.totalVolume]);

  const dateLabel = useMemo(() => {
    const src = finishedAt;
    if (!src) return null;
    try {
      return new Date(src).toLocaleString("es", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Mexico_City",
      });
    } catch {
      return null;
    }
  }, [finishedAt]);

  useEffect(() => {
    setAutoApplyAfterSessions(readAutoApplyPref());
  }, []);

  const runProgression = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    if (!routineDayId) {
      return { ok: false, error: "Sin día de rutina vinculado" };
    }
    const result = await applyProgressionToRoutineDay({
      clientId,
      routineDayId,
    });
    if (!result.success) {
      setProgressionError(result.error);
      setProgressionPhase("error");
      return { ok: false, error: result.error };
    }
    try {
      sessionStorage.setItem(getAppliedStorageKey(sessionId), "1");
    } catch {
      /* noop */
    }
    setProgressionPhase("done");
    setProgressionError(null);
    return { ok: true };
  }, [clientId, routineDayId, sessionId]);

  useEffect(() => {
    if (!routineDayId) {
      setProgressionPhase("no_day");
      return;
    }

    if (ranAutoRef.current) return;

    if (!isRecentSession) {
      setProgressionPhase("done");
      ranAutoRef.current = true;
      return;
    }

    try {
      if (sessionStorage.getItem(getAppliedStorageKey(sessionId))) {
        setProgressionPhase("done");
        ranAutoRef.current = true;
        return;
      }
    } catch {
      /* noop */
    }

    if (!readAutoApplyPref()) {
      setProgressionPhase("manual");
      ranAutoRef.current = true;
      return;
    }

    ranAutoRef.current = true;
    setProgressionPhase("applying");
    (async () => {
      const res = await runProgression();
      if (res.ok) {
        toast.success(
          "Sugerencias de peso actualizadas para la próxima sesión.",
        );
      } else {
        toast.error("No se pudieron actualizar las sugerencias", {
          description: res.error,
        });
      }
    })();
  }, [routineDayId, sessionId, isRecentSession, runProgression]);

  const onAutoPrefChange = (checked: boolean) => {
    setAutoApplyAfterSessions(checked);
    writeAutoApplyPref(checked);
  };

  const onSaveNote = async () => {
    setIsSavingNote(true);
    try {
      const result = await updateWorkoutSessionFeelingNote(sessionId, note);
      if (!result.success) {
        toast.error("No se pudo guardar la nota", {
          description: result.error,
        });
        return;
      }
      toast.success("Nota guardada");
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar la nota");
    } finally {
      setIsSavingNote(false);
    }
  };

  const onApplyManual = async () => {
    if (!routineDayId) {
      toast.error("Esta sesión no está ligada a un día de rutina");
      return;
    }
    setIsApplyingManual(true);
    setProgressionError(null);
    setProgressionPhase("applying");
    try {
      const res = await runProgression();
      if (res.ok) {
        toast.success("Progresión aplicada a tu rutina");
      } else {
        toast.error("No se pudo aplicar la progresión", {
          description: res.error,
        });
      }
    } finally {
      setIsApplyingManual(false);
    }
  };

  const onRetryAfterError = async () => {
    setProgressionPhase("applying");
    setProgressionError(null);
    const res = await runProgression();
    if (res.ok) {
      toast.success("Sugerencias de peso actualizadas para la próxima sesión.");
    } else {
      toast.error("Sigue sin poder actualizarse", { description: res.error });
    }
  };

  const onRecalculate = async () => {
    setProgressionPhase("applying");
    setProgressionError(null);
    const res = await runProgression();
    if (res.ok) {
      toast.success("Sugerencias recalculadas.");
    } else {
      toast.error("No se pudo recalcular", { description: res.error });
    }
  };

  const titleRoutine = routineName || "Tu rutina";

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <section className="flex flex-col gap-6 lg:col-span-7">
          {/* Main Stats Card */}
          <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/50 transition-all hover:bg-card">
            <CardHeader className="pb-6 pt-6 px-6 border-b bg-muted/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-11 grow-0 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                    <Dumbbell className="size-5 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-xl font-bold tracking-tight">
                      {titleRoutine}
                    </CardTitle>
                    {dayName && (
                      <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                        Sesión: <span className="text-foreground">{dayName}</span>
                      </CardDescription>
                    )}
                  </div>
                </div>
                {dateLabel && (
                  <Badge variant="secondary" className="w-fit font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 bg-muted/20 text-muted-foreground border-none shadow-none rounded-md">
                    {dateLabel}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-8 p-6">
              {/* High Density Stats Grid */}
              <div className="grid grid-cols-3 gap-4 sm:gap-6">
                <article className="flex flex-col gap-3 group">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/5 border border-primary/10 shadow-inner group-hover:bg-primary/10 transition-colors">
                    <Clock className="size-5 text-primary" aria-hidden />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-black tabular-nums text-foreground leading-none tracking-tighter">
                      {durationMinutes != null ? durationMinutes : "—"}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest mt-1">Minutos</span>
                  </div>
                </article>

                <article className="flex flex-col gap-3 group">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/5 border border-primary/10 shadow-inner group-hover:bg-primary/10 transition-colors">
                    <div className="font-black text-primary text-xs">KG</div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-black tabular-nums text-foreground leading-none tracking-tighter">
                      {volumeKg.toLocaleString()}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest mt-1">Volumen</span>
                  </div>
                </article>

                <article className="flex flex-col gap-3 group">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/5 border border-primary/10 shadow-inner group-hover:bg-primary/10 transition-colors">
                    <Layers className="size-5 text-primary" aria-hidden />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-black tabular-nums text-foreground leading-none tracking-tighter">
                      {stats.totalSets}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest mt-1">Series</span>
                  </div>
                </article>
              </div>

              {/* Feedback Section */}
              <div className="relative pt-6 border-t border-border/40">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="size-4 text-primary" aria-hidden />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Tu Experiencia</h3>
                </div>
                
                <div className="space-y-4">
                  <Textarea
                    id="workout-feeling-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="¿Cómo te has sentido hoy? (Energía, dolores, sensaciones...)"
                    className="min-h-[140px] text-base md:text-sm rounded-2xl border-border/40 bg-muted/10 focus:bg-background transition-all"
                    maxLength={2000}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 w-full sm:w-auto font-bold rounded-xl px-6 transition-all active:scale-[0.98]"
                    disabled={isSavingNote}
                    onClick={onSaveNote}
                  >
                    {isSavingNote ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      "Guardar sensaciones"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exercise & Set Breakdown Card */}
          <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/50 transition-all hover:bg-card">
            <CardHeader className="pb-4 pt-6 px-6 border-b bg-muted/5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <Layers className="size-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight">
                      Desglose de Ejercicios y Series
                    </CardTitle>
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                      {groupedLogs.length}{" "}
                      {groupedLogs.length === 1 ? "ejercicio" : "ejercicios"} ·{" "}
                      {stats.totalSets}{" "}
                      {stats.totalSets === 1 ? "serie" : "series"}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-6">
              {groupedLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No se encontraron series registradas para esta sesión.
                </p>
              ) : (
                groupedLogs.map((group, idx) => (
                  <div
                    key={group.key}
                    className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-background/60 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary tabular-nums">
                          {idx + 1}
                        </span>
                        <h4 className="truncate text-sm font-black capitalize tracking-tight text-foreground">
                          {group.name}
                        </h4>
                      </div>
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
                      >
                        {group.sets.length}{" "}
                        {group.sets.length === 1 ? "serie" : "series"}
                      </Badge>
                    </div>

                    <div className="divide-y divide-border/40 rounded-xl border border-border/40 bg-card/50">
                      {group.sets.map((s, sIdx) => {
                        const w = Number(s.weight_kg ?? 0);
                        const r = Number(s.reps ?? 0);
                        return (
                          <div
                            key={`${group.key}-${s.set_number ?? sIdx}`}
                            className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground tabular-nums">
                                Serie {s.set_number ?? sIdx + 1}
                              </span>
                              {s.is_warmup && (
                                <Badge
                                  variant="outline"
                                  className="h-5 px-1.5 text-[9px] font-bold uppercase tracking-wider border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                >
                                  Calentamiento
                                </Badge>
                              )}
                              {s.is_pr && (
                                <Badge className="h-5 px-1.5 text-[9px] font-black uppercase tracking-wider bg-primary/15 text-primary border-none">
                                  <Trophy className="mr-1 size-3" />
                                  PR
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 font-black tabular-nums text-foreground">
                              <span>
                                {w > 0 ? `${w} kg` : "Peso corporal"}
                              </span>
                              <span className="text-muted-foreground/40">×</span>
                              <span>{r} reps</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button asChild className="h-12 flex-1 font-bold rounded-2xl shadow-sm transition-all active:scale-[0.98]">
              <Link href="/client/dashboard">Volver al inicio</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 flex-1 font-bold rounded-2xl border-border/60 hover:bg-muted/30 transition-all active:scale-[0.98]"
            >
              <Link href="/client/workouts">Ver historial completo</Link>
            </Button>
          </div>
        </section>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-[calc(96px+1.5rem)] lg:col-span-5 lg:self-start">
          {/* What you just trained (open-gym FinishSummary BodyMap) */}
          {groupedLogs.length > 0 && (
            <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/50 transition-all hover:bg-card">
              <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <Activity className="size-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight">
                      Músculos trabajados hoy
                    </CardTitle>
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                      Estímulo anatómico de la sesión
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <WeeklyMuscleCoverage
                  load={computeRoutineMuscleVolume(
                    groupedLogs.map((g) => {
                      const firstLog = g.sets[0];
                      const exRel = Array.isArray(firstLog?.exercises)
                        ? firstLog?.exercises[0]
                        : firstLog?.exercises;
                      const workingSetsCount = g.sets.filter(
                        (s) => !s.is_warmup,
                      ).length;
                      return {
                        exercise: exRel || {},
                        sets: Math.max(1, workingSetsCount),
                      };
                    }),
                  )}
                  showMissed={false}
                  collapsedRows={5}
                />
              </CardContent>
            </Card>
          )}

          {/* Performance Card */}
          <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/50 transition-all hover:bg-card">
            <CardHeader className="pb-4 pt-6 px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <Trophy className="size-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight">Récords</CardTitle>
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Rendimiento sesión</CardDescription>
                  </div>
                </div>
                {stats.prsCount > 0 && (
                  <Badge className="bg-primary text-primary-foreground font-black px-2 py-0.5 rounded-md animate-bounce">
                    ¡NEW!
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black tabular-nums text-primary tracking-tighter leading-none">
                  {stats.prsCount}
                </span>
                <span className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Personal Records</span>
              </div>
              <div className="mt-4 rounded-xl bg-primary/5 border border-primary/10 p-3">
                <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                  Grandes noticias: hemos detectado <span className="font-bold text-foreground">{stats.prsCount} récords personales</span> basados en el rendimiento de hoy.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Progression Card */}
          <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/50 transition-all hover:bg-card">
            <CardHeader className="pb-4 pt-6 px-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                  <Sparkles className="size-5 text-primary" aria-hidden />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold tracking-tight">Progresión</CardTitle>
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Optimización de pesos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 px-6 pb-6">
              {progressionPhase === "no_day" && (
                <div className="rounded-2xl bg-muted/15 p-4 border border-border/40 border-dashed">
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed text-pretty">
                    Sesión sin rutina vinculada. No se requieren ajustes automáticos para este día.
                  </p>
                </div>
              )}

              {progressionPhase === "applying" && (
                <div className="flex items-center gap-4 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-4 animate-pulse">
                  <Loader2 className="size-6 shrink-0 animate-spin text-primary" aria-hidden />
                  <p className="text-sm font-black uppercase tracking-widest text-primary">
                    Calculando mejoras...
                  </p>
                </div>
              )}

              {progressionPhase === "done" && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-4 rounded-2xl border border-green-500/20 bg-green-500/5 px-4 py-4 shadow-sm shadow-green-500/5">
                    <CheckCircle2 className="size-6 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase tracking-widest text-green-700 dark:text-green-300 leading-tight">
                        Sistema Actualizado
                      </p>
                      <p className="mt-2 text-xs font-medium text-muted-foreground leading-relaxed">
                        Tus pesos sugeridos para la próxima semana ya reflejan tu nuevo nivel de fuerza.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full font-bold rounded-xl border-border/40 hover:bg-muted/30 transition-all"
                    onClick={onRecalculate}
                  >
                    Recalcular Manualmente
                  </Button>
                </div>
              )}

              {progressionPhase === "error" && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-4 shadow-sm shadow-destructive/5">
                    <AlertCircle className="size-6 shrink-0 text-destructive" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase tracking-widest text-destructive leading-tight">
                        Error en Progresión
                      </p>
                      <p className="mt-2 text-xs font-medium text-muted-foreground leading-relaxed">
                        {progressionError ?? "No se pudieron aplicar los ajustes automáticos."}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="h-10 w-full font-bold rounded-xl bg-destructive hover:bg-destructive/90 transition-all"
                    onClick={onRetryAfterError}
                  >
                    Reintentar proceso
                  </Button>
                </div>
              )}

              {progressionPhase === "manual" && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl bg-muted/15 p-4 border border-border/40">
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                      La progresión automática está en reposo. Pulsa el botón para aplicar tus récords al plan ahora.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="h-11 w-full font-bold rounded-xl shadow-lg transition-all active:scale-[0.98]"
                    onClick={onApplyManual}
                    disabled={isApplyingManual || !routineDayId}
                  >
                    {isApplyingManual ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Aplicando cambios...
                      </>
                    ) : (
                      "Aplicar Progresión Ahora"
                    )}
                  </Button>
                </div>
              )}

              {routineDayId && progressionPhase !== "no_day" && (
                <div className="mt-2 pt-5 border-t border-border/40">
                  <div className="flex items-center justify-between gap-6 mb-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-black uppercase tracking-widest leading-none">Auto-Optimizar</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Al cerrar entreno</span>
                    </div>
                    <Switch
                      checked={autoApplyAfterSessions}
                      onCheckedChange={onAutoPrefChange}
                      aria-label="Actualizar sugerencias automáticamente tras cada entreno"
                    />
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground leading-relaxed text-pretty">
                    Si desactivas esta opción, deberás aplicar los cambios de peso manualmente cada vez que rompas un récord.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
