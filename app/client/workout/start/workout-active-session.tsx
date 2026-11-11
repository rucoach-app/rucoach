"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CircularProgress } from "@/components/ui/circular-progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  X,
  Play,
  Pause,
  SkipForward,
  Check,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Timer,
  PlayCircle,
  Trash2,
  History,
  Link2,
  RefreshCw,
  Flame,
  MessageSquareText,
  Minimize2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  calculate1RM,
  type Achievement,
  RoutineDay,
  RoutineExercise,
  PersonalRecord,
  Exercise,
} from "@/lib/types";
import { ExerciseDetailDrawer } from "@/components/client/exercise-detail-drawer";
import { ExerciseSwapDrawer } from "@/components/client/exercise-swap-drawer";
import { ExerciseMedia } from "@/components/client/exercise-media";
import { Badge } from "@/components/ui/badge";
import { completeWorkoutSession } from "@/app/actions/workout";
import {
  isPRBeatingBaseline,
  mergePRBaselines,
  suggestWeightForTargetReps,
} from "@/lib/progression";
import { cn } from "@/lib/utils";
import { exerciseUsesExternalLoad } from "@/lib/exercise-tracking";
import { exName } from "@/lib/exercise-i18n";
import { AchievementUnlockModal } from "@/components/client/achievement-unlock-modal";

// ─── Superset color system (mirrors the builder) ───────────────────────────
const SUPERSET_COLORS: Record<string, { bg: string; text: string; border: string; ring: string; connector: string }> = {
  A: { bg: 'bg-violet-500/15', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-400/30', ring: 'ring-violet-400/30', connector: 'bg-violet-400/50' },
  B: { bg: 'bg-sky-500/15',    text: 'text-sky-600 dark:text-sky-400',       border: 'border-sky-400/30',    ring: 'ring-sky-400/30',    connector: 'bg-sky-400/50'    },
  C: { bg: 'bg-emerald-500/15',text: 'text-emerald-600 dark:text-emerald-400',border: 'border-emerald-400/30',ring: 'ring-emerald-400/30',connector: 'bg-emerald-400/50'},
  D: { bg: 'bg-amber-500/15',  text: 'text-amber-600 dark:text-amber-400',   border: 'border-amber-400/30',  ring: 'ring-amber-400/30',  connector: 'bg-amber-400/50'  },
  E: { bg: 'bg-rose-500/15',   text: 'text-rose-600 dark:text-rose-400',     border: 'border-rose-400/30',   ring: 'ring-rose-400/30',   connector: 'bg-rose-400/50'   },
}
function getSupersetColor(group: string | null | undefined) {
  if (!group) return null;
  return SUPERSET_COLORS[group.toUpperCase()] ?? SUPERSET_COLORS['A'];
}

function formatElapsed(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface WorkoutActiveSessionProps {
  clientId: string;
  clientRoutineId?: string | null;
  routineDay: RoutineDay & {
    routine_exercises: (RoutineExercise & {
      exercises: any;
      is_overridden?: boolean;
      override_reason?: string | null;
    })[];
  };
  routineName: string;
  previousByExercise: Record<string, { weight_kg: number; reps: number }>;
  personalRecords: PersonalRecord[];
}

interface SetLog {
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number;
  completed: boolean;
  isPR: boolean;
}

function workoutDraftStorageKey(routineDayId: string) {
  return `gym-workout-draft:${routineDayId}`;
}

interface WorkoutDraftV1 {
  v: 1;
  routineDayId: string;
  currentExerciseIndex: number;
  workoutNote: string;
  sets: Record<string, SetLog[]>;
  workoutStartTime: number;
}

/** Estilo único para los botones de acción sobre el GIF (Técnica / Cambiar / Descanso): mismo alto, fuente y relleno. */
const MEDIA_ACTION_CLASS =
  "inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background/90 px-2 text-[10px] font-black uppercase tracking-wider text-foreground backdrop-blur-md transition-all hover:bg-background active:scale-[0.97] sm:h-11 sm:px-3 sm:text-[11px]";

export function WorkoutActiveSession({
  clientId,
  clientRoutineId = null,
  routineDay,
  routineName,
  previousByExercise,
  personalRecords,
}: WorkoutActiveSessionProps) {
  const router = useRouter();
  const exercises = useMemo(
    () => routineDay.routine_exercises || [],
    [routineDay.routine_exercises],
  );
  const loadPolicyByExerciseId = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const re of exercises) {
      const ex = re.exercises;
      m.set(
        re.exercise_id,
        exerciseUsesExternalLoad(
          ex?.exercise_type,
          ex?.uses_external_load,
          ex?.equipment,
        ),
      );
    }
    return m;
  }, [exercises]);
  const draftKey = workoutDraftStorageKey(routineDay.id);

  // ─── Superset metadata ─────────────────────────────────────────────────────
  /** Map: routine_exercise.id → superset group letter ("A", "B", etc.) or null */

  /** For a given exercise index, what position is it within its superset? (1-based, e.g. A1, A2) */
  const getSupersetPosition = useCallback((idx: number): number => {
    const group = exercises[idx]?.superset_group;
    if (!group) return 1;
    let pos = 1;
    for (let i = 0; i < idx; i++) {
      if (exercises[i]?.superset_group === group) pos++;
    }
    return pos;
  }, [exercises]);

  /** Is the next exercise in the same superset as the current one? */
  const nextIsSameSuperset = useCallback((idx: number): boolean => {
    const current = exercises[idx]?.superset_group;
    if (!current) return false;
    const next = exercises[idx + 1]?.superset_group;
    return next === current;
  }, [exercises]);

  /** Is the previous exercise in the same superset? (to render connecting line) */
  const prevIsSameSuperset = useCallback((idx: number): boolean => {
    const current = exercises[idx]?.superset_group;
    if (!current) return false;
    const prev = exercises[idx - 1]?.superset_group;
    return prev === current;
  }, [exercises]);

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [sets, setSets] = useState<Map<string, SetLog[]>>(new Map());
  const [isResting, setIsResting] = useState(false);
  const [isRestMinimized, setIsRestMinimized] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [totalRestTime, setTotalRestTime] = useState(90);
  const [workoutStartTime, setWorkoutStartTime] = useState(() => Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement[]>([]);
  const [workoutNote, setWorkoutNote] = useState("");
  const [jumpTargetIndex, setJumpTargetIndex] = useState<number | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null,
  );

  /** Tras comprobar sessionStorage: sin borrador → listo; con borrador → esperando diálogo recuperar/descartar */
  const [draftCheckpoint, setDraftCheckpoint] = useState<"pending" | "ready">(
    "pending",
  );
  const [restoreDraft, setRestoreDraft] = useState<WorkoutDraftV1 | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [feelingScore, setFeelingScore] = useState<number>(3);

  const carouselRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const restoreDismissRef = useRef<"apply" | "discard" | null>(null);

  // Timestamps absolutos para evitar desincronización o desaceleración en segundo plano/pantalla bloqueada
  const restTargetTimestampRef = useRef<number | null>(null);
  const restRemainingPausedRef = useRef<number | null>(null);

  const currentExercise = exercises[currentExerciseIndex];
  const currentSets = sets.get(currentExercise?.id?.toString()) || [];

  const isDirty = useMemo(() => {
    if (workoutNote.trim().length > 0) return true;
    if (currentExerciseIndex !== 0) return true;
    for (const list of sets.values()) {
      if (list.some((s) => s.completed)) return true;
    }
    return false;
  }, [workoutNote, currentExerciseIndex, sets]);

  const getSuggestedWeight = useCallback(
    (exerciseId: string, targetReps: number): number => {
      if (!loadPolicyByExerciseId.get(exerciseId)) return 0;
      const prev = previousByExercise[exerciseId];
      const pr = personalRecords.find((p) => p.exercise_id === exerciseId);

      return suggestWeightForTargetReps({
        estimated1RM: pr?.estimated_1rm,
        lastWeight: prev?.weight_kg,
        lastReps: prev?.reps,
        targetReps,
        incrementKg: 2.5,
        defaultWeightKg: 20,
      }).weight;
    },
    [previousByExercise, personalRecords, loadPolicyByExerciseId],
  );

  useEffect(() => {
    setElapsedSec(Math.floor((Date.now() - workoutStartTime) / 1000));
    const t = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - workoutStartTime) / 1000));
    }, 1000);
    return () => window.clearInterval(t);
  }, [workoutStartTime]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) {
        setDraftCheckpoint("ready");
        return;
      }
      const data = JSON.parse(raw) as WorkoutDraftV1;
      if (data.v !== 1 || data.routineDayId !== routineDay.id) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* noop */
        }
        setDraftCheckpoint("ready");
        return;
      }
      setRestoreDraft(data);
      setRestoreOpen(true);
    } catch {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* noop */
      }
      setDraftCheckpoint("ready");
    }
  }, [draftKey, routineDay.id]);

  useEffect(() => {
    if (draftCheckpoint !== "ready") return;
    if (!isDirty) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* noop */
      }
      return;
    }
    const payload: WorkoutDraftV1 = {
      v: 1,
      routineDayId: routineDay.id,
      currentExerciseIndex,
      workoutNote,
      sets: Object.fromEntries(sets),
      workoutStartTime,
    };
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch {
        // quota / private mode
      }
    }, 450);
    return () => window.clearTimeout(id);
  }, [
    draftCheckpoint,
    draftKey,
    isDirty,
    routineDay.id,
    currentExerciseIndex,
    workoutNote,
    sets,
    workoutStartTime,
  ]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!currentExercise) return;
    const id = currentExercise.id.toString();
    setSets((prev) => {
      if (prev.has(id)) return prev;
      const targetReps = parseInt(currentExercise.reps || "10", 10);
      const initialSets: SetLog[] = Array.from(
        { length: currentExercise.sets },
        (_, i) => ({
          setNumber: i + 1,
          weight: getSuggestedWeight(currentExercise.exercise_id, targetReps),
          reps: targetReps,
          completed: false,
          isPR: false,
        }),
      );
      return new Map(prev).set(id, initialSets);
    });
  }, [currentExercise, getSuggestedWeight]);

  useEffect(() => {
    if (!currentExercise) return;
    if (loadPolicyByExerciseId.get(currentExercise.exercise_id)) return;
    const id = currentExercise.id.toString();
    setSets((prev) => {
      const list = prev.get(id);
      if (!list?.length) return prev;
      if (!list.some((s) => s.weight !== 0)) return prev;
      return new Map(prev).set(
        id,
        list.map((s) => ({ ...s, weight: 0, isPR: false })),
      );
    });
  }, [currentExercise, loadPolicyByExerciseId]);

  useEffect(() => {
    const el = thumbRefs.current[currentExerciseIndex];
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [currentExerciseIndex]);

  // Actualización del temporizador de descanso basada en reloj de pared (wall-clock)
  useEffect(() => {
    if (!isResting || isPaused) return;

    const checkRest = () => {
      const target = restTargetTimestampRef.current;
      if (!target) return;
      const diffMs = target - Date.now();
      const remaining = Math.max(0, Math.ceil(diffMs / 1000));
      setRestTime(remaining);

      if (diffMs <= 0) {
        restTargetTimestampRef.current = null;
        restRemainingPausedRef.current = null;
        setIsResting(false);
        setIsRestMinimized(false);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        toast.success("Descanso terminado. ¡Siguiente serie!");
      }
    };

    checkRest();
    const interval = window.setInterval(checkRest, 250);
    return () => window.clearInterval(interval);
  }, [isResting, isPaused]);

  // Listener para sincronización instantánea al desbloquear móvil, encender pantalla o cambiar de pestaña
  useEffect(() => {
    const handleSync = () => {
      // 1. Resincronizar tiempo de sesión transcurrido
      setElapsedSec(Math.floor((Date.now() - workoutStartTime) / 1000));

      // 2. Resincronizar descanso si está activo y no pausado
      if (isResting && !isPaused && restTargetTimestampRef.current) {
        const diffMs = restTargetTimestampRef.current - Date.now();
        const remaining = Math.max(0, Math.ceil(diffMs / 1000));
        setRestTime(remaining);

        if (diffMs <= 0) {
          restTargetTimestampRef.current = null;
          restRemainingPausedRef.current = null;
          setIsResting(false);
          setIsRestMinimized(false);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          toast.success("Descanso terminado. ¡Siguiente serie!");
        }
      }
    };

    document.addEventListener("visibilitychange", handleSync);
    window.addEventListener("focus", handleSync);
    window.addEventListener("pageshow", handleSync);

    return () => {
      document.removeEventListener("visibilitychange", handleSync);
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("pageshow", handleSync);
    };
  }, [workoutStartTime, isResting, isPaused]);

  const checkForPR = (
    exerciseId: string,
    weight: number,
    reps: number,
    sameExerciseSets: SetLog[],
    setIndex: number,
  ): boolean => {
    if (!loadPolicyByExerciseId.get(exerciseId)) return false;
    const currentPR = personalRecords.find(
      (pr) => pr.exercise_id === exerciseId,
    );
    const dbBaseline =
      currentPR && currentPR.weight_kg > 0 && currentPR.reps > 0
        ? {
            weight: currentPR.weight_kg,
            reps: currentPR.reps,
            estimated_1rm:
              currentPR.estimated_1rm && currentPR.estimated_1rm > 0
                ? currentPR.estimated_1rm
                : calculate1RM(currentPR.weight_kg, currentPR.reps),
          }
        : null;

    let baseline = dbBaseline;
    for (let i = 0; i < sameExerciseSets.length; i++) {
      if (i === setIndex) continue;
      const s = sameExerciseSets[i];
      if (!s.completed) continue;
      const cand = {
        weight: s.weight,
        reps: s.reps,
        estimated_1rm: calculate1RM(s.weight, s.reps),
      };
      baseline = mergePRBaselines(baseline, cand);
    }

    return isPRBeatingBaseline(weight, reps, baseline);
  };

  const completeSet = (setIndex: number) => {
    if (!currentExercise) return;
    const id = currentExercise.id.toString();

    let prToast: { weight: number; reps: number } | null = null;
    let shouldRest = false;
    const restSec = currentExercise.rest_seconds || 90;

    setSets((prev) => {
      const list = prev.get(id);
      if (!list) return prev;
      const updatedSets = [...list];
      const set = { ...updatedSets[setIndex] };
      updatedSets[setIndex] = set;

      if (set.completed) {
        set.completed = false;
        set.isPR = false;
        return new Map(prev).set(id, updatedSets);
      }

      const isPR = checkForPR(
        currentExercise.exercise_id,
        set.weight,
        set.reps,
        updatedSets,
        setIndex,
      );
      set.completed = true;
      set.isPR = isPR;
      if (isPR && loadPolicyByExerciseId.get(currentExercise.exercise_id)) {
        prToast = { weight: set.weight, reps: set.reps };
      }
      // Trigger rest after any completed set, UNLESS:
      // 1) All sets of this exercise are done AND next exercise is a superset partner (back-to-back)
      // 2) All sets of this exercise are done AND this is the very last exercise of the session
      const allCompleted = updatedSets.every((s) => s.completed);
      const isLastExercise = currentExerciseIndex === exercises.length - 1;
      if (allCompleted && nextIsSameSuperset(currentExerciseIndex)) {
        shouldRest = false; // handled by auto-advance below
      } else if (allCompleted && isLastExercise) {
        shouldRest = false; // ready to finish the workout
      } else {
        shouldRest = restSec > 0;
      }
      return new Map(prev).set(id, updatedSets);
    });

    queueMicrotask(() => {
      if (prToast) {
        toast.success("¡Nuevo récord personal!", {
          description: `${prToast.weight} kg × ${prToast.reps} repeticiones`,
          icon: <Trophy className="h-5 w-5 text-primary" />,
        });
      }
      if (shouldRest) {
        const target = Date.now() + restSec * 1000;
        restTargetTimestampRef.current = target;
        restRemainingPausedRef.current = null;
        setRestTime(restSec);
        setTotalRestTime(restSec);
        setIsPaused(false);
        setIsResting(true);
        setIsRestMinimized(false);
      }
    });
  };

  const adjustRestTime = (deltaSec: number) => {
    if (isPaused) {
      const current = restRemainingPausedRef.current ?? restTime;
      const next = Math.max(0, current + deltaSec);
      restRemainingPausedRef.current = next;
      setRestTime(next);
      if (next > totalRestTime) {
        setTotalRestTime(next);
      }
      if (next === 0) {
        setIsResting(false);
        setIsRestMinimized(false);
        restRemainingPausedRef.current = null;
      }
      return;
    }

    const currentRemaining = restTargetTimestampRef.current
      ? Math.max(
          0,
          Math.ceil((restTargetTimestampRef.current - Date.now()) / 1000),
        )
      : restTime;
    const next = Math.max(0, currentRemaining + deltaSec);

    if (next === 0) {
      restTargetTimestampRef.current = null;
      setRestTime(0);
      setIsResting(false);
      setIsRestMinimized(false);
    } else {
      restTargetTimestampRef.current = Date.now() + next * 1000;
      setRestTime(next);
      if (next > totalRestTime) {
        setTotalRestTime(next);
      }
    }
  };

  const togglePauseRest = () => {
    if (isPaused) {
      const remaining = restRemainingPausedRef.current ?? restTime;
      if (remaining > 0) {
        restTargetTimestampRef.current = Date.now() + remaining * 1000;
        restRemainingPausedRef.current = null;
        setIsPaused(false);
      } else {
        setIsResting(false);
        setIsPaused(false);
      }
    } else {
      const currentRemaining = restTargetTimestampRef.current
        ? Math.max(
            0,
            Math.ceil((restTargetTimestampRef.current - Date.now()) / 1000),
          )
        : restTime;
      restRemainingPausedRef.current = currentRemaining;
      restTargetTimestampRef.current = null;
      setRestTime(currentRemaining);
      setIsPaused(true);
    }
  };

  const startManualRest = (seconds: number) => {
    const sec = Math.max(15, seconds || 90);
    const target = Date.now() + sec * 1000;
    restTargetTimestampRef.current = target;
    restRemainingPausedRef.current = null;
    setTotalRestTime(sec);
    setRestTime(sec);
    setIsPaused(false);
    setIsResting(true);
    setIsRestMinimized(false);
  };

  const updateSetValue = (
    setIndex: number,
    field: "weight" | "reps",
    delta: number,
  ) => {
    if (!currentExercise) return;
    const id = currentExercise.id.toString();
    setSets((prev) => {
      const list = prev.get(id);
      if (!list) return prev;
      const updatedSets = [...list];
      const set = updatedSets[setIndex];
      if (field === "weight") {
        set.weight = Math.max(0, set.weight + delta);
      } else {
        set.reps = Math.max(1, set.reps + delta);
      }
      return new Map(prev).set(id, updatedSets);
    });
  };

  const addSet = () => {
    if (!currentExercise) return;
    const id = currentExercise.id.toString();
    const targetReps = parseInt(currentExercise.reps || "10", 10);
    setSets((prev) => {
      const list = prev.get(id) || [];
      const last = list[list.length - 1];
      const nextSet: SetLog = {
        setNumber: list.length + 1,
        weight:
          last?.weight ??
          getSuggestedWeight(currentExercise.exercise_id, targetReps),
        reps: last?.reps ?? targetReps,
        completed: false,
        isPR: false,
      };
      return new Map(prev).set(id, [...list, nextSet]);
    });
  };

  /** Solo se pueden quitar series añadidas con «Añadir serie» (por encima del plan). */
  const removeSet = (setIndex: number) => {
    if (!currentExercise) return;
    const id = currentExercise.id.toString();
    const prescribed = Math.max(1, currentExercise.sets);
    setSets((prev) => {
      const list = prev.get(id);
      if (!list || list.length <= prescribed) return prev;
      if (setIndex < prescribed) return prev;
      const next = list
        .filter((_, i) => i !== setIndex)
        .map((s, i) => ({ ...s, setNumber: i + 1 }));
      return new Map(prev).set(id, next);
    });
  };

  const goToExercise = (index: number) => {
    setCurrentExerciseIndex(index);
    setIsResting(false);
    setJumpTargetIndex(null);
  };

  const requestGoToExercise = (index: number) => {
    if (index === currentExerciseIndex) return;
    const incomplete =
      currentSets.length > 0 && currentSets.some((s) => !s.completed);
    if (incomplete) {
      setJumpTargetIndex(index);
      return;
    }
    goToExercise(index);
  };

  const nextExercise = () => {
    if (currentExerciseIndex < exercises.length - 1) {
      goToExercise(currentExerciseIndex + 1);
    }
  };

  const finishWorkout = async () => {
    if (isFinishing) return;
    setIsFinishing(true);

    let totalVolume = 0;
    sets.forEach((exerciseSets) => {
      exerciseSets.forEach((set) => {
        if (set.completed) {
          totalVolume += set.weight * set.reps;
        }
      });
    });

    const duration = Math.max(
      1,
      Math.round((Date.now() - workoutStartTime) / 60000),
    );

    try {
      const allCompletedSets: {
        exerciseId: string;
        setNumber: number;
        weight: number;
        reps: number;
        isPR?: boolean;
      }[] = [];

      sets.forEach((exerciseSets, routineExerciseId) => {
        const exercise = exercises.find(
          (e) => e.id.toString() === routineExerciseId,
        );
        const exerciseId = exercise?.exercise_id;
        if (!exerciseId) return;

        exerciseSets.forEach((set) => {
          if (!set.completed) return;
          allCompletedSets.push({
            exerciseId,
            setNumber: set.setNumber,
            weight: set.weight,
            reps: set.reps,
            isPR: set.isPR,
          });
        });
      });

      if (allCompletedSets.length === 0) {
        toast.error("Marca al menos una serie completada antes de terminar");
        setIsFinishing(false);
        return;
      }

      const result = await completeWorkoutSession({
        clientId,
        routineDayId: routineDay.id,
        sets: allCompletedSets,
        durationMinutes: duration,
        startedAt: new Date(workoutStartTime).toISOString(),
        rating: feelingScore,
        notes: workoutNote.trim() || undefined,
      });

      if (!result.success) {
        toast.error("No se pudo guardar el entrenamiento", {
          description: result.error,
        });
        return;
      }

      setFinishModalOpen(false);

      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* noop */
      }

      toast.success("¡Entrenamiento guardado!", {
        description: `${duration} min · ${Math.round(totalVolume)} kg volumen · ${result.stats?.prsCount ?? 0} PRs`,
      });

      if (
        result.stats?.newAchievements &&
        result.stats.newAchievements.length > 0
      ) {
        sessionStorage.setItem("last_session_id", result.sessionId);
        setNewlyUnlocked(result.stats.newAchievements as Achievement[]);
      } else {
        router.push(`/client/workout/summary?sessionId=${result.sessionId}`);
      }
    } catch (err) {
      toast.error("Error inesperado guardando el entrenamiento");
      console.error(err);
    } finally {
      setIsFinishing(false);
    }
  };

  const skipRest = () => {
    restTargetTimestampRef.current = null;
    restRemainingPausedRef.current = null;
    setIsResting(false);
    setIsRestMinimized(false);
    setIsPaused(false);
    setRestTime(0);
  };

  const applyWorkoutDraft = useCallback(() => {
    if (!restoreDraft) return;
    restoreDismissRef.current = "apply";
    setWorkoutStartTime(restoreDraft.workoutStartTime);
    setCurrentExerciseIndex(
      Math.min(
        Math.max(0, restoreDraft.currentExerciseIndex),
        Math.max(0, exercises.length - 1),
      ),
    );
    setWorkoutNote(restoreDraft.workoutNote);
    setSets(new Map(Object.entries(restoreDraft.sets)));
    setRestoreDraft(null);
    setRestoreOpen(false);
    setDraftCheckpoint("ready");
  }, [restoreDraft, exercises.length]);

  const discardWorkoutDraft = useCallback(() => {
    restoreDismissRef.current = "discard";
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* noop */
    }
    setRestoreDraft(null);
    setRestoreOpen(false);
    setDraftCheckpoint("ready");
  }, [draftKey]);

  const confirmLeaveWorkout = useCallback(() => {
    setLeaveOpen(false);
    router.push("/client/dashboard");
  }, [router]);

  const completedSetsCount = currentSets.filter((s) => s.completed).length;
  const allSetsCompleted =
    completedSetsCount === currentSets.length && currentSets.length > 0;

  // ─── Global Session Progress Metrics ─────────────────────────────────────
  const {
    totalSessionSets,
    completedSessionSets,
    completedExercisesCount,
    totalSessionVolume,
  } = useMemo(() => {
    let totalSets = 0;
    let doneSets = 0;
    let doneExercises = 0;
    let volume = 0;
    for (const re of exercises) {
      const list = sets.get(re.id.toString());
      const count = list ? list.length : Math.max(1, re.sets || 1);
      const done = list ? list.filter((s) => s.completed).length : 0;
      totalSets += count;
      doneSets += done;
      if (done === count && count > 0) {
        doneExercises += 1;
      }
      if (list) {
        for (const s of list) {
          if (s.completed) {
            volume += (s.weight || 0) * (s.reps || 0);
          }
        }
      }
    }
    return {
      totalSessionSets: totalSets,
      completedSessionSets: doneSets,
      completedExercisesCount: doneExercises,
      totalSessionVolume: volume,
    };
  }, [exercises, sets]);

  const requestFinishWorkout = useCallback(() => {
    if (isFinishing) return;
    if (completedSessionSets === 0) {
      toast.error("Marca al menos una serie completada antes de terminar");
      return;
    }
    setFinishModalOpen(true);
  }, [isFinishing, completedSessionSets]);

  const sessionProgressPct = useMemo(() => {
    if (totalSessionSets <= 0) return 0;
    const raw = Math.round((completedSessionSets / totalSessionSets) * 100);
    return Math.min(100, Math.max(completedSessionSets > 0 ? raw : 4, raw));
  }, [completedSessionSets, totalSessionSets]);

  // ─── Superset UI helpers for current exercise ────────────────────────────
  const currentSupersetGroup = currentExercise?.superset_group ?? null;
  const currentSupersetColor = getSupersetColor(currentSupersetGroup);
  const currentSupersetPos = currentExercise ? getSupersetPosition(currentExerciseIndex) : 1;
  const isInSuperset = !!currentSupersetGroup;
  const isLastOfSuperset = isInSuperset && !nextIsSameSuperset(currentExerciseIndex);
  const isFirstOfSuperset = isInSuperset && !prevIsSameSuperset(currentExerciseIndex);

  // Auto-advance to superset partner when all sets of current exercise are done
  useEffect(() => {
    if (!allSetsCompleted) return;
    if (!nextIsSameSuperset(currentExerciseIndex)) return;
    // Short pause (300ms) so the ✓ checkmark shows before switching 
    const timer = window.setTimeout(() => {
      toast.info(`Biserie: pasando a ${exName(exercises[currentExerciseIndex + 1]?.exercises)}`, {
        duration: 2000,
        description: "Sin descanso — van back-to-back",
      });
      goToExercise(currentExerciseIndex + 1);
    }, 600);
    return () => window.clearTimeout(timer);
   
  }, [allSetsCompleted, currentExerciseIndex]);

  const usesExternalLoad = currentExercise
    ? exerciseUsesExternalLoad(
        currentExercise.exercises?.exercise_type,
        currentExercise.exercises?.uses_external_load,
        currentExercise.exercises?.equipment,
      )
    : true;

  const previewLabel = (() => {
    const eid = currentExercise?.exercise_id;
    if (!eid) return "—";
    
    // 1. Try to find last session data
    const prev = previousByExercise[eid];
    if (prev && prev.weight_kg > 0) {
      return `${prev.weight_kg}×${prev.reps}`;
    }

    // 2. Fallback to Personal Record (Best ever)
    const pr = personalRecords.find(p => p.exercise_id === eid);
    if (pr && pr.weight_kg > 0) {
      return `PR: ${pr.weight_kg}×${pr.reps}`;
    }

    return "—";
  })();

  const restSeconds = currentExercise?.rest_seconds || 90;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-background">
      {/* Compact Sticky Workout Header (Single Row on Mobile & Desktop + Live Progress Bar) */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/85 backdrop-blur-xl safe-area-header-pt safe-area-x">
        <div className="container mx-auto flex min-h-[64px] max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:min-h-[84px] sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 sm:size-10 shrink-0 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
              aria-label="Salir"
              onClick={() => {
                if (isDirty) setLeaveOpen(true);
                else router.push("/client/dashboard");
              }}
            >
              <X className="size-5" aria-hidden />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-black tracking-tight text-foreground sm:text-2xl">
                  {routineDay.day_name ?? "Entrenamiento"}
                </h1>
                <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary sm:inline-flex">
                  {completedSessionSets}/{totalSessionSets} series
                </span>
              </div>
              <p className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">
                {routineName}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <div
              className="inline-flex h-9 sm:h-11 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 sm:px-4 text-xs sm:text-sm font-black tabular-nums text-primary"
              role="timer"
              aria-live="polite"
              aria-label={`Tiempo de sesión transcurrido ${formatElapsed(elapsedSec)}`}
            >
              <Timer className="size-3.5 sm:size-4 shrink-0 text-primary" aria-hidden />
              <span className="text-[10px] font-black uppercase tracking-wider opacity-75 hidden xs:inline">Sesión</span>
              {formatElapsed(elapsedSec)}
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={requestFinishWorkout}
              disabled={isFinishing}
              className="h-9 sm:h-11 rounded-full px-4 sm:px-6 text-[11px] sm:text-sm font-black uppercase tracking-wider sm:tracking-widest bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              {isFinishing ? "Guardando…" : "Terminar"}
            </Button>
          </div>
        </div>

        {/* Sticky Real-Time Set Progress Bar */}
        <div
          className="relative h-1.5 w-full bg-muted/40 overflow-hidden"
          role="progressbar"
          aria-valuenow={completedSessionSets}
          aria-valuemin={0}
          aria-valuemax={totalSessionSets}
          aria-label={`Progreso de la sesión: ${completedSessionSets} de ${totalSessionSets} series completadas`}
        >
          <div
            className="absolute inset-y-0 left-0 bg-primary shadow-sm shadow-primary/30 transition-all duration-500 ease-out"
            style={{ width: `${sessionProgressPct}%` }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.35)_50%,transparent_100%)] animate-shimmer" />
          </div>
        </div>
      </header>

      <AlertDialog
        open={restoreOpen}
        onOpenChange={(open) => {
          if (open) return;
          const reason = restoreDismissRef.current;
          restoreDismissRef.current = null;
          if (reason === "apply" || reason === "discard") return;
          try {
            localStorage.removeItem(draftKey);
          } catch {
            /* noop */
          }
          setRestoreDraft(null);
          setDraftCheckpoint("ready");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Recuperar tu progreso?</AlertDialogTitle>
            <AlertDialogDescription>
              Había un entreno sin terminar guardado en este dispositivo. Puedes
              restaurar series, nota y tiempo o empezar de cero. Nada se envía
              al servidor hasta que pulses Terminar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" onClick={discardWorkoutDraft}>
              Empezar de cero
            </AlertDialogCancel>
            <AlertDialogAction type="button" onClick={applyWorkoutDraft}>
              Recuperar progreso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir del entreno?</AlertDialogTitle>
            <AlertDialogDescription>
              Si sales sin pulsar Terminar, la sesión no se guarda en el
              servidor. En este dispositivo guardamos un borrador por si vuelves
              a abrir el mismo día (puedes recuperarlo o borrarlo al entrar).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir entrenando</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLeaveWorkout}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Salir sin terminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={jumpTargetIndex !== null}
        onOpenChange={(open) => !open && setJumpTargetIndex(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar de ejercicio?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes series sin marcar en este ejercicio. Si cambias ahora,
              podrás volver después; los datos escritos se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir aquí</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                jumpTargetIndex !== null && goToExercise(jumpTargetIndex)
              }
            >
              Cambiar igualmente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fullscreen Rest Timer Modal */}
      {isResting && !isRestMinimized && (
        <div className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-background/85 p-4 backdrop-blur-2xl animate-in fade-in duration-300 sm:p-8">
          <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-primary/5 pointer-events-none" />

          {/* Minimize button at top right */}
          <button
            type="button"
            onClick={() => setIsRestMinimized(true)}
            className="absolute top-[max(1rem,calc(env(safe-area-inset-top,0px)+0.5rem))] right-[max(1rem,env(safe-area-inset-right,1rem))] sm:top-6 sm:right-6 z-20 flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/80 px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
            aria-label="Minimizar temporizador de descanso"
          >
            <Minimize2 className="size-3.5" />
            <span>Minimizar</span>
          </button>

          <div className="relative flex flex-col items-center justify-center p-2">
            {/* Difusión suave y atmosférica sin artefactos de recorte cuadrado */}
            <div
              className="absolute -inset-10 rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.22)_0%,hsl(var(--primary)/0.07)_45%,transparent_70%)] blur-2xl pointer-events-none"
              aria-hidden="true"
            />
            <CircularProgress
              value={restTime}
              max={totalRestTime}
              size={220}
              strokeWidth={5}
              className="relative text-primary"
            >
              <div className="flex flex-col items-center justify-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-[0.28em] text-primary/70">
                  Descanso
                </span>
                <span className="text-5xl font-black tabular-nums tracking-tighter sm:text-6xl">
                  {restTime >= 60 ? formatElapsed(restTime) : restTime}
                </span>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  {restTime >= 60 ? `${restTime}s restantes` : "Segundos"}
                </span>
              </div>
            </CircularProgress>
          </div>

          {/* Quick Rest Adjustment + Play/Pause Controls */}
          <div className="relative z-10 mt-8 flex items-center justify-center gap-3 sm:mt-10 sm:gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => adjustRestTime(-15)}
              aria-label="Restar 15 segundos de descanso"
              className="h-12 rounded-2xl border-border/80 bg-card/80 px-4 text-xs font-black tabular-nums hover:bg-secondary"
            >
              -15s
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={togglePauseRest}
              aria-label={isPaused ? "Reanudar temporizador" : "Pausar temporizador"}
              className="size-14 rounded-3xl bg-secondary/90 transition-all hover:bg-secondary sm:size-16"
            >
              {isPaused ? (
                <Play className="size-7 fill-current" />
              ) : (
                <Pause className="size-7 fill-current" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => adjustRestTime(30)}
              aria-label="Sumar 30 segundos de descanso"
              className="h-12 rounded-2xl border-border/80 bg-card/80 px-4 text-xs font-black tabular-nums hover:bg-secondary"
            >
              +30s
            </Button>
          </div>

          <div className="relative z-10 mt-4 flex w-full max-w-xs flex-col items-stretch gap-2.5 sm:mt-6">
            <Button
              type="button"
              variant="default"
              size="lg"
              onClick={() => {
                skipRest();
                if (
                  allSetsCompleted &&
                  currentExerciseIndex < exercises.length - 1 &&
                  !nextIsSameSuperset(currentExerciseIndex)
                ) {
                  nextExercise();
                }
              }}
              className="h-13 w-full rounded-2xl bg-primary px-6 font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/30 transition-all hover:scale-[1.01] active:scale-95 sm:h-14"
            >
              <SkipForward className="mr-2.5 size-5" />
              {allSetsCompleted &&
              currentExerciseIndex < exercises.length - 1 &&
              !nextIsSameSuperset(currentExerciseIndex)
                ? "Saltar e ir al siguiente"
                : "Saltar descanso"}
            </Button>
          </div>

          <div className="mt-8 text-center relative z-10 max-w-xs px-4">
            {completedSetsCount === 0 ? (
              <>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 mb-1">
                  Preparación previa
                </p>
                <p className="text-lg font-black tracking-tight text-foreground">
                  Serie 1 de {currentSets.length}
                </p>
              </>
            ) : allSetsCompleted && currentExerciseIndex < exercises.length - 1 ? (
              <>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 mb-1">
                   Ejercicio completado · Siguiente
                </p>
                <p className="text-base font-black tracking-tight text-foreground line-clamp-2">
                  {exName(exercises[currentExerciseIndex + 1]?.exercises)}
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 mb-1">
                  Serie {completedSetsCount} completada
                </p>
                <p className="text-lg font-black tracking-tight underline decoration-primary decoration-2 underline-offset-4">
                  Próxima: Serie {Math.min(completedSetsCount + 1, currentSets.length)} de{" "}
                  {currentSets.length}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating Minimized Rest Bar */}
      {isResting && isRestMinimized && (
        <div className="fixed bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] inset-x-3 sm:inset-x-6 max-w-md mx-auto z-50 flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-300">
          <button
            type="button"
            onClick={() => setIsRestMinimized(false)}
            className="flex items-center gap-2.5 text-left group min-w-0"
            aria-label="Expandir temporizador de descanso"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Timer className="size-4 animate-spin" style={{ animationDuration: "4s" }} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Descanso activo
              </span>
              <span className="text-sm font-black tabular-nums text-foreground group-hover:text-primary transition-colors">
                {restTime >= 60 ? formatElapsed(restTime) : `${restTime}s`} restantes
              </span>
            </div>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => adjustRestTime(30)}
              className="h-8 rounded-xl px-2.5 text-xs font-black tabular-nums"
              aria-label="Sumar 30 segundos"
            >
              +30s
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={skipRest}
              className="h-8 rounded-xl px-3 text-xs font-black uppercase tracking-wider"
            >
              Saltar
            </Button>
          </div>
        </div>
      )}

      <div className="container mx-auto flex-1 max-w-7xl px-3.5 py-4 pb-16 sm:px-6 sm:py-6 lg:px-8">
        {!currentExercise ? (
          <Card className="mx-auto max-w-lg rounded-3xl border-border/60 bg-card/60 p-8 text-center shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 p-0">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Check className="size-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-black tracking-tight">
                  Sin ejercicios asignados para este día
                </h2>
                <p className="text-sm text-muted-foreground">
                  Este bloque no tiene ejercicios configurados todavía. Selecciona otro día desde Mis Rutinas o consulta a tu coach.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => router.push("/client/routines")}
                className="h-11 rounded-xl px-6 font-bold"
              >
                Volver a Mis Rutinas
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {currentExercise && (
          <div className="grid w-full min-w-0 gap-4 sm:gap-6 lg:grid-cols-12 lg:items-start lg:gap-10">
            {/* LEFT COLUMN: Route Stepper + Exercise Media + Desktop Session Note */}
            <div className="flex w-full min-w-0 flex-col gap-3.5 sm:gap-5 lg:col-span-5 lg:sticky lg:top-[calc(88px+1.25rem)] lg:self-start">
              {/* TU RUTA DE HOY */}
              <div className="flex w-full min-w-0 flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/75">
                    Tu Ruta de Hoy
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                    <span className="text-muted-foreground">
                      {completedExercisesCount}/{exercises.length} listos
                    </span>
                    <span className="text-border">·</span>
                    <span className="text-primary">
                      Ej. {currentExerciseIndex + 1}/{exercises.length}
                    </span>
                  </div>
                </div>

                <div className="relative w-full min-w-0 max-w-full overflow-x-hidden">
                  <div className="absolute left-0 top-0 bottom-3 z-10 w-6 bg-linear-to-r from-background to-transparent pointer-events-none opacity-0 sm:opacity-100" />
                  <div className="absolute right-0 top-0 bottom-3 z-10 w-6 bg-linear-to-l from-background to-transparent pointer-events-none opacity-0 sm:opacity-100" />

                  <div
                    ref={carouselRef}
                    className="flex w-full min-w-0 max-w-full touch-pan-x gap-3 overflow-x-auto overscroll-x-contain px-1 pb-2.5 pt-1.5 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4 sm:pb-4"
                    role="tablist"
                    aria-label="Ejercicios del día"
                  >
                    {exercises.map((re, idx) => {
                      const ex = re.exercises as Exercise | undefined;
                      const active = idx === currentExerciseIndex;
                      const ssGroup = re.superset_group ?? null;
                      const ssColor = getSupersetColor(ssGroup);
                      const ssPos = getSupersetPosition(idx);
                      const isPrevSS = prevIsSameSuperset(idx);

                      const exList = sets.get(re.id.toString());
                      const exTotal = exList ? exList.length : Math.max(1, re.sets || 1);
                      const exDone = exList ? exList.filter((s) => s.completed).length : 0;
                      const isExCompleted = exDone === exTotal && exTotal > 0;
                      const isExPartial = exDone > 0 && !isExCompleted;

                      return (
                        <div key={re.id} className="relative shrink-0 flex flex-col items-center">
                          {isPrevSS && ssColor && (
                            <div
                              className={cn(
                                "absolute -top-2.5 left-1/2 -translate-x-1/2 w-0.5 h-3 rounded-full",
                                ssColor.connector,
                              )}
                            />
                          )}
                          <button
                            type="button"
                            ref={(el) => {
                              thumbRefs.current[idx] = el;
                            }}
                            role="tab"
                            aria-selected={active}
                            aria-label={`${exName(ex)}${ssGroup ? ` (Biserie ${ssGroup}${ssPos})` : ""}${isExCompleted ? " (Completado)" : ""}`}
                            onClick={() => requestGoToExercise(idx)}
                            className={cn(
                              "group relative flex shrink-0 flex-col items-center gap-1.5 transition-all duration-300 snap-start",
                              active
                                ? "scale-105"
                                : isExCompleted
                                  ? "opacity-90 hover:opacity-100"
                                  : isExPartial
                                    ? "opacity-75 hover:opacity-95"
                                    : "opacity-45 hover:opacity-70",
                            )}
                          >
                            <div
                              className={cn(
                                "relative size-14 shrink-0 overflow-hidden rounded-2xl border-2 transition-all duration-300 sm:size-18 shadow-none",
                                active
                                  ? ssColor
                                    ? cn(ssColor.border, "shadow-md shadow-primary/30")
                                    : "border-primary shadow-md shadow-primary/30"
                                  : isExCompleted
                                    ? "border-emerald-500/60 bg-emerald-500/5"
                                    : isExPartial
                                      ? "border-primary/50"
                                      : "border-border/40",
                              )}
                            >
                              <ExerciseMedia
                                src={ex?.gif_url || ex?.image_url}
                                alt=""
                                variant="thumb"
                                className="size-full"
                                imgClassName="object-cover"
                              />
                              {active && (
                                <div
                                  className={cn(
                                    "absolute inset-x-0 bottom-0 h-1 animate-pulse",
                                    ssColor ? ssColor.connector : "bg-primary",
                                  )}
                                />
                              )}
                              {/* Superset group badge on thumbnail */}
                              {ssGroup && (
                                <div
                                  className={cn(
                                    "absolute top-1 left-1 flex size-4.5 items-center justify-center rounded-md text-[8px] font-black uppercase",
                                    ssColor ? cn(ssColor.bg, ssColor.text) : "bg-primary/15 text-primary",
                                  )}
                                >
                                  {ssGroup}
                                  {ssPos}
                                </div>
                              )}
                              {/* Completion status badge on thumbnail */}
                              {isExCompleted ? (
                                <div className="absolute top-1 right-1 flex size-4.5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                                  <Check className="size-3" strokeWidth={3.5} />
                                </div>
                              ) : isExPartial ? (
                                <div className="absolute top-1 right-1 rounded-md bg-primary px-1 py-0.5 text-[8px] font-black leading-none text-primary-foreground shadow-xs">
                                  {exDone}/{exTotal}
                                </div>
                              ) : null}
                            </div>
                            <span
                              className={cn(
                                "text-[10px] font-black uppercase tracking-wider transition-colors",
                                active
                                  ? ssColor
                                    ? ssColor.text
                                    : "text-primary"
                                  : isExCompleted
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-muted-foreground",
                              )}
                            >
                              {idx + 1}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* EXERCISE MEDIA CARD WITH ACTIONS (Ver técnica / Cambiar / Rest Timer) */}
              <div className="group relative overflow-hidden rounded-3xl border border-border/80 bg-card shadow-lg ring-1 ring-primary/5 sm:rounded-[2rem] sm:shadow-xl">
                <button
                  type="button"
                  className="relative flex w-full flex-col outline-none overflow-hidden"
                  onClick={() => {
                    setSelectedExercise(currentExercise.exercises);
                    setDetailOpen(true);
                  }}
                >
                  <div className="relative aspect-[16/10] max-h-[210px] w-full bg-muted/20 sm:aspect-[16/10] sm:max-h-[280px] lg:aspect-4/3 lg:max-h-[360px]">
                    <ExerciseMedia
                      src={currentExercise.exercises?.gif_url}
                      fallbackSrc={currentExercise.exercises?.image_url}
                      alt={exName(currentExercise.exercises)}
                      variant="fill"
                      className="absolute inset-0 size-full transition-transform duration-700 group-hover:scale-105"
                      imgClassName="object-contain p-2 pb-12 sm:p-4 sm:pb-14"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent pointer-events-none" />
                  </div>
                </button>

                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-stretch gap-1.5 sm:bottom-3.5 sm:left-3.5 sm:right-3.5 sm:gap-2">
                  <button
                    type="button"
                    className={MEDIA_ACTION_CLASS}
                    onClick={() => {
                      setSelectedExercise(currentExercise.exercises);
                      setDetailOpen(true);
                    }}
                  >
                    <PlayCircle className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="truncate">Técnica</span>
                  </button>

                  {clientRoutineId && currentExercise.exercises && (
                    <button
                      type="button"
                      className={MEDIA_ACTION_CLASS}
                      onClick={() => setSwapOpen(true)}
                    >
                      <RefreshCw className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="truncate">Cambiar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => startManualRest(restSeconds)}
                    aria-label={`Iniciar descanso sugerido de ${restSeconds} segundos`}
                    title="Iniciar temporizador de descanso manual"
                    className={MEDIA_ACTION_CLASS}
                  >
                    <Timer className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="truncate">Descanso</span>
                    <span className="hidden shrink-0 font-bold tabular-nums text-muted-foreground normal-case sm:inline">
                      {restSeconds}s
                    </span>
                  </button>
                </div>
              </div>

              {/* Desktop-only session note (on mobile it sits below sets so sets stay above the fold) */}
              <div className="hidden lg:block">
                <Textarea
                  value={workoutNote}
                  onChange={(e) => setWorkoutNote(e.target.value)}
                  placeholder="Nota del entreno (opcional). ¿Cómo te has sentido?"
                  className="min-h-[72px] w-full rounded-2xl text-sm"
                  maxLength={2000}
                  aria-label="Notas del entrenamiento"
                />
              </div>
            </div>

            {/* RIGHT COLUMN: Active Exercise Header + Prescriptions + Sets + Navigation */}
            <div className="flex w-full min-w-0 flex-col gap-3.5 sm:gap-5 lg:col-span-7 lg:self-start lg:pt-1">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="size-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                    {allSetsCompleted ? "Ejercicio Completado" : "En Curso"}
                  </span>
                  {currentExercise.is_overridden && (
                    <Badge
                      variant="outline"
                      className="rounded-full border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary"
                    >
                      Intercambiado
                    </Badge>
                  )}
                  {isInSuperset && currentSupersetColor && (
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                        currentSupersetColor.bg,
                        currentSupersetColor.text,
                      )}
                    >
                      <Link2 className="size-2.5" />
                      Biserie {currentSupersetGroup}
                      {currentSupersetPos}
                      {isLastOfSuperset && isFirstOfSuperset === false ? " — Última" : ""}
                    </div>
                  )}
                </div>

                <h2 className="text-balance text-lg font-black uppercase tracking-tight leading-snug sm:text-3xl">
                  {exName(currentExercise.exercises)}
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 whitespace-nowrap">
                    <p className="text-xs font-black text-primary whitespace-nowrap">
                      PLAN: {currentExercise.sets} × {currentExercise.reps || "VAR."}
                    </p>
                  </div>
                  {currentExercise.rpe ? (
                    <div className="inline-flex items-center gap-1 rounded-xl border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-black text-amber-600 dark:text-amber-400">
                      <Flame className="size-3.5" aria-hidden />
                      RPE {currentExercise.rpe}
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                    {completedSetsCount}/{currentSets.length} series listas
                  </div>
                  {!usesExternalLoad && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 italic">
                      Peso corporal / Repeticiones
                    </span>
                  )}
                </div>

                {currentExercise.notes ? (
                  <div className="mt-1 flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs text-foreground/90">
                    <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0">
                      <span className="font-black uppercase tracking-wider text-primary text-[10px] block">
                        Indicación del Coach
                      </span>
                      <p className="leading-relaxed text-muted-foreground">
                        {currentExercise.notes}
                      </p>
                    </div>
                  </div>
                ) : null}

                {currentExercise.warmup_sets ? (
                  <div className="mt-1 flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-foreground/90">
                    <Flame className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
                    <div className="min-w-0">
                      <span className="font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 text-[10px] block">
                        Series de aproximación sugeridas
                      </span>
                      <p className="leading-relaxed font-semibold text-amber-950 dark:text-amber-200">
                        {currentExercise.warmup_sets}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:gap-4">
                <div
                  className={cn(
                    "hidden items-end lg:grid lg:gap-4 lg:px-5",
                    usesExternalLoad
                      ? "lg:grid-cols-[2.75rem_5.5rem_1fr_1fr_3rem]"
                      : "lg:grid-cols-[2.75rem_5.5rem_1fr_3rem]",
                  )}
                  aria-hidden
                >
                  <span className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Serie
                  </span>
                  <span className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Previa
                  </span>
                  {usesExternalLoad ? (
                    <span className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Kg
                    </span>
                  ) : null}
                  <span className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Reps
                  </span>
                  <span className="sr-only">Acciones</span>
                </div>

                {currentSets.map((set, index) => {
                  const prescribedSets = Math.max(1, currentExercise.sets);
                  const canRemoveRow =
                    index >= prescribedSets &&
                    currentSets.length > prescribedSets;

                  return (
                    <Card
                      key={`${currentExercise.id}-${set.setNumber}-${index}`}
                      className={cn(
                        "group relative w-full max-w-full overflow-hidden transition-all duration-300 rounded-2xl sm:rounded-3xl border-border/80",
                        set.completed &&
                          (set.isPR
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-md shadow-primary/5"
                            : "border-emerald-500/40 bg-emerald-500/[0.03]"),
                      )}
                    >
                      <CardContent className="w-full max-w-full p-3.5 sm:p-5 lg:px-5">
                        {/* MÓVIL: COMPACT 2-COLUMN ERGONOMIC POD */}
                        <div className="flex flex-col gap-3 lg:hidden">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                              {/* Set number badge always keeps its setNumber so there is never a duplicate checkmark */}
                              <div
                                className={cn(
                                  "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-colors sm:size-11 sm:text-base",
                                  set.completed
                                    ? "bg-primary/15 text-primary border border-primary/30"
                                    : "bg-muted border border-border/60 text-muted-foreground",
                                )}
                              >
                                {set.setNumber}
                              </div>
                              <div className="flex min-w-0 flex-col">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <History className="size-3 text-muted-foreground/50 shrink-0" />
                                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 truncate">
                                    Meta anterior
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "text-sm font-black tabular-nums tracking-tight sm:text-base",
                                      set.completed ? "text-primary" : "text-foreground",
                                    )}
                                  >
                                    {previewLabel === "—" ? (
                                      <span className="text-xs text-muted-foreground/50 uppercase">
                                        Sin registros
                                      </span>
                                    ) : (
                                      previewLabel
                                    )}
                                  </span>
                                  {set.isPR && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary-foreground shadow-xs">
                                      <Trophy className="size-2.5" />
                                      PR
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              {canRemoveRow && !set.completed && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Eliminar serie"
                                  className="size-10 rounded-xl text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={() => removeSet(index)}
                                >
                                  <Trash2 className="size-4.5" />
                                </Button>
                              )}
                              <Button
                                variant={set.completed ? "default" : "outline"}
                                size="icon"
                                aria-label={
                                  set.completed ? "Desmarcar serie" : "Completar serie"
                                }
                                className={cn(
                                  "size-11 rounded-xl transition-all active:scale-90 sm:size-12",
                                  set.completed
                                    ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/25"
                                    : "border-primary/40 bg-primary text-primary-foreground shadow-md shadow-primary/20",
                                )}
                                onClick={() => completeSet(index)}
                              >
                                <Check className="size-5 sm:size-6" strokeWidth={3.5} />
                              </Button>
                            </div>
                          </div>

                          <div
                            className={cn(
                              "grid gap-2.5",
                              usesExternalLoad ? "grid-cols-2" : "grid-cols-1",
                            )}
                          >
                            {usesExternalLoad && (
                              <div className="flex min-w-0 flex-col gap-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">
                                  Carga (kg)
                                </label>
                                <div className="relative flex min-w-0 items-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Disminuir peso"
                                    className="absolute left-0.5 size-9 rounded-lg text-primary hover:bg-primary/10"
                                    onClick={() => updateSetValue(index, "weight", -2.5)}
                                    disabled={set.completed}
                                  >
                                    <Minus className="size-3.5" />
                                  </Button>
                                  <Input
                                    type="number"
                                    inputMode="decimal"
                                    aria-label="Peso en kilogramos"
                                    value={set.weight}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setSets((prev) => {
                                        const id = currentExercise.id.toString();
                                        const list = prev.get(id);
                                        if (!list) return prev;
                                        const copy = [...list];
                                        copy[index] = { ...copy[index], weight: val };
                                        return new Map(prev).set(id, copy);
                                      });
                                    }}
                                    className="h-11 min-w-0 w-full rounded-xl border-border/80 bg-muted/40 px-9 text-center text-base font-black tabular-nums transition-all focus:bg-background focus:ring-primary/20"
                                    disabled={set.completed}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Aumentar peso"
                                    className="absolute right-0.5 size-9 rounded-lg text-primary hover:bg-primary/10"
                                    onClick={() => updateSetValue(index, "weight", 2.5)}
                                    disabled={set.completed}
                                  >
                                    <Plus className="size-3.5" />
                                  </Button>
                                </div>
                              </div>
                            )}

                            <div className="flex min-w-0 flex-col gap-1">
                              <label className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">
                                Repeticiones
                              </label>
                              <div className="relative flex min-w-0 items-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Disminuir repeticiones"
                                  className="absolute left-0.5 size-9 rounded-lg text-primary hover:bg-primary/10"
                                  onClick={() => updateSetValue(index, "reps", -1)}
                                  disabled={set.completed}
                                >
                                  <Minus className="size-3.5" />
                                </Button>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  aria-label="Repeticiones"
                                  value={set.reps}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 1;
                                    setSets((prev) => {
                                      const id = currentExercise.id.toString();
                                      const list = prev.get(id);
                                      if (!list) return prev;
                                      const copy = [...list];
                                      copy[index] = { ...copy[index], reps: val };
                                      return new Map(prev).set(id, copy);
                                    });
                                  }}
                                  className="h-11 min-w-0 w-full rounded-xl border-border/80 bg-muted/40 px-9 text-center text-base font-black tabular-nums transition-all focus:bg-background focus:ring-primary/20"
                                  disabled={set.completed}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Aumentar repeticiones"
                                  className="absolute right-0.5 size-9 rounded-lg text-primary hover:bg-primary/10"
                                  onClick={() => updateSetValue(index, "reps", 1)}
                                  disabled={set.completed}
                                >
                                  <Plus className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* DESKTOP: ROW VIEW */}
                        <div
                          className={cn(
                            "hidden items-center lg:grid lg:gap-4",
                            usesExternalLoad
                              ? "lg:grid-cols-[2.75rem_5.5rem_1fr_1fr_3rem]"
                              : "lg:grid-cols-[2.75rem_5.5rem_1fr_3rem]",
                          )}
                        >
                          <div
                            className={cn(
                              "flex size-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black transition-all",
                              set.completed
                                ? "bg-primary/15 text-primary border border-primary/30"
                                : "bg-muted border border-border/50 text-muted-foreground",
                            )}
                          >
                            {set.setNumber}
                          </div>

                          <div className="flex flex-col items-center text-center">
                            <span className="text-lg font-black tabular-nums tracking-tight">
                              {previewLabel === "—" ? (
                                <span className="text-xs text-muted-foreground/40 uppercase">
                                  Sin registros
                                </span>
                              ) : (
                                previewLabel
                              )}
                            </span>
                          </div>

                          {usesExternalLoad && (
                            <div className="relative flex items-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Disminuir peso"
                                className="absolute left-1 size-10 rounded-lg text-primary hover:bg-primary/10"
                                onClick={() => updateSetValue(index, "weight", -2.5)}
                                disabled={set.completed}
                              >
                                <Minus className="size-5" />
                              </Button>
                              <Input
                                type="number"
                                inputMode="decimal"
                                aria-label="Peso en kilogramos"
                                value={set.weight}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setSets((prev) => {
                                    const id = currentExercise.id.toString();
                                    const list = prev.get(id);
                                    if (!list) return prev;
                                    const copy = [...list];
                                    copy[index] = { ...copy[index], weight: val };
                                    return new Map(prev).set(id, copy);
                                  });
                                }}
                                className="h-14 w-full rounded-2xl border-border/80 bg-muted/40 px-12 text-center text-xl font-black tabular-nums transition-all focus:bg-background focus:ring-primary/20"
                                disabled={set.completed}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Aumentar peso"
                                className="absolute right-1 size-10 rounded-lg text-primary hover:bg-primary/10"
                                onClick={() => updateSetValue(index, "weight", 2.5)}
                                disabled={set.completed}
                              >
                                <Plus className="size-5" />
                              </Button>
                            </div>
                          )}

                          <div className="relative flex items-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Disminuir repeticiones"
                              className="absolute left-1 size-10 rounded-lg text-primary hover:bg-primary/10"
                              onClick={() => updateSetValue(index, "reps", -1)}
                              disabled={set.completed}
                            >
                              <Minus className="size-5" />
                            </Button>
                            <Input
                              type="number"
                              inputMode="numeric"
                              aria-label="Repeticiones"
                              value={set.reps}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 1;
                                setSets((prev) => {
                                  const id = currentExercise.id.toString();
                                  const list = prev.get(id);
                                  if (!list) return prev;
                                  const copy = [...list];
                                  copy[index] = { ...copy[index], reps: val };
                                  return new Map(prev).set(id, copy);
                                });
                              }}
                              className="h-14 w-full rounded-2xl border-border/80 bg-muted/40 px-12 text-center text-xl font-black tabular-nums transition-all focus:bg-background focus:ring-primary/20"
                              disabled={set.completed}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Aumentar repeticiones"
                              className="absolute right-1 size-10 rounded-lg text-primary hover:bg-primary/10"
                              onClick={() => updateSetValue(index, "reps", 1)}
                              disabled={set.completed}
                            >
                              <Plus className="size-5" />
                            </Button>
                          </div>

                          <div className="flex items-center justify-end gap-1.5">
                            {canRemoveRow && !set.completed && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Eliminar serie"
                                className="size-9 rounded-xl text-muted-foreground hover:text-destructive transition-colors"
                                onClick={() => removeSet(index)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                            <Button
                              variant={set.completed ? "default" : "outline"}
                              size="icon"
                              aria-label={
                                set.completed ? "Desmarcar serie" : "Completar serie"
                              }
                              className={cn(
                                "size-12 rounded-2xl transition-all active:scale-90 shadow-md",
                                set.completed
                                  ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20"
                                  : "bg-primary text-primary-foreground border-primary/40 shadow-primary/20",
                              )}
                              onClick={() => completeSet(index)}
                            >
                              <Check className="size-6" strokeWidth={3.5} />
                            </Button>
                          </div>
                        </div>

                        {set.isPR && (
                          <div className="mt-3 hidden lg:flex items-center gap-3 rounded-2xl bg-primary/10 border border-primary/20 p-3 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                              <Trophy className="size-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                                ¡HISTÓRICO!
                              </span>
                              <span className="text-xs font-black tracking-tight leading-none uppercase">
                                Nuevo Récord Personal
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full gap-2 rounded-2xl font-bold"
                  onClick={addSet}
                >
                  <Plus className="h-4.5 w-4.5" aria-hidden />
                  Añadir serie
                </Button>
                {currentSets.length > Math.max(1, currentExercise.sets) ? (
                  <p className="px-0.5 text-center text-xs text-muted-foreground">
                    Las series extra muestran la papelera; no puedes bajar por
                    debajo del plan ({Math.max(1, currentExercise.sets)}{" "}
                    series).
                  </p>
                ) : null}
              </div>

              {/* Prev / Next Exercise Navigation Controls */}
              <div className="flex w-full min-w-0 items-center gap-2 pt-1 sm:gap-2.5">
                {currentExerciseIndex > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => requestGoToExercise(currentExerciseIndex - 1)}
                    className="h-12 shrink-0 rounded-2xl border-border/80 px-3.5 text-xs font-black uppercase tracking-wider sm:h-14 sm:px-5"
                  >
                    <ChevronLeft className="mr-1 size-4" />
                    Anterior
                  </Button>
                )}

                {currentExerciseIndex < exercises.length - 1 ? (
                  <Button
                    type="button"
                    variant={allSetsCompleted ? "default" : "outline"}
                    onClick={() =>
                      allSetsCompleted
                        ? nextExercise()
                        : requestGoToExercise(currentExerciseIndex + 1)
                    }
                    className={cn(
                      "h-12 min-w-0 flex-1 rounded-2xl px-3.5 text-xs font-black uppercase tracking-wider transition-all sm:h-14 sm:px-5 sm:text-sm sm:tracking-widest",
                      allSetsCompleted
                        ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-95"
                        : "border-border/80 text-foreground hover:bg-muted/60",
                    )}
                  >
                    <span className="truncate">Siguiente Ejercicio</span>
                    <ChevronRight className="ml-1 size-4.5 shrink-0 sm:ml-1.5 sm:size-5" strokeWidth={2.5} />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={requestFinishWorkout}
                    disabled={isFinishing}
                    className={cn(
                      "h-12 min-w-0 flex-1 rounded-2xl px-3.5 text-xs font-black uppercase tracking-wider transition-all sm:h-14 sm:px-5 sm:text-sm sm:tracking-widest",
                      allSetsCompleted
                        ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-95"
                        : "bg-primary/90 text-primary-foreground",
                    )}
                  >
                    <span className="truncate">
                      {isFinishing ? "Guardando…" : "Finalizar Entrenamiento"}
                    </span>
                    <Trophy className="ml-1.5 size-4.5 shrink-0 sm:ml-2 sm:size-5" />
                  </Button>
                )}
              </div>

              {/* Mobile Session Note (placed below sets so active exercise & sets stay above the fold) */}
              <div className="pt-2 lg:hidden">
                <Textarea
                  value={workoutNote}
                  onChange={(e) => setWorkoutNote(e.target.value)}
                  placeholder="Nota del entreno (opcional). ¿Cómo te has sentido hoy?"
                  className="min-h-[68px] w-full rounded-2xl text-sm"
                  maxLength={2000}
                  aria-label="Notas del entrenamiento"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Finish Workout & Effort / Feeling Score Dialog */}
      <Dialog open={finishModalOpen} onOpenChange={setFinishModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black tracking-tight">
              <Trophy className="size-5 text-primary" />
              Finalizar entrenamiento
            </DialogTitle>
            <DialogDescription>
              Revisa tu resumen y califica cómo sentiste la sesión para que tu coach ajuste tus cargas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            {/* Session KPIs */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3 text-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Series
                </p>
                <p className="mt-0.5 text-base font-black tabular-nums text-foreground">
                  {completedSessionSets}/{totalSessionSets}
                </p>
              </div>
              <div className="border-x border-border/50 px-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Volumen
                </p>
                <p className="mt-0.5 text-base font-black tabular-nums text-primary">
                  {totalSessionVolume.toLocaleString("es-MX")} kg
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Tiempo
                </p>
                <p className="mt-0.5 text-base font-black tabular-nums text-foreground">
                  {formatElapsed(elapsedSec)}
                </p>
              </div>
            </div>

            {completedSessionSets < totalSessionSets && (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                Tienes{" "}
                <span className="font-bold">
                  {totalSessionSets - completedSessionSets} serie(s)
                </span>{" "}
                sin marcar. Solo se registrarán las series completadas.
              </div>
            )}

            {/* Feeling Score 1-5 */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                ¿Cómo sentiste el entrenamiento hoy?
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { score: 1, label: "Ligero" },
                  { score: 2, label: "Bien" },
                  { score: 3, label: "Exigente" },
                  { score: 4, label: "Intenso" },
                  { score: 5, label: "Al límite" },
                ].map((opt) => {
                  const selected = feelingScore === opt.score;
                  return (
                    <button
                      key={opt.score}
                      type="button"
                      onClick={() => setFeelingScore(opt.score)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 px-1 transition-all",
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25 scale-[1.02]"
                          : "border-border/60 bg-card hover:bg-muted/40 text-foreground",
                      )}
                    >
                      <span className="text-sm font-black tabular-nums">
                        {opt.score}
                      </span>
                      <span className="text-[9px] font-bold leading-tight text-center">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Session Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Nota para tu coach (opcional)
              </label>
              <Textarea
                value={workoutNote}
                onChange={(e) => setWorkoutNote(e.target.value)}
                placeholder="¿Algún comentario sobre energía, técnica o cargas de hoy?"
                className="min-h-[68px] rounded-xl text-sm"
                maxLength={2000}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFinishModalOpen(false)}
              disabled={isFinishing}
              className="rounded-xl font-bold"
            >
              Seguir entrenando
            </Button>
            <Button
              type="button"
              onClick={finishWorkout}
              disabled={isFinishing}
              className="rounded-xl font-black uppercase tracking-wider bg-primary text-primary-foreground"
            >
              {isFinishing ? "Guardando…" : "Confirmar y guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExerciseDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        exercise={selectedExercise}
        variant="compact"
      />

      {clientRoutineId && currentExercise?.exercises && (
        <ExerciseSwapDrawer
          open={swapOpen}
          onOpenChange={setSwapOpen}
          clientRoutineId={clientRoutineId}
          originalRoutineExerciseId={Number(currentExercise.id)}
          originalExercise={currentExercise.exercises as Exercise}
          onSwapped={() => {
            const id = currentExercise.id.toString();
            setSets((prev) => {
              const list = prev.get(id);
              if (list && list.some((s) => s.completed)) return prev;
              const next = new Map(prev);
              next.delete(id);
              return next;
            });
            router.refresh();
          }}
        />
      )}

      <AchievementUnlockModal
        achievements={newlyUnlocked}
        onClose={() => {
          const sessionId = sessionStorage.getItem("last_session_id");
          setNewlyUnlocked([]);
          if (sessionId) {
            router.push(`/client/workout/summary?sessionId=${sessionId}`);
          }
        }}
      />
    </div>
  );
}
