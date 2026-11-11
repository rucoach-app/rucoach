"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminClientStatusBadge } from "@/components/admin/admin-client-status-badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { diffWholeDaysFromNow } from "@/lib/calendar-date";
import {
  ArrowUpRight,
  History,
  Dumbbell,
  Ruler,
  Notebook,
  Plus,
  Target,
  Camera,
  LayoutGrid,
  Diff,
  Trophy,
  ShieldAlert,
  Activity,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  MessageSquareQuote,
} from "lucide-react";
import { BodyMap } from "@/components/anatomy/body-map";
import {
  MuscleBalanceCard,
  type RichWorkoutSession,
} from "@/components/anatomy/muscle-balance-card";
import { ActivityHeatmap } from "@/components/anatomy/activity-heatmap";
import { WeeklyMuscleCoverage } from "@/components/anatomy/weekly-muscle-coverage";
import { computeRoutineMuscleVolume } from "@/lib/anatomy/muscles";
import type { PainEntry, PainZone, PainSeverity } from "@/lib/anatomy/pain-map";
import { getGoalLabel } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { Routine, WorkoutSession } from "@/lib/types";
import type { SessionExerciseLogRow } from "@/lib/workouts";
import {
  formatBodyMeasurementDate,
  sessionInstantLabel,
  workoutStatusBadgeClass,
  workoutStatusLabelEs,
} from "@/lib/format-workout-session";
import { AchievementBadge } from "@/components/client/achievement-badge";
import {
  resolveClientPainReport,
  revertExerciseOverride,
} from "@/app/actions/routine-overrides";

import { PhotoGallery } from "@/components/photos/photo-gallery";
import { PhotoCompare } from "@/components/photos/photo-compare";
import type { ProgressPhoto } from "@/components/photos/photo-card";

const RoutineDayCards = dynamic(
  () => import("@/components/routines/routine-day-cards"),
  {
    ssr: false,
    loading: () => <Skeleton className="min-h-40 w-full rounded-xl" />,
  },
);

export type HubWorkoutSession = WorkoutSession & {
  routine_days?: {
    day_name?: string | null;
    day_number?: number | null;
  } | null;
};

type BodyMeasurementRow = {
  id: string;
  recorded_at: string;
  weight?: number | null;
  body_fat_pct?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
  chest_cm?: number | null;
  arm_cm?: number | null;
  thigh_cm?: number | null;
};

// Actualizado para coincidir con el componente PhotoCard
export type ProgressPhotoRow = ProgressPhoto;

export type ClientHubClient = {
  id: string;
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  status?: string | null;
  goal?: string | null;
  notes?: string | null;
  last_session_at?: string | null;
  user_id?: string | null;
  onboarding_completed?: boolean | null;
  experience_level?: string | null;
  plan_name?: string | null;
  days_until_expiry?: number | null;
  gender?: string | null;
};

type ClientHubProfile = {
  role?: string | null;
  streak_days?: number | null;
  last_workout_at?: string | null;
  xp_points?: number | null;
  level?: number | null;
  onboarding_completed?: boolean | null;
} | null;

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
}

function formatRelativeDays(fromIso?: string | null) {
  if (!fromIso) return "-";
  const diff = diffWholeDaysFromNow(fromIso);
  if (diff === null) return "-";
  if (diff <= 0) return "hoy";
  if (diff === 1) return "ayer";
  return `hace ${diff} días`;
}

function trendFromSessions(sessions: HubWorkoutSession[]) {
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(b.started_at ?? "").getTime() -
      new Date(a.started_at ?? "").getTime(),
  );
  const last = sorted[0];
  const prev = sorted[1];
  const lastVol =
    typeof last?.total_volume_kg === "number" ? last.total_volume_kg : null;
  const prevVol =
    typeof prev?.total_volume_kg === "number" ? prev.total_volume_kg : null;
  if (lastVol == null || prevVol == null) return "flat";
  if (lastVol > prevVol) return "up";
  if (lastVol < prevVol) return "down";
  return "flat";
}

function exerciseGroupsFromLogs(logs: SessionExerciseLogRow[]) {
  const order: string[] = [];
  const byName = new Map<string, SessionExerciseLogRow[]>();
  for (const log of logs) {
    if (!byName.has(log.exercise_name)) {
      order.push(log.exercise_name);
      byName.set(log.exercise_name, []);
    }
    byName.get(log.exercise_name)!.push(log);
  }
  return order.map((name) => ({ name, sets: byName.get(name)! }));
}

function formatSetLine(log: SessionExerciseLogRow) {
  const w = log.weight_kg != null ? `${log.weight_kg} kg` : "—";
  const r = log.reps != null ? `${log.reps} rep.` : "—";
  
  return (
    <div className="flex items-center gap-2 py-1 border-b border-border/5 last:border-0">
      <span className="text-[10px] font-black tabular-nums bg-muted/50 w-5 h-5 flex items-center justify-center rounded-md shrink-0">
        {log.set_number}
      </span>
      <div className="flex-1 flex items-center gap-2 overflow-hidden">
        <span className="text-[11px] font-bold text-foreground shrink-0">{w}</span>
        <span className="text-muted-foreground/30 text-[10px]">×</span>
        <span className="text-[11px] font-bold text-foreground shrink-0">{r}</span>
        
        <div className="flex gap-1 ml-auto overflow-hidden">
          {log.is_pr && (
            <Badge variant="secondary" className="h-4 px-1 text-[8px] font-black bg-primary/20 text-primary border-primary/20 shrink-0">PR</Badge>
          )}
          {log.is_warmup && (
            <Badge variant="outline" className="h-4 px-1 text-[8px] font-black border-orange-500/30 text-orange-600/80 shrink-0">CAL</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export type HubPainReport = {
  id: string;
  body_region: string;
  severity: number;
  notes: string | null;
  is_active: boolean;
  reported_at: string;
};

export type HubExerciseOverride = {
  id: string;
  client_routine_id: string;
  original_routine_exercise_id: number;
  replacement_exercise_id: string;
  reason: string | null;
  changed_by: "client" | "coach";
  created_at: string;
  exercises?: {
    id: string;
    name: string;
    name_es?: string | null;
  } | null;
  routine_exercises?: {
    id: number;
    exercises?: {
      id: string;
      name: string;
      name_es?: string | null;
    } | null;
    routine_days?: {
      day_number?: number | null;
      day_name?: string | null;
    } | null;
  } | null;
};

const PAIN_REGION_LABELS_ES: Record<string, string> = {
  hombro: "Hombro",
  codo: "Codo",
  muñeca: "Muñeca",
  espalda_baja: "Espalda baja",
  rodilla: "Rodilla",
  cadera: "Cadera",
  tobillo: "Tobillo",
  cuello: "Cuello",
  otro: "Otra zona",
};

function mapReportToPainZone(region: string): PainZone {
  const norm = region.toLowerCase().trim();
  if (norm === "hombro" || norm === "shoulder" || norm === "deltoids") return "deltoids";
  if (norm === "codo" || norm === "elbow" || norm === "elbows") return "elbows";
  if (norm === "muñeca" || norm === "wrist" || norm === "wrists") return "wrists";
  if (norm === "espalda_baja" || norm === "lumbar" || norm === "lower-back") return "lower-back";
  if (norm === "rodilla" || norm === "knee" || norm === "knees") return "knees";
  if (norm === "cadera" || norm === "hip" || norm === "hip-flexors") return "hip-flexors";
  if (norm === "tobillo" || norm === "ankle" || norm === "ankles") return "ankles";
  if (norm === "cuello" || norm === "neck") return "neck";
  if (norm === "pecho" || norm === "chest") return "chest";
  if (norm === "biceps") return "biceps";
  if (norm === "triceps") return "triceps";
  if (norm === "cuadriceps" || norm === "quadriceps") return "quadriceps";
  if (norm === "isquios" || norm === "hamstring") return "hamstring";
  if (norm === "gluteo" || norm === "gluteal") return "gluteal";
  return "knees";
}

const FEELING_LABELS_ES: Record<number, string> = {
  1: "1/5 · Muy ligero",
  2: "2/5 · Bien",
  3: "3/5 · Exigente",
  4: "4/5 · Intenso",
  5: "5/5 · Al límite",
};

const PROGRESS_VIEWPORT = 12;

export function ClientProfileHub({
  client,
  profile,
  routine,
  workoutSessions,
  sessionExerciseLogs,
  bodyMeasurements,
  progressPhotos,
  personalRecords,
  userAchievements,
  painReports = [],
  exerciseOverrides = [],
  clientId,
}: {
  client: ClientHubClient;
  profile: ClientHubProfile;
  routine: Routine | null;
  workoutSessions: HubWorkoutSession[];
  sessionExerciseLogs: SessionExerciseLogRow[];
  bodyMeasurements: BodyMeasurementRow[];
  progressPhotos: ProgressPhotoRow[];
  personalRecords: any[];
  userAchievements: any[];
  painReports?: HubPainReport[];
  exerciseOverrides?: HubExerciseOverride[];
  clientId?: string;
}) {
  const [tab, setTab] = useState("summary");
  const [savedNotes, setSavedNotes] = useState<string>(client?.notes || "");
  const [notesDraft, setNotesDraft] = useState<string>(client?.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [painReportsState, setPainReportsState] = useState<HubPainReport[]>(painReports);
  const [showPainMap, setShowPainMap] = useState(false);

  const clinicalPainEntries: PainEntry[] = useMemo(() => {
    return (painReportsState || []).map((r) => ({
      zone: mapReportToPainZone(r.body_region),
      severity: (r.severity >= 7 ? "severe" : r.severity >= 4 ? "moderate" : "mild") as PainSeverity,
      notes: r.notes || undefined,
    }));
  }, [painReportsState]);
  const [resolvingPainId, setResolvingPainId] = useState<string | null>(null);
  const [overridesState, setOverridesState] = useState<HubExerciseOverride[]>(exerciseOverrides);
  const [revertingOverrideId, setRevertingOverrideId] = useState<string | null>(null);

  async function handleResolvePain(reportId: string) {
    setResolvingPainId(reportId);
    try {
      const res = await resolveClientPainReport(reportId);
      if (!res.success) {
        toast.error(res.error || "No se pudo marcar como resuelto");
        return;
      }
      setPainReportsState((prev) => prev.filter((r) => r.id !== reportId));
      toast.success("Reporte de molestia marcado como resuelto");
    } finally {
      setResolvingPainId(null);
    }
  }

  async function handleRevertOverride(overrideId: string) {
    setRevertingOverrideId(overrideId);
    try {
      const res = await revertExerciseOverride(overrideId);
      if (!res.success) {
        toast.error(res.error || "No se pudo restaurar el ejercicio original");
        return;
      }
      setOverridesState((prev) => prev.filter((o) => o.id !== overrideId));
      toast.success("Ejercicio original restaurado para este atleta");
    } finally {
      setRevertingOverrideId(null);
    }
  }

  const lastSessionAt =
    workoutSessions?.[0]?.started_at || client?.last_session_at || null;
  const streakDays = profile?.streak_days ?? null;
  const trend = useMemo(
    () => trendFromSessions(workoutSessions || []),
    [workoutSessions],
  );

  const logsBySessionId = useMemo(() => {
    const m = new Map<string, SessionExerciseLogRow[]>();
    for (const row of sessionExerciseLogs || []) {
      if (!m.has(row.workout_session_id)) m.set(row.workout_session_id, []);
      m.get(row.workout_session_id)!.push(row);
    }
    return m;
  }, [sessionExerciseLogs]);

  const plannedWeeklyLoad = useMemo(() => {
    const items: Array<{ exercise: any; sets: number }> = [];
    for (const day of routine?.routine_days || []) {
      for (const re of day.routine_exercises || []) {
        const ex = re.exercises || (re as any).exercise;
        if (ex) {
          items.push({ exercise: ex, sets: Number(re.sets) || 3 });
        }
      }
    }
    return computeRoutineMuscleVolume(items);
  }, [routine]);

  const richWorkoutHistory = useMemo<RichWorkoutSession[]>(() => {
    // Also index routine exercises by name as fallback if an older exercise_log lacks exercises join
    const routineExByName = new Map<string, any>();
    for (const day of routine?.routine_days || []) {
      for (const re of day.routine_exercises || []) {
        const ex = re.exercises || (re as any).exercise;
        if (ex) {
          if (ex.name) routineExByName.set(ex.name.toLowerCase(), ex);
          if (ex.name_es) routineExByName.set(ex.name_es.toLowerCase(), ex);
        }
      }
    }

    const list: RichWorkoutSession[] = [];
    for (const s of workoutSessions || []) {
      if (s.status && s.status !== "completed") continue;
      const ts = new Date(s.started_at ?? s.created_at ?? Date.now()).getTime();
      const logs = logsBySessionId.get(s.id) || [];
      const itemMap = new Map<
        string,
        {
          exercise: any;
          sets: number;
          bestWeightKg: number;
          bestReps: number;
          est1rm: number;
        }
      >();

      for (const l of logs) {
        if (l.is_warmup) continue;
        const exJoined = Array.isArray(l.exercises)
          ? l.exercises[0]
          : l.exercises;
        const fallbackEx = routineExByName.get(
          (l.exercise_name || "").toLowerCase(),
        );
        const exMeta = exJoined || fallbackEx;
        if (!exMeta) continue;

        const wKg = Number(l.weight_kg) || 0;
        const reps = Number(l.reps) || 0;
        const e1rm =
          wKg > 0
            ? reps <= 1
              ? wKg
              : Math.round(wKg * (1 + Math.min(reps, 30) / 30) * 10) / 10
            : 0;
        const key = l.exercise_id || l.exercise_name;
        const cur = itemMap.get(key);
        if (cur) {
          cur.sets += 1;
          if (e1rm > cur.est1rm) {
            cur.est1rm = e1rm;
            cur.bestWeightKg = wKg;
            cur.bestReps = reps;
          }
        } else {
          itemMap.set(key, {
            exercise: {
              id: l.exercise_id || exMeta.id,
              name: l.exercise_name || exMeta.name_es || exMeta.name,
              primary_muscle: exMeta.primary_muscle,
              secondary_muscles: exMeta.secondary_muscles,
              muscle_weights: exMeta.muscle_weights,
            },
            sets: 1,
            bestWeightKg: wKg,
            bestReps: reps,
            est1rm: e1rm,
          });
        }
      }

      if (itemMap.size > 0) {
        list.push({
          id: s.id,
          timestamp: ts,
          items: Array.from(itemMap.values()),
        });
      }
    }
    return list;
  }, [workoutSessions, logsBySessionId, routine]);

  const progressRows = useMemo(() => {
    const list = [...(workoutSessions || [])].slice(0, PROGRESS_VIEWPORT);
    list.sort(
      (a, b) =>
        new Date(a.started_at ?? 0).getTime() -
        new Date(b.started_at ?? 0).getTime(),
    );
    const vols = list.map((s) => Math.max(0, s.total_volume_kg ?? 0));
    const maxVol = vols.length ? Math.max(...vols) : 0;
    return { list, maxVol };
  }, [workoutSessions]);

  const measurementRows = useMemo(() => {
    const list = [...(bodyMeasurements || [])];
    return list.map((m, i) => {
      const older = list[i + 1];
      let weightDelta: string | null = null;
      if (
        older &&
        m.weight != null &&
        older.weight != null &&
        Math.abs(m.weight - older.weight) > 1e-6
      ) {
        const d = m.weight - older.weight;
        const sign = d > 0 ? "+" : "";
        weightDelta = `${sign}${d.toFixed(1)} kg vs medición anterior`;
      }
      return { ...m, weightDelta };
    });
  }, [bodyMeasurements]);

  async function saveNotes() {
    try {
      setIsSaving(true);
      setSaveError(null);

      const supabase = createClient();
      const { error } = await supabase
        .from("clients")
        .update({ notes: notesDraft || null })
        .eq("id", client.id);

      if (error) {
        toast.error("No se pudieron guardar las notas");
        setSaveError(error.message);
        return;
      }

      setSavedNotes(notesDraft);
      toast.success("Notas guardadas");
    } catch (e: unknown) {
      toast.error("No se pudieron guardar las notas");
      setSaveError(e instanceof Error ? e.message : "Error al guardar notas");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {painReportsState.length > 0 && (
        <div
          role="region"
          aria-label="Reportes activos de dolor o lesión"
          className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <ShieldAlert className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-tight text-foreground">
                  Atención clínica: Molestia o dolor activo ({painReportsState.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  El atleta reportó estas molestias desde su perfil. La auto-progresión agresiva está pausada en las zonas afectadas.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPainMap((v) => !v)}
              className="gap-1.5 rounded-xl border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs font-bold shrink-0 hover:bg-amber-500/20"
            >
              <Activity className="size-3.5" />
              {showPainMap ? "Ocultar Mapa" : "Ver Mapa Anatómico"}
            </Button>
          </div>

          {showPainMap && (
            <div className="mb-4 rounded-2xl border border-amber-500/30 bg-background/95 p-4 shadow-sm">
              <BodyMap
                mode="clinical"
                gender={client.gender === "female" ? "female" : "male"}
                painEntries={clinicalPainEntries}
              />
            </div>
          )}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {painReportsState.map((report) => {
              const regionLabel =
                PAIN_REGION_LABELS_ES[report.body_region] ??
                report.body_region.replace(/_/g, " ");
              const isHighSeverity = report.severity >= 7;
              return (
                <div
                  key={report.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-background/80 p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-foreground capitalize">
                        {regionLabel}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          isHighSeverity
                            ? "border-destructive/40 bg-destructive/15 text-destructive font-black text-[10px]"
                            : "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-black text-[10px]"
                        }
                      >
                        Severidad {report.severity}/10
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        · {formatDate(report.reported_at)}
                      </span>
                    </div>
                    {report.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        “{report.notes}”
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={resolvingPainId === report.id}
                    onClick={() => handleResolvePain(report.id)}
                    className="h-8 shrink-0 gap-1.5 rounded-lg text-xs font-semibold"
                  >
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    {resolvingPainId === report.id ? "..." : "Resuelto"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="-mx-4 px-4 py-2 bg-background/95 border-b border-border/40 mb-2 sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent sm:border-none sm:mb-0">
          <ScrollArea className="w-full whitespace-nowrap pb-1">
            <TabsList className="inline-flex w-auto bg-card/60 backdrop-blur-xl p-1 h-12 rounded-[1rem] border border-border/50 shadow-sm mb-1">
              <TabsTrigger
                value="summary"
                className="rounded-lg px-4 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold transition-all gap-2 text-[14px] font-medium"
              >
                <Target className="size-4" />
                Resumen
              </TabsTrigger>
              <TabsTrigger
                value="routine"
                className="rounded-lg px-4 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold transition-all gap-2 text-[14px] font-medium"
              >
                <Dumbbell className="size-4" />
                Rutina
                {overridesState.length > 0 && (
                  <span className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-black text-amber-600 dark:text-amber-400">
                    {overridesState.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="rounded-lg px-4 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold transition-all gap-2 text-[14px] font-medium"
              >
                <History className="size-4" />
                Historial
              </TabsTrigger>
              <TabsTrigger
                value="progress"
                className="rounded-lg px-4 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold transition-all gap-2 text-[14px] font-medium"
              >
                <ArrowUpRight className="size-4" />
                Progreso
              </TabsTrigger>
              <TabsTrigger
                value="measurements"
                className="rounded-lg px-4 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold transition-all gap-2 text-[14px] font-medium"
              >
                <Ruler className="size-4" />
                Medidas
              </TabsTrigger>
              <TabsTrigger
                value="photos"
                className="rounded-lg px-4 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold transition-all gap-2 text-[14px] font-medium"
              >
                <Camera className="size-4" />
                Fotos
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="rounded-lg px-4 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold transition-all gap-2 text-[14px] font-medium"
              >
                <Notebook className="size-4" />
                Notas
              </TabsTrigger>
              <TabsTrigger
                value="achievements"
                className="rounded-lg px-4 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold transition-all gap-2 text-[14px] font-medium"
              >
                <Trophy className="size-4" />
                Logros
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
        </div>

        <TabsContent value="summary" className="flex flex-col gap-6 pt-2">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 sm:gap-4">
            <div className="flex flex-col justify-between gap-2.5 rounded-[1.5rem] border border-border/50 bg-card/60 p-4 sm:p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground uppercase font-black tracking-widest opacity-80">
                <ArrowUpRight className="size-3.5 sm:size-4" />
                Última sesión
              </div>
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <div className="text-xl sm:text-2xl font-bold tracking-tight">
                  {formatRelativeDays(lastSessionAt)}
                </div>
                <div className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                  Fecha: {formatDate(lastSessionAt)}
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-2.5 rounded-[1.5rem] border border-border/50 bg-card/60 p-4 sm:p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground uppercase font-black tracking-widest opacity-80">
                <Dumbbell className="size-3.5 sm:size-4" />
                Racha
              </div>
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <div className="text-xl sm:text-2xl font-bold tracking-tight">{streakDays ?? "-"}</div>
                <div className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                  días consecutivos
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-2.5 rounded-[1.5rem] border border-border/50 bg-card/60 p-4 sm:p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground uppercase font-black tracking-widest opacity-80">
                <History className="size-3.5 sm:size-4" />
                Tendencia
              </div>
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <div className="text-xl sm:text-2xl font-bold tracking-tight text-balance">
                  {trend === "up" ? "Creciendo" : trend === "down" ? "Bajando" : "Estable"}
                </div>
                <div className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                  volumen vs anterior
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-2.5 rounded-[1.5rem] border border-border/50 bg-card/60 p-4 sm:p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground uppercase font-black tracking-widest opacity-80">
                <Trophy className="size-3.5 sm:size-4" />
                Récords (PR)
              </div>
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <div className="text-xl sm:text-2xl font-bold tracking-tight">{personalRecords?.length ?? 0}</div>
                <div className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                  hitos registrados
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
             <div className="lg:col-span-8 flex flex-col gap-6">
                <Card className="border-border/50 bg-card/60 backdrop-blur-xl rounded-[1.5rem] shadow-sm overflow-hidden">
                  <CardHeader className="pb-4 sm:pb-5">
                    <CardTitle className="text-[16px] sm:text-[17px] font-bold">Resumen del atleta</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6 pb-5 sm:pb-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
                      <Avatar className="size-[5rem] sm:size-[4.5rem] rounded-[1.2rem] border-2 border-background shadow-sm shrink-0">
                        {client?.avatar_url ? (
                          <AvatarImage
                            src={client.avatar_url}
                            alt={client.full_name ?? "Cliente"}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="bg-primary/20 text-primary font-black text-xl">
                          {(client?.full_name || "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex flex-col gap-2 min-w-0 flex-1 w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <div className="text-xl sm:text-2xl font-bold leading-tight break-words">
                            {client?.full_name || "-"}
                          </div>
                          <div className="flex justify-center sm:justify-start">
                            {client?.status ? (
                              <AdminClientStatusBadge status={client.status} />
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5 text-[13px] sm:text-[14px] font-medium opacity-90 text-muted-foreground items-center sm:items-start">
                          {client?.email ? (
                            <span className="break-all">{client.email}</span>
                          ) : (
                            <span>Sin email</span>
                          )}
                          {client?.phone && <span className="break-all">{client.phone}</span>}
                        </div>
                        <div className="mt-1 flex flex-col items-center sm:items-start gap-3">
                          <div className="inline-flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 text-sm bg-muted/30 rounded-xl px-4 py-2.5 w-full sm:w-fit border border-border/20">
                            <span className="font-bold text-foreground">
                            {client?.plan_name ? client.plan_name : "Sin plan activo"}
                            </span>
                            <span className="opacity-30 text-muted-foreground hidden sm:inline">·</span>
                            <span className="font-medium text-muted-foreground text-[13px]">
                              {client?.days_until_expiry != null
                                ? client.days_until_expiry > 0
                                  ? `Vence en ${client.days_until_expiry} días`
                                  : "Membresía vencida"
                                : "Sin fecha de vencimiento"}
                            </span>
                            {client?.id && (
                              <>
                                <span className="opacity-30 text-muted-foreground hidden sm:inline">·</span>
                                <Link
                                  href={`/admin/payments/new?clientId=${client.id}`}
                                  className="text-xs font-bold text-primary hover:underline"
                                >
                                  {client?.days_until_expiry != null && client.days_until_expiry <= 0
                                    ? "Renovar membresía"
                                    : "Registrar cobro"}
                                </Link>
                              </>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                            {client?.goal && (
                              <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest gap-1.5 bg-primary/10 text-primary border-primary/20 py-1 px-2.5">
                                <Target className="size-3" />
                                {getGoalLabel(client.goal)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
             </div>

             <div className="lg:col-span-4">
                <Card className="h-full border-border/50 bg-card/60 backdrop-blur-xl rounded-[1.5rem] shadow-sm overflow-hidden transition-all hover:bg-card/80">
                   <CardHeader className="pb-3 border-b border-border/30">
                      <div className="flex items-center justify-between">
                         <CardTitle className="text-[15px] font-bold tracking-tight">Top Records (PRs)</CardTitle>
                         <Trophy className="size-4 text-primary animate-pulse" />
                      </div>
                   </CardHeader>
                   <CardContent className="p-0">
                      <ScrollArea className="h-[240px] sm:h-[300px] lg:h-[200px]">
                         <div className="divide-y divide-border/10">
                            {personalRecords?.length > 0 ? (
                               personalRecords.slice(0, 10).map((pr) => (
                                  <div key={pr.exercise_id} className="flex flex-col gap-1.5 p-4 transition-colors hover:bg-primary/5 group">
                                     <div className="text-[12px] font-black uppercase tracking-wider text-muted-foreground/80 group-hover:text-primary transition-colors leading-tight">
                                        {pr.exercise_name}
                                     </div>
                                     <div className="flex items-end justify-between gap-2">
                                        <div className="text-xl font-black text-foreground italic flex items-baseline gap-1">
                                           {pr.weight_kg} <span className="text-[10px] font-bold not-italic text-muted-foreground uppercase">kg</span>
                                           <span className="mx-0.5 text-muted-foreground/30 not-italic">×</span>
                                           {pr.reps} <span className="text-[10px] font-bold not-italic text-muted-foreground uppercase">reps</span>
                                        </div>
                                        <time className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter self-center mb-1">
                                           {formatDate(pr.achieved_at)}
                                        </time>
                                     </div>
                                  </div>
                                ))
                            ) : (
                               <div className="flex flex-col items-center justify-center h-40 text-muted-foreground p-6 text-center">
                                  <div className="relative mb-3">
                                    <Dumbbell className="size-10 opacity-10" />
                                    <Trophy className="size-5 opacity-20 absolute -bottom-1 -right-1" />
                                  </div>
                                  <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Sin récords aún</div>
                               </div>
                            )}
                         </div>
                      </ScrollArea>
                      {personalRecords?.length > 0 && (
                        <div className="p-3 border-t border-border/30 bg-muted/10">
                          <p className="text-[9px] text-center font-bold text-muted-foreground/40 uppercase tracking-widest">
                            Mostrando top {Math.min(personalRecords.length, 10)} records
                          </p>
                        </div>
                      )}
                   </CardContent>
                </Card>
             </div>
           </div>

           {userAchievements.length > 0 && (
             <Card className="border-border/50 bg-card/60 backdrop-blur-xl rounded-[1.5rem] shadow-sm overflow-hidden">
               <CardHeader className="pb-3 border-b border-border/30">
                 <div className="flex items-center justify-between">
                   <CardTitle className="text-[15px] font-bold">Logros Recientes</CardTitle>
                   <Trophy className="size-4 text-primary" />
                 </div>
               </CardHeader>
               <CardContent className="p-4 sm:p-6">
                 <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 sm:gap-6">
                   {userAchievements.slice(0, 8).map((ua) => (
                     <div key={ua.id} className="flex justify-center">
                       <AchievementBadge
                         achievement={ua.achievements}
                         unlocked={true}
                         size="md"
                         showDetails={true}
                       />
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
           )}
        </TabsContent>

        <TabsContent value="routine" className="flex flex-col gap-4 pt-2">
          {overridesState.length > 0 && (
            <Card className="border-amber-500/35 bg-amber-500/5 backdrop-blur-xl rounded-[1.5rem] shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <RefreshCw className="size-4 text-amber-600 dark:text-amber-400" />
                  Ejercicios intercambiados por el atleta ({overridesState.length})
                </CardTitle>
                <CardDescription>
                  El asesorado cambió estos ejercicios en su rutina activa (por equipo ocupado o molestia). Puedes mantener el reemplazo o restaurar el ejercicio original.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2.5 px-4 sm:px-6 pb-5">
                {overridesState.map((ov) => {
                  const origEx = ov.routine_exercises?.exercises;
                  const origName = origEx?.name_es || origEx?.name || "Ejercicio original";
                  const newName =
                    ov.exercises?.name_es || ov.exercises?.name || "Ejercicio alternativo";
                  const rd = ov.routine_exercises?.routine_days;
                  const dayLabel = rd?.day_number
                    ? `Día ${rd.day_number}${rd.day_name ? ` · ${rd.day_name}` : ""}`
                    : "Rutina activa";
                  return (
                    <div
                      key={ov.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/80 p-3.5"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
                          <Badge variant="secondary" className="text-[10px] font-bold">
                            {dayLabel}
                          </Badge>
                          <span>·</span>
                          <span>Cambiado el {formatDate(ov.created_at)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                          <span className="line-through text-muted-foreground">
                            {origName}
                          </span>
                          <span className="text-muted-foreground font-bold">→</span>
                          <span className="font-bold text-foreground">{newName}</span>
                        </div>
                        {ov.reason ? (
                          <p className="text-xs text-muted-foreground">
                            Motivo: <span className="italic">“{ov.reason}”</span>
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={revertingOverrideId === ov.id}
                        onClick={() => handleRevertOverride(ov.id)}
                        className="h-9 shrink-0 gap-1.5 rounded-xl text-xs font-semibold"
                      >
                        <RotateCcw className="size-3.5" />
                        {revertingOverrideId === ov.id
                          ? "Restaurando…"
                          : "Restaurar original"}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50 bg-card/60 backdrop-blur-xl rounded-[1.5rem] shadow-sm overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Dumbbell className="size-4 text-primary" />
                Rutina asignada
              </CardTitle>
              {clientId ? (
                <Button
                  asChild
                  size="sm"
                  variant={routine ? "outline" : "default"}
                  className="w-full sm:w-auto h-9 font-bold text-[13px]"
                >
                  <Link href={`/admin/clients/${clientId}/assign-routine`}>
                    <Plus className="mr-1 size-4" />
                    {routine ? "Cambiar rutina" : "Asignar rutina"}
                  </Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {routine ? (
                <div className="grid gap-6">
                  <div className="grid gap-1">
                    <div className="text-lg sm:text-xl font-bold tracking-tight text-foreground">{routine.name}</div>
                    {routine.description ? (
                      <div className="text-sm font-medium text-muted-foreground/80 line-clamp-2">
                        {routine.description}
                      </div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                      <span>
                        {routine.duration_weeks
                          ? `${routine.duration_weeks} semanas`
                          : "-"}
                      </span>
                      <span className="size-1 rounded-full bg-border" />
                      <span>
                        {routine.days_per_week ||
                          routine.routine_days?.length ||
                          "-"} días/sem
                      </span>
                    </div>
                  </div>
                  <RoutineDayCards
                    days={(routine.routine_days || []).slice(0, 7)}
                    compact
                    emptyMessage="Esta rutina aún no tiene días cargados."
                  />
                  {Object.keys(plannedWeeklyLoad).length > 0 && (
                    <div className="rounded-2xl border border-border/50 bg-background/60 p-4 sm:p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <Activity className="size-4 text-primary" />
                        <h4 className="text-sm font-bold tracking-tight text-foreground">
                          Cobertura Muscular Semanal Planificada
                        </h4>
                      </div>
                      <WeeklyMuscleCoverage
                        load={plannedWeeklyLoad}
                        sex={client.gender === "female" ? "female" : "male"}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                   <div className="size-12 rounded-full bg-muted/20 flex items-center justify-center">
                      <Plus className="size-6 text-muted-foreground/40" />
                   </div>
                   <div className="text-sm font-black uppercase tracking-widest text-muted-foreground/40">Sin rutina asignada</div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="flex flex-col gap-4 pt-2">
          <Card className="border-border/50 bg-card/60 backdrop-blur-xl rounded-[1.5rem] shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4" />
                Sesiones recientes
              </CardTitle>
              <CardDescription>
                Fecha y hora según el inicio real de la sesión. El bloque de
                rutina es la plantilla asignada a ese entreno, no el día del
                calendario.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(workoutSessions || []).length === 0 ? (
                <Empty className="border border-dashed bg-muted/20">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <History />
                    </EmptyMedia>
                    <EmptyTitle>Aún no hay sesiones</EmptyTitle>
                    <EmptyDescription>
                      Cuando el asesorado registre entrenos, aparecerán aquí con
                      volumen y detalle de series.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Accordion type="multiple" className="flex flex-col gap-2">
                  {(workoutSessions || []).map((s) => {
                    const when = sessionInstantLabel(
                      s.started_at ?? s.created_at,
                    );
                    const routineDay = s.routine_days?.day_name?.trim();
                    const logs = logsBySessionId.get(s.id) ?? [];
                    const groups = exerciseGroupsFromLogs(logs);
                    const vol = s.total_volume_kg ?? 0;
                    const volLabel =
                      vol > 0
                        ? `${vol} kg de volumen`
                        : "Volumen en 0 — puede ser sesión sin cargas registradas";
                    const feelingLabel =
                      s.feeling_score != null
                        ? FEELING_LABELS_ES[s.feeling_score] ?? `Sensación ${s.feeling_score}/5`
                        : null;

                    return (
                      <AccordionItem
                        key={s.id}
                        value={s.id}
                        className="rounded-2xl border border-border/60 bg-card/40 px-4 last:border-b transition-all data-[state=open]:bg-card/80 data-[state=open]:shadow-sm"
                      >
                        <AccordionTrigger className="py-4 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                          <div className="flex w-full flex-col gap-1.5 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold tracking-tight leading-snug text-[15px]">
                                {when.dateLine}
                              </div>
                              <div className="text-muted-foreground text-[13px] font-medium opacity-90">
                                {when.timeLine ? `${when.timeLine} · ` : null}
                                <span className={vol > 0 ? "text-foreground font-semibold" : ""}>{volLabel}</span>
                                {typeof s.exercises_completed === "number" && s.exercises_completed > 0
                                  ? ` · ${s.exercises_completed} ejercicios`
                                  : null}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] font-medium text-muted-foreground">
                                {routineDay ? (
                                  <span>
                                    Bloque:{" "}
                                    <span className="text-primary bg-primary/10 rounded-md px-1.5 py-0.5 font-bold">
                                      {routineDay}
                                    </span>
                                  </span>
                                ) : null}
                                {feelingLabel ? (
                                  <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                                    Esfuerzo: {feelingLabel}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={`shrink-0 font-bold uppercase tracking-wider text-[10px] mt-2 sm:mt-0 ${workoutStatusBadgeClass(s.status)}`}
                            >
                              {workoutStatusLabelEs(s.status)}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-3 pt-0">
                          <Separator className="mb-3" />
                          {s.feeling_note ? (
                            <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5 text-xs">
                              <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-primary" />
                              <div>
                                <span className="font-bold text-foreground">
                                  Nota del atleta en esta sesión:{" "}
                                </span>
                                <span className="text-muted-foreground">
                                  “{s.feeling_note}”
                                </span>
                              </div>
                            </div>
                          ) : null}
                          {groups.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                              No hay series registradas en esta sesión. Si el
                              entreno se completó desde otro flujo, revisa que
                              los logs se hayan guardado correctamente.
                            </p>
                          ) : (
                            <div className="flex flex-col gap-3">
                              <p className="text-muted-foreground text-xs">
                                Detalle opcional: despliega para revisar series
                                sin ir al historial técnico.
                              </p>
                              {groups.map(({ name, sets }) => (
                                <div
                                  key={name}
                                  className="rounded-xl bg-muted/40 border border-border/50 px-3.5 py-2.5"
                                >
                                  <div className="text-[13px] font-bold tracking-tight text-foreground/90 mb-1.5 px-0.5">
                                    {name}
                                  </div>
                                  <div className="flex flex-col">
                                    {sets.map((log, idx) => (
                                      <div key={`${name}-${log.set_number}-${idx}`}>
                                        {formatSetLine(log)}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="flex flex-col gap-4 pt-2">
          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="border-border/50 bg-card/60 backdrop-blur-xl rounded-[1.5rem] shadow-sm overflow-hidden lg:col-span-7">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="size-4 text-primary" />
                  Balance Muscular, Fatiga y Fuerza Retenida
                </CardTitle>
                <CardDescription>
                  Comparativa de series efectivas (completadas vs planificadas), decaimiento biomecánico de fatiga y retención de 1RM del atleta.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MuscleBalanceCard
                  workoutHistory={richWorkoutHistory}
                  plannedWeeklyLoad={plannedWeeklyLoad}
                  gender={client.gender === "female" ? "female" : "male"}
                />
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/60 backdrop-blur-xl rounded-[1.5rem] shadow-sm overflow-hidden lg:col-span-5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="size-4 text-primary" />
                  Consistencia Anual (52 semanas)
                </CardTitle>
                <CardDescription>
                  Frecuencia de entrenamiento y densidad de volumen diario del asesorado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityHeatmap
                  sessions={(workoutSessions || [])
                    .filter((s) => !s.status || s.status === "completed")
                    .map((s) => ({
                      started_at: (s.started_at ?? s.finished_at ?? s.created_at ?? "") as string,
                      total_volume_kg: Number.isFinite(Number(s.total_volume_kg))
                        ? Number(s.total_volume_kg)
                        : 0,
                      duration_minutes:
                        s.duration_minutes != null && Number.isFinite(Number(s.duration_minutes))
                          ? Number(s.duration_minutes)
                          : null,
                    }))}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50 bg-card/60 backdrop-blur-xl rounded-[1.5rem] shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Progreso (volumen total)
              </CardTitle>
              <CardDescription>
                Últimas {PROGRESS_VIEWPORT} sesiones en orden cronológico. La
                barra es proporcional al mayor volumen de esta lista (no a un
                valor fijo).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {progressRows.list.length === 0 ? (
                <Empty className="border border-dashed bg-muted/20">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Target />
                    </EmptyMedia>
                    <EmptyTitle>Sin datos de volumen</EmptyTitle>
                    <EmptyDescription>
                      Cuando haya sesiones completadas, verás la evolución aquí.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div
                  className="flex flex-col gap-4"
                  aria-label="Volumen por sesión"
                >
                  {progressRows.list.map((s) => {
                    const vol = Math.max(0, s.total_volume_kg ?? 0);
                    const pct =
                      progressRows.maxVol > 0
                        ? Math.min(
                            100,
                            Math.round((vol / progressRows.maxVol) * 100),
                          )
                        : 0;
                    const when = sessionInstantLabel(
                      s.started_at ?? s.created_at,
                    );
                    const isEmptyVol = vol <= 0;

                    return (
                      <div
                        key={s.id}
                        className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-card/40 p-4 transition-all hover:bg-card/60 hover:shadow-md sm:grid sm:grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,1.5fr)] sm:items-center sm:gap-6"
                      >
                        <div className="flex flex-row sm:flex-col justify-between items-center sm:items-start gap-1">
                          <div className="min-w-0">
                            <div className={`text-[14px] font-bold tracking-tight ${isEmptyVol ? "text-muted-foreground/60" : "text-foreground"}`}>
                              {when.dateLine}
                            </div>
                            {when.timeLine ? (
                              <div className="text-muted-foreground/60 text-[11px] font-medium uppercase tracking-wider">
                                {when.timeLine}
                              </div>
                            ) : null}
                          </div>
                          <div className="sm:hidden tabular-nums text-sm font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                            {vol} <span className="text-[10px] uppercase">kg</span>
                          </div>
                        </div>

                        <div className="hidden sm:block tabular-nums text-base font-black text-primary italic">
                          {vol} <span className="text-xs font-bold not-italic opacity-60">kg</span>
                        </div>

                        <div className="min-w-0 flex flex-col gap-1.5 sm:pt-0">
                          <div className="flex items-center justify-between sm:hidden">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Progreso</span>
                            <span className="text-[10px] font-black tabular-nums text-primary/80">{pct}%</span>
                          </div>
                          <Progress
                            value={pct}
                            className={`h-2.5 ${isEmptyVol ? "opacity-20" : ""}`}
                            aria-label={`Volumen relativo ${pct}%`}
                          />
                          {isEmptyVol ? (
                            <span className="text-muted-foreground/40 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                              Sin volumen registrado
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="measurements" className="flex flex-col gap-4 pt-2">
          <Card className="border-border/50 bg-card/60 backdrop-blur-xl rounded-[1.5rem] shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Ruler className="size-4" />
                Medidas corporales
              </CardTitle>
              <CardDescription>
                Más recientes primero. Comparación de peso respecto a la
                medición anterior en la lista.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(bodyMeasurements || []).length === 0 ? (
                <Empty className="border border-dashed bg-muted/20">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Ruler />
                    </EmptyMedia>
                    <EmptyTitle>Sin medidas</EmptyTitle>
                    <EmptyDescription>
                      El asesorado aún no registró mediciones corporales.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="grid gap-3">
                  {measurementRows.map((m) => (
                    <div
                      key={m.id}
                      className="group flex flex-col gap-3 rounded-2xl border border-border/40 bg-card/40 p-4 transition-all hover:bg-card/60 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between border-b border-border/10 pb-2">
                        <div className="text-[12px] font-black uppercase tracking-widest text-muted-foreground/80">
                          {formatBodyMeasurementDate(m.recorded_at)}
                        </div>
                        {m.weightDelta ? (
                          <Badge variant="secondary" className="text-[10px] font-bold bg-primary/5 text-primary border-primary/10">
                            {m.weightDelta}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-bold opacity-30">Inicial</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Peso</span>
                          <div className="text-xl font-black text-foreground italic flex items-baseline gap-1">
                            {m.weight ?? "—"} <span className="text-[10px] font-bold not-italic text-muted-foreground uppercase opacity-60">kg</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Grasa</span>
                          <div className="text-xl font-black text-foreground italic flex items-baseline gap-1">
                            {m.body_fat_pct ?? "—"} <span className="text-[10px] font-bold not-italic text-muted-foreground uppercase opacity-60">%</span>
                          </div>
                        </div>
                        {m.waist_cm != null && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Cintura</span>
                            <div className="text-xl font-black text-foreground italic flex items-baseline gap-1">
                              {m.waist_cm} <span className="text-[10px] font-bold not-italic text-muted-foreground uppercase opacity-60">cm</span>
                            </div>
                          </div>
                        )}
                        {m.hip_cm != null && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Cadera</span>
                            <div className="text-xl font-black text-foreground italic flex items-baseline gap-1">
                              {m.hip_cm} <span className="text-[10px] font-bold not-italic text-muted-foreground uppercase opacity-60">cm</span>
                            </div>
                          </div>
                        )}
                        {m.chest_cm != null && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Pecho</span>
                            <div className="text-xl font-black text-foreground italic flex items-baseline gap-1">
                              {m.chest_cm} <span className="text-[10px] font-bold not-italic text-muted-foreground uppercase opacity-60">cm</span>
                            </div>
                          </div>
                        )}
                        {m.arm_cm != null && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Brazo</span>
                            <div className="text-xl font-black text-foreground italic flex items-baseline gap-1">
                              {m.arm_cm} <span className="text-[10px] font-bold not-italic text-muted-foreground uppercase opacity-60">cm</span>
                            </div>
                          </div>
                        )}
                        {m.thigh_cm != null && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Muslo</span>
                            <div className="text-xl font-black text-foreground italic flex items-baseline gap-1">
                              {m.thigh_cm} <span className="text-[10px] font-bold not-italic text-muted-foreground uppercase opacity-60">cm</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="photos"
          className="flex flex-col gap-8 focus-visible:outline-none pt-2"
        >
          <Tabs defaultValue="gallery" className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 px-1">
              <div>
                <h3 className="text-[17px] font-bold tracking-tight">Registro Visual</h3>
                <p className="text-sm font-medium text-muted-foreground">
                  Monitorea el progreso físico del asesorado.
                </p>
              </div>
              <TabsList className="grid grid-cols-2 w-full sm:w-[300px] h-12 p-1 bg-card/60 backdrop-blur-xl border border-border/50 shadow-sm rounded-[1rem]">
                <TabsTrigger
                  value="gallery"
                  className="rounded-lg gap-2 text-[13px] font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all"
                >
                  <LayoutGrid className="size-4" />
                  Galería
                </TabsTrigger>
                <TabsTrigger
                  value="compare"
                  className="rounded-lg gap-2 text-[13px] font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all"
                >
                  <Diff className="size-4" />
                  Comparador
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="gallery" className="focus-visible:outline-none">
              {(progressPhotos || []).length === 0 ? (
                <Empty className="border-2 border-dashed bg-muted/20 rounded-3xl py-16">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Camera className="text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle>Sin fotos de progreso</EmptyTitle>
                    <EmptyDescription>
                      El asesorado aún no ha cargado imágenes de su evolución.
                      Puedes pedirle que suba fotos desde su perfil.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <PhotoGallery
                  photos={progressPhotos as ProgressPhoto[]}
                  showActions={false} // Admin can't delete for now, or we can enable if needed
                />
              )}
            </TabsContent>

            <TabsContent value="compare" className="focus-visible:outline-none">
              <PhotoCompare photos={progressPhotos as ProgressPhoto[]} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="notes" className="flex flex-col gap-4 pt-2">
          <Card className="border-border/50 bg-card/60 backdrop-blur-xl rounded-[1.5rem] shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Notebook className="size-4" />
                Notas del coach
              </CardTitle>
              <CardDescription>
                Privadas: solo el equipo de asesoría las ve en esta ficha.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="coach-private-notes">
                    Observaciones
                  </FieldLabel>
                  <FieldDescription>
                    Lesiones, preferencias, límites, estilo de entreno o
                    acuerdos con el asesorado.
                  </FieldDescription>
                  <FieldContent>
                    <Textarea
                      id="coach-private-notes"
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Escribe notas útiles para seguimiento..."
                      className="min-h-36 resize-y"
                    />
                  </FieldContent>
                </Field>
              </FieldGroup>

              {saveError ? (
                <div className="text-destructive text-sm" role="alert">
                  {saveError}
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t bg-muted/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-xs">
                Los cambios se guardan al pulsar guardar. Descartar restaura el
                último valor guardado.
              </p>
              <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setNotesDraft(savedNotes);
                    setSaveError(null);
                  }}
                  disabled={isSaving}
                >
                  Descartar
                </Button>
                <Button type="button" onClick={saveNotes} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Spinner
                        data-icon="inline-start"
                        className="opacity-80"
                      />
                      Guardando…
                    </>
                  ) : (
                    "Guardar notas"
                  )}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="flex flex-col gap-4 pt-2">
           <Card className="border-border/50 bg-card/60 backdrop-blur-xl rounded-[1.5rem] shadow-sm overflow-hidden">
             <CardHeader className="pb-3 text-center sm:text-left">
               <CardTitle className="flex items-center justify-center sm:justify-start gap-2 text-base">
                 <Trophy className="size-4 text-primary" />
                 Logros y Títulos
               </CardTitle>
               <CardDescription>
                 Hitos desbloqueados por el atleta a través de su esfuerzo y consistencia.
               </CardDescription>
             </CardHeader>
             <CardContent className="p-4 sm:p-6 lg:p-10">
                {userAchievements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center">
                     <div className="relative mb-6">
                        <Trophy className="size-16 opacity-5" />
                        <Dumbbell className="size-8 opacity-10 absolute -top-2 -right-2 rotate-12" />
                     </div>
                     <div className="text-[11px] font-black uppercase tracking-[0.3em] opacity-30 mt-2">Próximamente desbloqueará hitos</div>
                     <p className="text-xs text-muted-foreground/40 mt-4 max-w-xs mx-auto">Los logros se otorgan automáticamente basándose en la consistencia y récords personales.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-10 sm:gap-x-8 sm:gap-y-12">
                    {userAchievements.map((ua) => (
                      <div key={ua.id} className="flex flex-col items-center gap-3 group">
                        <div className="relative transition-transform duration-300 group-hover:scale-110">
                           <AchievementBadge
                             achievement={ua.achievements}
                             unlocked={true}
                             size="lg"
                             showDetails={false}
                             showMilestoneBadge={true}
                           />
                           <div className="absolute -inset-4 bg-primary/5 rounded-full -z-10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex flex-col items-center text-center gap-1">
                           <div className="text-[11px] font-black uppercase tracking-wider text-foreground leading-tight px-2 line-clamp-2 min-h-[2.2em]">
                             {ua.achievements.name}
                           </div>
                           <time className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter">
                             {formatDate(ua.unlocked_at)}
                           </time>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
