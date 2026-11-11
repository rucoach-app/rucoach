"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getNextWorkoutDay } from "@/app/actions/routine-assignment";
import {
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Info,
  Dumbbell,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { ExerciseDetailDrawer } from "@/components/client/exercise-detail-drawer";
import { ExerciseMedia } from "@/components/client/exercise-media";
import { ExerciseSwapDrawer } from "@/components/client/exercise-swap-drawer";
import { ScheduleOverrideDialog } from "@/components/client/schedule-override-dialog";
import {
  CLIENT_DATA_PAGE_SHELL,
  ClientStackPageHeader,
} from "@/components/client/client-app-page-parts";
import type { Exercise } from "@/lib/types";
import { exName } from "@/lib/exercise-i18n";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { WeeklyMuscleCoverage } from "@/components/anatomy/weekly-muscle-coverage";
import { computeRoutineMuscleVolume } from "@/lib/anatomy/muscles";

export interface RoutineSummary {
  id: string;
  name: string;
  duration_weeks: number | null;
  days_per_week: number;
  training_days_per_week: number;
  description: string | null;
}

export interface ClientRoutine {
  id: string;
  routine_id: string;
  current_week: number;
  current_day_index: number;
  is_active: boolean;
  routines: RoutineSummary;
}

export interface TrainDay {
  id: string;
  day_number: number;
  day_name?: string | null;
  is_rest_day?: boolean | null;
}

export interface Suggestion {
  exerciseId: string;
  exercise: string;
  suggestedWeight?: number;
  suggestedReps?: number;
  reason: string;
}

export interface ClientRoutinesContentProps {
  initialRoutines: ClientRoutine[];
  initialNextWorkout: Record<string, unknown> | null;
  initialSuggestions: Suggestion[];
  initialTrainDays: TrainDay[];
  initialScheduleRoutineId: string;
}

export function ClientRoutinesContent({
  initialRoutines,
  initialNextWorkout,
  initialSuggestions,
  initialTrainDays,
  initialScheduleRoutineId,
}: ClientRoutinesContentProps) {
  const [routines] = useState<ClientRoutine[]>(initialRoutines);
  const [nextWorkout, setNextWorkout] = useState<Record<
    string,
    unknown
  > | null>(initialNextWorkout);
  const [suggestions] = useState<Suggestion[]>(initialSuggestions);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null,
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // --- Swap exercise ---
  const [swapDrawerOpen, setSwapDrawerOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{
    clientRoutineId: string;
    routineExerciseId: number;
    exercise: Exercise;
  } | null>(null);

  // --- Schedule override ---
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleRoutineId] = useState<string>(initialScheduleRoutineId);
  const [trainDays] = useState<TrainDay[]>(initialTrainDays);

  const handleExerciseClick = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setIsDrawerOpen(true);
  };

  if (routines.length === 0) {
    return (
      <>
        <ClientStackPageHeader
          title="Mis planes"
          subtitle="Sin rutinas asignadas · tu coach te asignará una pronto."
        />
        <div className={CLIENT_DATA_PAGE_SHELL}>
          <Empty className="rounded-3xl border-border/80 shadow-sm ring-1 ring-primary/5">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Dumbbell />
              </EmptyMedia>
              <EmptyTitle>Aún no tienes rutinas asignadas</EmptyTitle>
              <EmptyDescription>
                Cuando tu coach te asigne una rutina, verás aquí el plan semanal
                y el botón para iniciar tu siguiente sesión.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline">
                <Link href="/client/messages">Pedir rutina a mi coach</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      </>
    );
  }

  const activeRoutines = routines.filter((r) => r.is_active).length;
  const routinesSubtitle = `${routines.length} ${routines.length === 1 ? "rutina asignada" : "rutinas asignadas"} · ${activeRoutines} ${activeRoutines === 1 ? "activa" : "activas"}`;

  return (
    <>
      <ClientStackPageHeader
        title="Mis planes"
        subtitle={routinesSubtitle}
      />
      <div
        className={`${CLIENT_DATA_PAGE_SHELL} flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start`}
      >
        <section className="order-1 flex min-w-0 flex-col gap-8 lg:order-2 lg:col-span-8">
          {routines.map((routine) => {
            const isContinuous =
              !routine.routines.duration_weeks ||
              routine.routines.duration_weeks <= 0;
            const progress = isContinuous
              ? 100
              : Math.min(
                  100,
                  Math.round(
                    (routine.current_week / routine.routines.duration_weeks!) *
                      100,
                  ),
                );
            const nw = nextWorkout as {
              isComplete?: boolean;
              message?: string;
              dayFocus?: string | null;
              suggestedAction?: string;
              isRestDay?: boolean;
              exercises?: Array<{
                id: string;
                sets: number;
                reps: string;
                notes?: string | null;
                is_overridden?: boolean;
                exercises?: Exercise | Exercise[] | null;
              }>;
            } | null;

            return (
              <Card
                key={routine.id}
                className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm transition-all hover:bg-card"
              >
                <CardHeader className="pb-6 pt-8 px-6 sm:px-8 border-b bg-muted/5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <Dumbbell className="size-4 text-primary" aria-hidden />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                          Plan de Entrenamiento
                        </span>
                      </div>
                      <CardTitle className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                        {routine.routines.name}
                      </CardTitle>
                      {routine.routines.description && (
                        <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-2xl">
                          {routine.routines.description}
                        </p>
                      )}
                    </div>
                    {nw?.isComplete && (
                      <Badge className="w-fit self-start sm:self-center font-black text-[10px] uppercase tracking-widest px-3 py-1.5 bg-green-500/10 text-green-700 dark:text-green-400 border-none shadow-none rounded-lg">
                        <CheckCircle2 className="size-3 mr-1.5" />
                        Completado
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-8 p-6 sm:p-8">
                  {/* Progress Section */}
                  <div className="flex flex-col gap-4 bg-muted/10 rounded-2xl p-5 border border-border/40">
                    {isContinuous ? (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                            Plan Continuo Activo
                          </span>
                          <span className="text-lg font-black tracking-tight text-foreground">
                            Semana actual:{" "}
                            <span className="tabular-nums text-primary">
                              {routine.current_week}
                            </span>
                          </span>
                          <p className="text-xs text-muted-foreground">
                            Vigencia vinculada directamente al pago de tu membresía.
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 text-primary font-bold text-xs px-3 py-1 rounded-full w-fit shrink-0"
                        >
                          Vigencia continua
                        </Badge>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/80">
                              Progreso Actual
                            </span>
                            <span className="text-xl font-black tracking-tighter tabular-nums">
                              Semana {routine.current_week}{" "}
                              <span className="text-muted-foreground/40 font-bold mx-1">
                                /
                              </span>{" "}
                              {routine.routines.duration_weeks}
                            </span>
                          </div>
                          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 border-4 border-primary/5 ring-4 ring-primary/5">
                            <span className="text-sm font-black text-primary tabular-nums">
                              {progress}%
                            </span>
                          </div>
                        </div>
                        <Progress
                          value={progress}
                          className="h-2.5 bg-muted rounded-full"
                        />
                      </>
                    )}
                  </div>

                  {/* High Density Stats Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2 rounded-2xl border border-border/40 p-4 bg-background/50">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Sesiones / Ciclo
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black tabular-nums">
                          {routine.routines.training_days_per_week}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground uppercase">
                          Días
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 rounded-2xl border border-border/40 p-4 bg-background/50">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Ciclo Total
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black tabular-nums">
                          {routine.routines.duration_weeks}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground uppercase">
                          Semanas
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Next Session Area */}
                  {nw && (
                    <div className="flex flex-col gap-6 pt-8 border-t border-border/40">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="size-2 rounded-full bg-primary animate-pulse" />
                        <h3 className="text-sm font-black uppercase tracking-[0.15em] text-foreground/80">
                          Tu Próxima Cita
                        </h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-8 gap-1.5 rounded-full border border-border/50 px-3 text-xs font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          onClick={() => setScheduleDialogOpen(true)}
                          aria-label="Cambiar sesión de hoy"
                        >
                          <CalendarDays className="size-3.5" />
                          Cambiar sesión
                        </Button>
                      </div>

                      {nw.isComplete ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center bg-muted/10 rounded-2xl border border-dashed border-border/60">
                          <TrendingUp className="size-8 text-primary/40 mb-3" />
                          <p className="font-bold text-success text-lg">
                            {nw.message || "¡Objetivo cumplido!"}
                          </p>
                          <p className="text-sm font-medium text-muted-foreground mt-1">
                            {nw.suggestedAction}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-6">
                          <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10">
                            <p className="text-base font-bold leading-tight text-foreground">
                              {nw.message}
                            </p>
                            {nw.dayFocus && (
                              <p className="mt-1.5 text-xs font-semibold text-primary">
                                Enfoque: {nw.dayFocus}
                              </p>
                            )}
                            {nw.isRestDay && (
                              <p className="mt-2 text-sm font-medium text-muted-foreground leading-relaxed">
                                Aprovecha hoy para optimizar tu recuperación. El descanso es parte del crecimiento.
                              </p>
                            )}
                          </div>

                          {!nw.isRestDay &&
                            nw.exercises &&
                            nw.exercises.length > 0 && (
                              <div className="flex flex-col gap-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                  Contenido de la sesión
                                </span>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  {nw.exercises.map((exercise) => {
                                    const raw = exercise.exercises;
                                    const exDetails = Array.isArray(raw)
                                      ? raw[0]
                                      : raw;
                                    const displayExName = exName(exDetails);
                                    return (
                                      <div
                                        key={exercise.id}
                                        role="button"
                                        tabIndex={exDetails ? 0 : -1}
                                        aria-disabled={!exDetails}
                                        onClick={() =>
                                          exDetails &&
                                          handleExerciseClick(exDetails)
                                        }
                                        onKeyDown={(e) => {
                                          if (!exDetails) return;
                                          if (
                                            e.key === "Enter" ||
                                            e.key === " "
                                          ) {
                                            e.preventDefault();
                                            handleExerciseClick(exDetails);
                                          }
                                        }}
                                        className={cn(
                                          "group relative flex cursor-pointer items-center gap-3.5 sm:gap-4 rounded-2xl border border-border/50 bg-background/50 p-3 sm:p-3.5 text-left transition-all hover:border-primary/30 hover:bg-background hover:shadow-md active:scale-[0.99]",
                                          !exDetails &&
                                            "cursor-default opacity-60",
                                          exDetails &&
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                        )}
                                      >
                                        {/* Thumbnail / GIF a la izquierda */}
                                        <div className="relative size-16 sm:size-18 shrink-0 overflow-hidden rounded-xl bg-muted border border-border/40 shadow-xs">
                                          <ExerciseMedia
                                            src={exDetails?.gif_url}
                                            fallbackSrc={exDetails?.image_url}
                                            alt={displayExName}
                                            variant="thumb"
                                            className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                                          />
                                          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>

                                        {/* Datos del ejercicio al centro/derecha */}
                                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="line-clamp-2 text-xs sm:text-sm font-black capitalize tracking-tight text-foreground group-hover:text-primary transition-colors leading-snug">
                                              {displayExName}
                                            </span>
                                            {exercise.is_overridden && (
                                              <Badge
                                                variant="outline"
                                                className="shrink-0 h-4 px-1.5 text-[9px] font-bold uppercase tracking-wider border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full"
                                              >
                                                Cambiado
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground/80 tabular-nums whitespace-nowrap">
                                            <span className="text-foreground font-black">{exercise.sets}</span>
                                            <span className="text-[11px] font-medium text-muted-foreground">series</span>
                                            <span className="text-muted-foreground/30 font-bold">·</span>
                                            <span className="text-foreground font-black whitespace-nowrap">{exercise.reps}</span>
                                            <span className="text-[11px] font-medium text-muted-foreground">reps</span>
                                          </div>
                                          {exercise.notes?.trim() && (
                                            <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-primary/90">
                                              Nota: {exercise.notes}
                                            </p>
                                          )}
                                        </div>

                                        {/* Acciones compactas a la extrema derecha */}
                                        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                                          {exDetails && routines[0] && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSwapTarget({
                                                  clientRoutineId:
                                                    routines[0].id,
                                                  routineExerciseId: Number(
                                                    exercise.id,
                                                  ),
                                                  exercise: exDetails,
                                                });
                                                setSwapDrawerOpen(true);
                                              }}
                                              className="flex size-8 sm:size-9 items-center justify-center rounded-full text-muted-foreground/50 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 border border-transparent transition-all"
                                              aria-label={`Cambiar ${displayExName} por alternativa`}
                                              title="Cambiar ejercicio"
                                            >
                                              <RefreshCw className="size-3.5 sm:size-4" />
                                            </button>
                                          )}
                                          <div className="flex size-8 sm:size-9 items-center justify-center rounded-full text-muted-foreground/40 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                            <Info className="size-4 shrink-0" />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Cobertura Muscular de la Sesión */}
                                <div className="mt-2 rounded-2xl border border-border/60 bg-background/60 p-4">
                                  <p className="mb-3 text-xs font-black uppercase tracking-wider text-muted-foreground">
                                    Qué trabaja esta sesión
                                  </p>
                                  <WeeklyMuscleCoverage
                                    load={computeRoutineMuscleVolume(
                                      nw.exercises.map((item) => {
                                        const exObj = Array.isArray(
                                          item.exercises,
                                        )
                                          ? item.exercises[0]
                                          : item.exercises;
                                        return {
                                          exercise: exObj || {},
                                          sets: Number(item.sets) || 3,
                                        };
                                      }),
                                    )}
                                    showMissed={false}
                                    collapsedRows={5}
                                  />
                                </div>
                              </div>
                            )}

                          {!nw.isRestDay && (
                            <Button
                              asChild
                              className="h-14 w-full text-base font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                            >
                              <Link href="/client/workout/start">
                                Iniciar Sesión Ahora
                                <ChevronRight className="size-5 ml-2" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>

        <aside className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-4 lg:sticky lg:top-[calc(96px+1.5rem)] lg:self-start">
          {suggestions.length > 0 ? (
            <Card className="overflow-hidden border-primary/20 bg-primary/5 shadow-md ring-1 ring-primary/5 rounded-3xl backdrop-blur-md">
              <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-primary" />
                    <CardTitle className="text-lg font-black tracking-tight">
                      Progresión
                    </CardTitle>
                  </div>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    Sugerencias Semanales
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-2">
                <div className="flex flex-col gap-3">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.exerciseId}
                      className="group flex flex-col gap-3 rounded-2xl border border-primary/10 bg-background/80 p-4 transition-all hover:bg-background hover:shadow-md"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-black text-sm capitalize group-hover:text-primary transition-colors">
                          {suggestion.exercise}
                        </p>
                        <Badge className="h-5 rounded-md px-1.5 text-[9px] font-black uppercase tracking-tighter bg-primary/10 text-primary border-none">
                          Goal
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 items-center">
                        {suggestion.suggestedWeight != null && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                              Carga
                            </span>
                            <span className="text-lg font-black tabular-nums text-foreground">
                              {suggestion.suggestedWeight} kg
                            </span>
                          </div>
                        )}
                        {suggestion.suggestedReps != null && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                              Reps
                            </span>
                            <span className="text-lg font-black tabular-nums text-foreground">
                              {suggestion.suggestedReps}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-start gap-2 pt-3 border-t border-primary/5">
                        <Info className="size-3 text-primary/40 mt-0.5 shrink-0" />
                        <p className="text-[11px] font-medium leading-relaxed text-muted-foreground italic">
                          {suggestion.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/50">
              <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  <CardTitle className="text-lg font-black tracking-tight">
                    Progresión
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="rounded-2xl bg-muted/15 p-5 border border-dashed border-border/60">
                  <p className="text-sm font-medium text-muted-foreground text-pretty leading-relaxed mb-4">
                    Registra tus entrenamientos para que nuestro sistema de inteligencia deportiva calcule tus cargas óptimas.
                  </p>
                  <Button
                    asChild
                    variant="secondary"
                    className="w-full font-bold rounded-xl h-10 transition-all active:scale-[0.98]"
                  >
                    <Link href="/client/progress">Ver mis métricas</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Tip / Motivation Card */}
          <Card className="overflow-hidden border-primary/20 shadow-sm rounded-3xl bg-linear-to-br from-primary/10 via-primary/5 to-transparent">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="size-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Info className="size-4 text-primary" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-primary">
                  Tip de hoy
                </span>
              </div>
              <p className="text-sm font-medium text-foreground/85 leading-relaxed">
                &ldquo;La consistencia vence al talento cuando el talento no se esfuerza. Sigue tu plan al pie de la letra.&rdquo;
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <ExerciseDetailDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        exercise={selectedExercise}
      />

      {/* Exercise Swap Drawer */}
      {swapTarget && (
        <ExerciseSwapDrawer
          open={swapDrawerOpen}
          onOpenChange={setSwapDrawerOpen}
          clientRoutineId={swapTarget.clientRoutineId}
          originalRoutineExerciseId={swapTarget.routineExerciseId}
          originalExercise={swapTarget.exercise}
          onSwapped={() => {
            setSwapTarget(null);
            void getNextWorkoutDay(routines[0]?.id ?? "").then((nw) =>
              setNextWorkout(nw as Record<string, unknown>),
            );
          }}
        />
      )}

      {/* Schedule Override Dialog */}
      <ScheduleOverrideDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        clientRoutineId={scheduleRoutineId}
        trainDays={trainDays}
        onOverrideSet={() => {
          void getNextWorkoutDay(routines[0]?.id ?? "").then((nw) =>
            setNextWorkout(nw as Record<string, unknown>),
          );
        }}
      />
    </>
  );
}

