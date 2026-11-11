"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  ClipboardList,
  Moon,
  Sparkles,
  Lightbulb,
  Loader2,
  ClipboardCopy,
  ClipboardPaste,
  Link2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import {
  getRoutineMeta,
  saveRoutineFromBuilder,
  updateRoutineFromBuilder,
} from "@/app/actions/routine-builder";
import { getExercisesForSelector } from "@/app/actions/exercises";
import { toast } from "sonner";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

import { ExerciseSelectorDrawer } from "@/components/admin/exercises/exercise-selector-drawer";
import { SortableExercise } from "@/components/admin/exercises/sortable-exercise";
import { ExerciseDetailDrawer } from "@/components/client/exercise-detail-drawer";
import { Exercise } from "@/lib/types";
import { getCachedExercises, setCachedExercises } from "@/lib/local-cache";
import { normalizeRoutineLevel } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Target, Infinity as InfinityIcon, Activity } from "lucide-react";
import { WeeklyMuscleCoverage } from "@/components/anatomy/weekly-muscle-coverage";
import { computeRoutineMuscleVolume } from "@/lib/anatomy/muscles";

interface DayExercise {
  id: string;
  exerciseId: string;
  sets: number;
  reps: string;
  restSeconds: number;
  supersetGroup: string | null;
  notes?: string;
  warmupSets?: string;
}

interface Day {
  id: string;
  dayNumber: number;
  name: string;
  focus?: string;
  isRestDay: boolean;
  exercises: DayExercise[];
}

interface RoutineDraft {
  name: string;
  description: string;
  durationWeeks: number | null;
  isContinuous?: boolean;
  goal: string;
  level: string;
  days: Day[];
  updatedAt: number;
}

const DAY_NAMES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

const SHORT_DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Letras disponibles para grupos de biserie
const SUPERSET_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const ROUTINE_GOALS = [
  { value: "muscle_gain", label: "Ganancia muscular" },
  { value: "weight_loss", label: "Pérdida de grasa" },
  { value: "toning", label: "Fuerza / Tonificación" },
  { value: "endurance", label: "Resistencia" },
  { value: "maintenance", label: "Mantenimiento" },
];

const ROUTINE_LEVELS = [
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzado" },
];

export interface RoutineBuilderClientProps {
  exercises?: Exercise[];
  routineId?: string;
  initialData?: {
    name: string;
    description: string;
    durationWeeks?: number | null;
    goal?: string | null;
    level?: string | null;
    days: Day[];
  };
}

const EMPTY_EXERCISES: Exercise[] = [];

export function RoutineBuilderClient({
  exercises: initialExercises = EMPTY_EXERCISES,
  routineId,
  initialData,
}: RoutineBuilderClientProps) {
  const router = useRouter();
  const draftStorageKey = `ru-routine-builder-draft-${routineId || "new"}`;

  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);
  const [loadingExercises, setLoadingExercises] = useState(
    initialExercises.length === 0,
  );

  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? "",
  );
  const [isContinuous, setIsContinuous] = useState(
    initialData?.durationWeeks === null,
  );
  const [durationWeeks, setDurationWeeks] = useState(
    initialData?.durationWeeks && initialData.durationWeeks > 0
      ? initialData.durationWeeks
      : 4,
  );
  const [goal, setGoal] = useState(initialData?.goal ?? "");
  const [level, setLevel] = useState<string>(
    normalizeRoutineLevel(initialData?.level) || initialData?.level || "",
  );
  const [days, setDays] = useState<Day[]>(
    initialData?.days ??
      DAY_NAMES.map((name, i) => ({
        id: String(i + 1),
        dayNumber: i + 1,
        name,
        focus: "",
        isRestDay: [5, 6].includes(i),
        exercises: [],
      })),
  );
  const [saving, setSaving] = useState(false);

  const [pendingDraft, setPendingDraft] = useState<RoutineDraft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [inspectedExercise, setInspectedExercise] = useState<Exercise | null>(
    null,
  );

  // Portapapeles para copiar/pegar días
  const [clipboard, setClipboard] = useState<{
    sourceDayName: string;
    focus?: string;
    exercises: DayExercise[];
  } | null>(null);

  // Detectar borrador guardado al abrir el builder
  useEffect(() => {
    try {
      if (!routineId) {
        const raw = localStorage.getItem(draftStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as RoutineDraft;
          const hasDraftContent =
            Boolean(parsed?.name?.trim()) ||
            (Array.isArray(parsed?.days) &&
              parsed.days.some(
                (d) =>
                  !d.isRestDay &&
                  Array.isArray(d.exercises) &&
                  d.exercises.length > 0,
              ));
          if (hasDraftContent) {
            setPendingDraft(parsed);
          }
        }
      }
    } catch {
      // Ignore storage access errors
    } finally {
      setDraftChecked(true);
    }
  }, [routineId, draftStorageKey]);

  // Auto-guardar borrador en localStorage al editar
  useEffect(() => {
    if (!draftChecked) return;
    const hasContent =
      Boolean(name.trim()) ||
      Boolean(description.trim()) ||
      Boolean(goal) ||
      Boolean(level) ||
      days.some((d) => !d.isRestDay && d.exercises.length > 0);

    // Si hay un borrador pendiente de restaurar y el usuario aún no ha escrito nada nuevo, no sobrescribirlo
    if (pendingDraft && !hasContent) return;

    if (!hasContent) return;

    try {
      const payload: RoutineDraft = {
        name,
        description,
        durationWeeks: isContinuous ? null : durationWeeks,
        isContinuous,
        goal,
        level,
        days,
        updatedAt: Date.now(),
      };
      localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    } catch {
      // Ignore quota or private mode errors
    }
  }, [
    draftChecked,
    pendingDraft,
    draftStorageKey,
    name,
    description,
    durationWeeks,
    isContinuous,
    goal,
    level,
    days,
  ]);

  const handleRestoreDraft = () => {
    if (!pendingDraft) return;
    setName(pendingDraft.name ?? "");
    setDescription(pendingDraft.description ?? "");
    const draftContinuous =
      pendingDraft.isContinuous ?? pendingDraft.durationWeeks === null;
    setIsContinuous(draftContinuous);
    setDurationWeeks(
      pendingDraft.durationWeeks && pendingDraft.durationWeeks > 0
        ? pendingDraft.durationWeeks
        : 4,
    );
    setGoal(pendingDraft.goal ?? "");
    setLevel(
      normalizeRoutineLevel(pendingDraft.level) || pendingDraft.level || "",
    );
    if (Array.isArray(pendingDraft.days) && pendingDraft.days.length > 0) {
      setDays(pendingDraft.days);
    }
    setPendingDraft(null);
    toast.success("Borrador restaurado.");
  };

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // Ignore storage errors
    }
    setPendingDraft(null);
    toast.info("Borrador descartado.");
  };

  useEffect(() => {
    if (
      routineId &&
      initialData?.goal === undefined &&
      initialData?.level === undefined
    ) {
      getRoutineMeta(routineId)
        .then((meta) => {
          if (meta) {
            if (meta.goal) setGoal(meta.goal);
            if (meta.level) {
              setLevel(normalizeRoutineLevel(meta.level) || meta.level);
            }
          }
        })
        .catch(() => {});
    }
  }, [routineId, initialData?.goal, initialData?.level]);

  // Fetch exercises on client with IndexedDB cache fallback for zero-latency loading
  useEffect(() => {
    let isMounted = true;
    async function loadExercises() {
      if (initialExercises.length > 0) return;

      // 1. Intento de carga instantánea desde IndexedDB (<15ms)
      try {
        const cached = await getCachedExercises();
        if (cached && cached.length > 0 && isMounted) {
          setExercises(cached as Exercise[]);
          setLoadingExercises(false);
        }
      } catch {
        // Ignorar error de lectura de caché local
      }

      // 2. Sincronización en segundo plano con el servidor
      try {
        const data = await getExercisesForSelector();
        if (isMounted) {
          setExercises(data as Exercise[]);
          setLoadingExercises(false);
          await setCachedExercises(data as Exercise[]);
        }
      } catch (err) {
        console.error("Error loading exercises", err);
        if (isMounted) {
          setExercises((prev) => {
            if (prev.length === 0) {
              toast.error("No pudimos cargar el catálogo de ejercicios.");
            }
            return prev;
          });
          setLoadingExercises(false);
        }
      }
    }

    loadExercises();
    return () => {
      isMounted = false;
    };
  }, [initialExercises]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent, dayId: string) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDays((prev) =>
        prev.map((d) => {
          if (d.id === dayId) {
            const oldIndex = d.exercises.findIndex((ex) => ex.id === active.id);
            const newIndex = d.exercises.findIndex((ex) => ex.id === over.id);
            return {
              ...d,
              exercises: arrayMove(d.exercises, oldIndex, newIndex),
            };
          }
          return d;
        }),
      );
    }
  };

  const handleOpenSelector = (dayId: string) => {
    setActiveDayId(dayId);
    setSelectorOpen(true);
  };

  const handleSelectExercises = (selectedIds: string[]) => {
    if (!activeDayId) return;
    setDays((prev) =>
      prev.map((d) =>
        d.id === activeDayId
          ? {
              ...d,
              exercises: [
                ...d.exercises,
                ...selectedIds.map((exId) => ({
                  id: crypto.randomUUID(),
                  exerciseId: exId,
                  sets: 3,
                  reps: "10-12",
                  restSeconds: 60,
                  supersetGroup: null,
                  notes: "",
                  warmupSets: "",
                })),
              ],
            }
          : d,
      ),
    );
    setSelectorOpen(false);
    setActiveDayId(null);
  };

  const setDayKind = (dayId: string, kind: "train" | "rest") => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const nextRest = kind === "rest";
        if (d.isRestDay === nextRest) return d;
        return {
          ...d,
          isRestDay: nextRest,
          exercises: nextRest ? [] : d.exercises,
        };
      }),
    );
  };

  const updateDayFocus = (dayId: string, focus: string) => {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, focus } : d)),
    );
  };

  const updateExercise = (
    dayId: string,
    exId: string,
    field: string,
    value: string | number,
  ) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((ex) =>
                ex.id === exId ? { ...ex, [field]: value } : ex,
              ),
            }
          : d,
      ),
    );
  };

  const removeExercise = (dayId: string, exId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.filter((ex) => ex.id !== exId) }
          : d,
      ),
    );
  };

  const moveExercise = (dayId: string, index: number, direction: -1 | 1) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= d.exercises.length) return d;
        return {
          ...d,
          exercises: arrayMove(d.exercises, index, nextIndex),
        };
      }),
    );
  };

  const duplicateExercise = (dayId: string, exId: string) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const idx = d.exercises.findIndex((ex) => ex.id === exId);
        if (idx < 0) return d;
        const source = d.exercises[idx];
        const copy: DayExercise = {
          ...source,
          id: crypto.randomUUID(),
        };
        const nextExercises = [...d.exercises];
        nextExercises.splice(idx + 1, 0, copy);
        return {
          ...d,
          exercises: nextExercises,
        };
      }),
    );
    toast.success("Ejercicio duplicado.");
  };

  /**
   * Manejo de biseries:
   * - Calcula el siguiente grupo libre para el día
   * - Asigna el grupo al ejercicio actual con el ejercicio anterior
   *   (si el anterior ya tiene grupo, usa el mismo; si no, crea uno nuevo)
   */
  const handleToggleSuperset = useCallback(
    (dayId: string, exId: string) => {
      setDays((prev) =>
        prev.map((d) => {
          if (d.id !== dayId) return d;

          const idx = d.exercises.findIndex((ex) => ex.id === exId);
          if (idx < 0) return d;

          // Grupos en uso en este día
          const usedGroups = new Set(
            d.exercises.map((ex) => ex.supersetGroup).filter(Boolean),
          );

          // Si el ejercicio anterior ya tiene grupo, unir al mismo
          const prevEx = idx > 0 ? d.exercises[idx - 1] : null;
          let targetGroup: string;

          if (prevEx?.supersetGroup) {
            targetGroup = prevEx.supersetGroup;
          } else {
            // Encontrar la primera letra no usada
            targetGroup =
              SUPERSET_LETTERS.find((l) => !usedGroups.has(l)) ?? "A";
          }

          const updated = d.exercises.map((ex, i) => {
            if (i === idx) return { ...ex, supersetGroup: targetGroup };
            // Si el ejercicio anterior no tiene grupo, asignarlo también
            if (i === idx - 1 && !prevEx?.supersetGroup) {
              return { ...ex, supersetGroup: targetGroup };
            }
            return ex;
          });

          return { ...d, exercises: updated };
        }),
      );
    },
    [],
  );

  const handleRemoveSuperset = useCallback((dayId: string, exId: string) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const ex = d.exercises.find((e) => e.id === exId);
        const group = ex?.supersetGroup;

        // Si solo hay 2 ejercicios en el grupo, desasignar ambos
        const groupCount = d.exercises.filter(
          (e) => e.supersetGroup === group,
        ).length;

        const updated = d.exercises.map((e) => {
          if (e.id === exId) return { ...e, supersetGroup: null };
          if (groupCount <= 2 && e.supersetGroup === group)
            return { ...e, supersetGroup: null };
          return e;
        });

        return { ...d, exercises: updated };
      }),
    );
  }, []);

  // ── Copiar/pegar días ──────────────────────────────────────
  const handleCopyDay = (day: Day) => {
    setClipboard({
      sourceDayName: day.name,
      focus: day.focus,
      exercises: day.exercises.map((ex) => ({ ...ex })),
    });
    toast.success(`Día "${day.name}" copiado. Pégalo en otro día.`);
  };

  const handlePasteDay = (targetDayId: string) => {
    if (!clipboard) return;
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== targetDayId) return d;
        // Re-asignar IDs nuevos para evitar colisiones
        const newExercises = clipboard.exercises.map((ex) => ({
          ...ex,
          id: crypto.randomUUID(),
        }));
        return {
          ...d,
          isRestDay: false,
          focus: d.focus?.trim() ? d.focus : clipboard.focus ?? "",
          exercises: [...d.exercises, ...newExercises],
        };
      }),
    );
    toast.success(
      `Ejercicios de "${clipboard.sourceDayName}" pegados.`,
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Escribe un nombre para la rutina.");
      return;
    }

    const daysWithExercises = days.filter(
      (d) => !d.isRestDay && d.exercises.length > 0,
    );
    if (daysWithExercises.length === 0) {
      toast.error("Agrega al menos un ejercicio en un día de entrenamiento.");
      return;
    }

    const hasEmptyReps = daysWithExercises.some((d) =>
      d.exercises.some((ex) => !ex.reps?.trim()),
    );
    if (hasEmptyReps) {
      toast.error(
        "Completa el objetivo o repeticiones de cada ejercicio antes de guardar.",
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        duration_weeks: isContinuous ? null : durationWeeks,
        goal: goal || null,
        level: normalizeRoutineLevel(level) || level || null,
        days: days.map((d) => ({
          day_number: d.dayNumber,
          day_name: d.name,
          focus: d.focus?.trim() || null,
          is_rest_day: d.isRestDay,
          exercises: d.exercises.map((ex, i) => ({
            exercise_id: ex.exerciseId,
            order_index: i,
            sets: ex.sets,
            reps: ex.reps.trim(),
            rest_seconds: ex.restSeconds,
            superset_group: ex.supersetGroup ?? null,
            notes: ex.notes?.trim() || null,
            warmup_sets: ex.warmupSets?.trim() || null,
          })),
        })),
      };

      if (routineId) {
        await updateRoutineFromBuilder(routineId, payload);
        try {
          localStorage.removeItem(draftStorageKey);
        } catch {}
        toast.success("Rutina actualizada.");
        router.push(`/admin/routines/${routineId}`);
      } else {
        const id = await saveRoutineFromBuilder(payload);
        try {
          localStorage.removeItem(draftStorageKey);
        } catch {}
        toast.success("Rutina creada.");
        router.push(`/admin/routines/${id}`);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "No pudimos guardar. Revisa los datos e inténtalo de nuevo.";
      toast.error("Error al guardar la rutina", {
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  const trainingDays = days.filter((d) => !d.isRestDay).length;
  const restDays = days.filter((d) => d.isRestDay).length;
  const totalWeeklySets = days.reduce(
    (acc, d) =>
      acc +
      (d.isRestDay
        ? 0
        : d.exercises.reduce((s, ex) => s + (Number(ex.sets) || 0), 0)),
    0,
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 pb-28 lg:pb-10">
      {!loadingExercises && exercises.length === 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4">
          <Card className="w-full max-w-md rounded-xl border shadow-sm">
            <CardHeader>
              <CardTitle className="text-destructive">
                Sin ejercicios en la base
              </CardTitle>
              <CardDescription>
                Ejecuta el seed de ejercicios o revisa la tabla{" "}
                <code className="text-xs">exercises</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => router.push("/admin/routines")}
              >
                Volver a rutinas
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {pendingDraft && !routineId && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <RotateCcw className="size-4" aria-hidden />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-foreground">
                Tienes un borrador sin guardar
                {pendingDraft.name?.trim() ? `: "${pendingDraft.name.trim()}"` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Recupera el progreso guardado automáticamente en este dispositivo o descártalo para empezar de cero.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="default"
              className="rounded-xl gap-1.5"
              onClick={handleRestoreDraft}
            >
              <RotateCcw className="size-3.5" />
              Restaurar borrador
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-xl gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={handleDiscardDraft}
            >
              <Trash2 className="size-3.5" />
              Descartar
            </Button>
          </div>
        </div>
      )}

      <Alert className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-5 shadow-sm">
        <Lightbulb className="size-4 text-primary mt-0.5" aria-hidden />
        <AlertTitle className="text-sm font-bold tracking-tight text-primary mb-2">
          Flujo rápido
        </AlertTitle>
        <AlertDescription className="w-full text-[13px] leading-relaxed text-muted-foreground">
          <ol className="flex flex-col gap-2 w-full">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                1
              </span>
              <span>
                Escribe el <strong className="font-semibold text-foreground">nombre</strong>, duración, objetivo y nivel de la rutina.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                2
              </span>
              <span>
                Marca cada día de la semana como <strong className="font-semibold text-foreground">Entreno</strong> o <strong className="font-semibold text-foreground">Descanso</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                3
              </span>
              <span>
                Añade ejercicios, arrastra para ordenar y usa{" "}
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-foreground align-baseline">
                  <Link2 className="size-3.5 text-primary shrink-0" aria-hidden />
                  Enlazar
                </span>{" "}
                para crear biseries de ejercicios.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                4
              </span>
              <span>
                Duplica días completos fácilmente con{" "}
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-foreground align-baseline">
                  <ClipboardCopy className="size-3.5 text-primary shrink-0" aria-hidden />
                  Copiar
                </span>{" "}
                y{" "}
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-foreground align-baseline">
                  <ClipboardPaste className="size-3.5 text-primary shrink-0" aria-hidden />
                  Pegar
                </span>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                5
              </span>
              <span>
                Haz clic en <strong className="font-semibold text-foreground">Guardar rutina</strong> al finalizar.
              </span>
            </li>
          </ol>
        </AlertDescription>
      </Alert>

      <Card className="overflow-hidden rounded-2xl border-border/50 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] bg-card/95 backdrop-blur-sm">
        <CardHeader className="gap-2 px-6 pb-2 pt-6">
          <div className="flex items-center gap-3.5">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-primary/20 to-primary/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-primary/20 text-primary"
              aria-hidden
            >
              <ClipboardList className="size-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg font-bold tracking-tight sm:text-xl">
                Datos de la rutina
              </CardTitle>
              <CardDescription className="text-sm">
                Nombre, duración y notas para tu plan semanal.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col px-6 pb-6 pt-4">
          <FieldGroup className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-x-8 md:gap-y-6">
            <Field className="md:col-span-7 gap-1.5">
              <FieldLabel htmlFor="routine-name" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Nombre de la rutina
              </FieldLabel>
              <Input
                id="routine-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Hipertrofia — tren superior"
                className="h-11 rounded-xl bg-muted/30 focus-visible:bg-background shadow-xs border-border/60 transition-colors"
              />
            </Field>
            <Field className="md:col-span-5 gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="routine-duration" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Vigencia / Duración
                </FieldLabel>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-primary select-none">
                  <Switch
                    id="routine-continuous-toggle"
                    checked={isContinuous}
                    onCheckedChange={(checked) => setIsContinuous(checked)}
                    className="scale-75 data-[state=checked]:bg-primary"
                  />
                  <span>Continua (según membresía)</span>
                </label>
              </div>
              {isContinuous ? (
                <div className="flex h-11 items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3.5 text-xs font-medium text-foreground">
                  <InfinityIcon className="size-4 shrink-0 text-primary" />
                  <span className="truncate">Vigencia ligada al pago activo del cliente</span>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    id="routine-duration"
                    type="number"
                    inputMode="numeric"
                    value={durationWeeks}
                    onChange={(e) =>
                      setDurationWeeks(Math.max(1, Number(e.target.value) || 1))
                    }
                    min={1}
                    placeholder="Semanas fijas"
                    className="h-11 rounded-xl pr-20 text-left tabular-nums bg-muted/30 focus-visible:bg-background shadow-xs border-border/60 transition-colors"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    semanas
                  </span>
                </div>
              )}
            </Field>
            <Field className="md:col-span-6 gap-1.5">
              <FieldLabel htmlFor="routine-goal" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Objetivo
              </FieldLabel>
              <Select value={goal} onValueChange={setGoal}>
                <SelectTrigger
                  id="routine-goal"
                  className="h-11 w-full rounded-xl bg-muted/30 focus-visible:bg-background shadow-xs border-border/60"
                >
                  <SelectValue placeholder="Seleccionar objetivo..." />
                </SelectTrigger>
                <SelectContent>
                  {ROUTINE_GOALS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-6 gap-1.5">
              <FieldLabel htmlFor="routine-level" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Nivel
              </FieldLabel>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger
                  id="routine-level"
                  className="h-11 w-full rounded-xl bg-muted/30 focus-visible:bg-background shadow-xs border-border/60"
                >
                  <SelectValue placeholder="Seleccionar nivel..." />
                </SelectTrigger>
                <SelectContent>
                  {ROUTINE_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-12 gap-1.5">
              <FieldLabel htmlFor="routine-desc" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Descripción (opcional)
              </FieldLabel>
              <Textarea
                id="routine-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Objetivo, progresión o recordatorios para el cliente…"
                className="min-h-[88px] resize-none py-3 rounded-xl md:text-sm bg-muted/30 focus-visible:bg-background shadow-xs border-border/60 transition-colors"
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                Tu semana
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Activa o desactiva cada día. Usa{" "}
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <ClipboardCopy className="size-3" /> Copiar
              </span>{" "}
              y{" "}
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <ClipboardPaste className="size-3" /> Pegar
              </span>{" "}
              para duplicar días.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {clipboard && (
              <Badge
                variant="outline"
                className="animate-pulse rounded-full border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-400"
              >
                <ClipboardCopy className="mr-1.5 size-3" />
                &quot;{clipboard.sourceDayName}&quot; en portapapeles
              </Badge>
            )}
            <Badge
              variant="secondary"
              className="w-fit rounded-full px-3 py-1 text-xs font-medium"
            >
              {trainingDays} entreno{trainingDays !== 1 ? "s" : ""} ·{" "}
              {restDays} descanso{restDays !== 1 ? "s" : ""}
            </Badge>
            {totalWeeklySets > 0 && (
              <Badge
                variant="outline"
                className="w-fit rounded-full border-primary/25 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary"
              >
                {totalWeeklySets} series / sem
              </Badge>
            )}
          </div>
        </div>

        {/* Barra de salto rápido por día */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {days.map((day, idx) => {
            const shortLabel =
              SHORT_DAY_NAMES[day.dayNumber - 1] ??
              SHORT_DAY_NAMES[idx] ??
              day.name.slice(0, 3);
            const hasExercises = !day.isRestDay && day.exercises.length > 0;
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => {
                  document
                    .getElementById(`builder-day-${day.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-all active:scale-95",
                  day.isRestDay
                    ? "border-dashed border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                    : hasExercises
                      ? "border-primary/30 bg-primary/10 text-primary shadow-2xs hover:bg-primary/15"
                      : "border-border bg-card text-foreground hover:border-primary/30",
                )}
                title={`Ir a ${day.name}`}
              >
                <span>{shortLabel}</span>
                {day.isRestDay ? (
                  <Moon className="size-3 opacity-70" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                      hasExercises
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {day.exercises.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Separator />

        <div className="flex flex-col gap-5">
          {days.map((day) => {
            const selectorActive = selectorOpen && activeDayId === day.id;
            const dayTotalSets = day.exercises.reduce(
              (acc, ex) => acc + (Number(ex.sets) || 0),
              0,
            );
            return (
              <Card
                key={day.id}
                id={`builder-day-${day.id}`}
                className={cn(
                  "scroll-mt-28 overflow-hidden rounded-xl border shadow-sm transition-[border-color,box-shadow,background-color] duration-200",
                  day.isRestDay
                    ? "border-dashed border-muted-foreground/25 bg-muted/15"
                    : "border-border bg-card",
                  !day.isRestDay &&
                    "hover:border-primary/25 hover:shadow-md focus-within:border-primary/30",
                  !day.isRestDay &&
                    selectorActive &&
                    "border-primary/40 shadow-md ring-2 ring-ring/40",
                )}
              >
                <CardHeader className="flex flex-col gap-4 px-5 pb-4 pt-5 sm:px-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold tabular-nums",
                          day.isRestDay
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary text-primary-foreground",
                        )}
                        aria-hidden
                      >
                        {day.isRestDay ? (
                          <Moon className="size-5" />
                        ) : (
                          day.dayNumber
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base font-semibold sm:text-lg">
                            {day.name}
                          </CardTitle>
                          {!day.isRestDay && day.exercises.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            >
                              {day.exercises.length} ej. · {dayTotalSets} series
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs sm:text-sm">
                          {day.isRestDay
                            ? "Día de recuperación — sin ejercicios."
                            : "Construye la sesión: ordena los ejercicios con las flechas o arrastrando."}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                      {/* Botones copiar/pegar */}
                      {!day.isRestDay && day.exercises.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 gap-2 rounded-xl border border-border/50 px-3 text-xs font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          onClick={() => handleCopyDay(day)}
                        >
                          <ClipboardCopy className="size-3.5" />
                          Copiar día
                        </Button>
                      )}
                      {clipboard && !day.isRestDay && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 gap-2 rounded-xl border border-violet-500/30 bg-violet-500/5 px-3 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-500/15"
                          onClick={() => handlePasteDay(day.id)}
                        >
                          <ClipboardPaste className="size-3.5" />
                          Pegar aquí
                        </Button>
                      )}

                      <label
                        htmlFor={`day-kind-switch-${day.id}`}
                        className={cn(
                          "flex w-full cursor-pointer flex-row items-center justify-between gap-6 rounded-xl border p-3 shadow-sm transition-colors hover:bg-muted/20 sm:w-auto sm:px-4",
                          day.isRestDay
                            ? "border-border/50 bg-muted/10"
                            : "border-primary/20 bg-primary/5 hover:bg-primary/10",
                        )}
                      >
                        <div className="flex flex-col gap-0.5 pointer-events-none">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-right">
                            Tipo de día
                          </p>
                          <span
                            className={cn(
                              "text-sm font-semibold transition-colors",
                              day.isRestDay
                                ? "text-muted-foreground"
                                : "text-primary",
                            )}
                          >
                            {day.isRestDay ? "Descanso" : "Entreno"}
                          </span>
                        </div>
                        <Switch
                          id={`day-kind-switch-${day.id}`}
                          checked={!day.isRestDay}
                          onCheckedChange={(checked) =>
                            setDayKind(day.id, checked ? "train" : "rest")
                          }
                          aria-label="Alternar tipo de día"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Enfoque muscular del día */}
                  {!day.isRestDay && (
                    <div className="relative flex items-center">
                      <Target
                        className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        value={day.focus ?? ""}
                        onChange={(e) => updateDayFocus(day.id, e.target.value)}
                        placeholder="Enfoque del día (opcional, ej. Empuje · Pecho, Hombro y Tríceps)..."
                        aria-label={`Enfoque del día ${day.name}`}
                        className="h-10 rounded-xl border-border/60 bg-muted/25 pl-10 text-sm focus-visible:bg-background"
                      />
                    </div>
                  )}
                </CardHeader>

                {!day.isRestDay && (
                  <CardContent className="flex flex-col gap-4 px-5 pb-6 pt-0 sm:px-6">
                    {day.exercises.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          Aún no hay ejercicios este día. Pulsa{" "}
                          <span className="font-medium text-foreground">
                            Añadir ejercicios
                          </span>{" "}
                          y elige del catálogo.
                          {clipboard && (
                            <span className="mt-2 block">
                              O usa{" "}
                              <button
                                type="button"
                                className="font-semibold text-violet-600 dark:text-violet-400 underline underline-offset-2"
                                onClick={() => handlePasteDay(day.id)}
                              >
                                Pegar ejercicios de &quot;{clipboard.sourceDayName}&quot;
                              </button>
                              .
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {day.exercises.length > 0 && (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, day.id)}
                        modifiers={[restrictToVerticalAxis]}
                      >
                        <SortableContext
                          items={day.exercises.map((ex) => ex.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="flex flex-col gap-3">
                            {day.exercises.map((ex, idx) => {
                              const exerciseInfo = exercises.find(
                                (e) => e.id === ex.exerciseId,
                              );
                              return (
                                <SortableExercise
                                  key={ex.id}
                                  id={ex.id}
                                  dayId={day.id}
                                  exerciseId={ex.exerciseId}
                                  sets={ex.sets}
                                  reps={ex.reps}
                                  restSeconds={ex.restSeconds}
                                  supersetGroup={ex.supersetGroup}
                                  notes={ex.notes}
                                  warmupSets={ex.warmupSets}
                                  exerciseInfo={exerciseInfo}
                                  canMoveUp={idx > 0}
                                  canMoveDown={idx < day.exercises.length - 1}
                                  onUpdate={(field, value) =>
                                    updateExercise(day.id, ex.id, field, value)
                                  }
                                  onRemove={() => removeExercise(day.id, ex.id)}
                                  onMoveUp={() => moveExercise(day.id, idx, -1)}
                                  onMoveDown={() => moveExercise(day.id, idx, 1)}
                                  onDuplicate={() =>
                                    duplicateExercise(day.id, ex.id)
                                  }
                                  onToggleSuperset={() =>
                                    handleToggleSuperset(day.id, ex.id)
                                  }
                                  onRemoveSuperset={() =>
                                    handleRemoveSuperset(day.id, ex.id)
                                  }
                                  onInspectExercise={(info) =>
                                    setInspectedExercise(info)
                                  }
                                />
                              );
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => handleOpenSelector(day.id)}
                        className={cn(
                          "h-12 flex-1 rounded-xl border-2 border-dashed text-sm font-medium",
                          selectorActive
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-muted-foreground/30 hover:border-primary/40 hover:bg-accent/50",
                        )}
                      >
                        <Plus className="size-4 shrink-0" />
                        {selectorActive
                          ? "Catálogo abierto — selecciona ejercicios"
                          : "Añadir ejercicios"}
                      </Button>
                      {clipboard && (
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          onClick={() => handlePasteDay(day.id)}
                          className="h-12 rounded-xl border-2 border-dashed border-violet-500/40 bg-violet-500/5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-500/15"
                        >
                          <ClipboardPaste className="size-4 shrink-0" />
                          Pegar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Live Muscle Coverage Card (open-gym RoutineEdit live muscle map) */}
        <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/10 rounded-2xl bg-card/80">
          <CardHeader className="pb-4 border-b border-border/40 bg-muted/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Activity className="size-4.5" aria-hidden />
                </div>
                <div>
                  <CardTitle className="text-base font-bold tracking-tight">
                    Cobertura Muscular en Vivo
                  </CardTitle>
                  <CardDescription className="text-xs font-medium">
                    Series efectivas ponderadas (100% músculo primario · 40% secundario)
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <WeeklyMuscleCoverage
              load={computeRoutineMuscleVolume(
                days.flatMap((d) =>
                  d.isRestDay
                    ? []
                    : d.exercises.map((item) => ({
                        exercise:
                          exercises.find((ex) => ex.id === item.exerciseId) ||
                          {},
                        sets: Number(item.sets) || 3,
                      })),
                ),
              )}
            />
          </CardContent>
        </Card>
      </div>

      <div
        className={cn(
          "fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] md:bottom-0 z-40 border-t border-border bg-background/95",
          "backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.05)]",
          "px-4 py-3 sm:px-6",
          "md:static md:z-auto md:border-0 md:bg-transparent md:shadow-none md:px-0 md:py-0 md:backdrop-blur-none",
        )}
      >
        <div className="mx-auto w-full max-w-3xl lg:max-w-none">
          <Button
            type="button"
            onClick={handleSave}
            size="lg"
            disabled={saving}
            className="h-12 w-full rounded-xl text-base font-semibold sm:h-11"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {routineId ? "Guardando…" : "Creando rutina…"}
              </span>
            ) : routineId ? (
              "Guardar cambios"
            ) : (
              "Guardar rutina"
            )}
          </Button>
        </div>
      </div>

      <ExerciseSelectorDrawer
        open={selectorOpen}
        onOpenChange={(open) => {
          setSelectorOpen(open);
          if (!open) setActiveDayId(null);
        }}
        exercises={exercises}
        onSelectExercises={handleSelectExercises}
        loading={loadingExercises}
        existingExerciseIds={
          days
            .find((d) => d.id === activeDayId)
            ?.exercises.map((e) => e.exerciseId) ?? []
        }
      />

      <ExerciseDetailDrawer
        open={Boolean(inspectedExercise)}
        onOpenChange={(open) => {
          if (!open) setInspectedExercise(null);
        }}
        exercise={inspectedExercise}
        variant="default"
        editHref={
          inspectedExercise?.id
            ? `/admin/exercises/${encodeURIComponent(inspectedExercise.id)}/edit`
            : undefined
        }
      />
    </div>
  );
}

export default RoutineBuilderClient;

