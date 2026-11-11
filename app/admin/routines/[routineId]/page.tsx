import type { Metadata } from "next";
import { getAuthData } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Sparkles,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { RoutineDayCards } from "@/components/routines/routine-day-cards";
import {
  ADMIN_DATA_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";
import { getGoalLabel, getLevelLabel } from "@/lib/constants";
import type { AssignableClientItem } from "@/components/admin/routines/assign-routine-modal";
import { RoutineDetailActions } from "./routine-detail-actions";
import { WeeklyMuscleCoverage } from "@/components/anatomy/weekly-muscle-coverage";
import { calculateMuscleLoad } from "@/lib/anatomy/muscles";

type RoutineExerciseStat = {
  id: string | number;
  sets?: number | null;
};

type RoutineDayStat = {
  is_rest_day: boolean | null;
  routine_exercises?: RoutineExerciseStat[] | null;
};

type AssignedClientRelation = {
  id: string;
  is_active: boolean | null;
  assigned_at: string | null;
  notes: string | null;
  clients:
    | {
        id: string;
        full_name: string | null;
        email: string | null;
        status: string | null;
      }
    | {
        id: string;
        full_name: string | null;
        email: string | null;
        status: string | null;
      }[]
    | null;
};

type RawClientRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  assigned_routine_id: string | null;
  routines: { name: string | null } | { name: string | null }[] | null;
};

interface Props {
  params: Promise<{ routineId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { routineId } = await params;
  const supabase = await createClient();
  const { data: routine } = await supabase
    .from("routines")
    .select("name")
    .eq("id", routineId)
    .single();
  return {
    title: routine?.name || "Rutina",
  };
}

export default async function RoutineDetailsPage({ params }: Props) {
  const { user, role } = await getAuthData();
  const { routineId } = await params;

  if (!user || role !== "admin") {
    redirect("/auth/login");
  }

  const supabase = await createClient();

  const [{ data: routine }, { data: clientsRaw }] = await Promise.all([
    supabase
      .from("routines")
      .select(
        `
        *,
        routine_days (
          *,
          routine_exercises (
            *,
            exercises (*)
          )
        ),
        client_routines (
          id,
          is_active,
          assigned_at,
          notes,
          clients (
            id,
            full_name,
            email,
            status
          )
        )
      `,
      )
      .eq("id", routineId)
      .eq("coach_id", user.id)
      .single(),
    supabase
      .from("clients")
      .select(
        `
        id,
        full_name,
        email,
        status,
        assigned_routine_id,
        routines:assigned_routine_id (name)
      `,
      )
      .or(`coach_id.eq.${user.id},coach_id.is.null`)
      .order("full_name", { ascending: true }),
  ]);

  if (!routine) {
    redirect("/admin/routines");
  }

  const assignableClients: AssignableClientItem[] = (
    (clientsRaw ?? []) as unknown as RawClientRow[]
  ).map((c) => {
    const routineRel = Array.isArray(c.routines) ? c.routines[0] : c.routines;
    return {
      id: c.id,
      full_name: c.full_name || "Asesorado sin nombre",
      email: c.email,
      status: c.status,
      assigned_routine_id: c.assigned_routine_id,
      current_routine_name: routineRel?.name ?? null,
    };
  });

  const configuredDays = (routine.routine_days ?? []) as RoutineDayStat[];
  const hasConfiguredDays = configuredDays.length > 0;
  const trainingDaysPerWeek = hasConfiguredDays
    ? configuredDays.filter((day) => !day.is_rest_day).length
    : (routine.days_per_week ?? 0);

  const totalExercises = configuredDays.reduce(
    (sum, day) =>
      sum + (day.is_rest_day ? 0 : (day.routine_exercises?.length ?? 0)),
    0,
  );
  const totalWeeklySets = configuredDays.reduce(
    (sum, day) =>
      sum +
      (day.is_rest_day
        ? 0
        : (day.routine_exercises ?? []).reduce(
            (s, ex) => s + (ex.sets ?? 0),
            0,
          )),
    0,
  );

  const allRoutineExerciseItems = (routine.routine_days ?? []).flatMap((day: any) =>
    day.is_rest_day
      ? []
      : (day.routine_exercises ?? []).map((re: any) => ({
          exercise: re.exercises || {},
          sets: re.sets ?? 3,
        }))
  );
  const routineMuscleLoad = calculateMuscleLoad(allRoutineExerciseItems);

  const activeAssignedClients = (
    (routine.client_routines ?? []) as unknown as AssignedClientRelation[]
  )
    .filter((cr) => cr.is_active)
    .map((cr) => {
      const clientObj = Array.isArray(cr.clients) ? cr.clients[0] : cr.clients;
      return clientObj
        ? {
            assignmentId: cr.id,
            id: clientObj.id,
            full_name: clientObj.full_name || "Asesorado",
            email: clientObj.email,
            status: clientObj.status,
            notes: cr.notes,
          }
        : null;
    })
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const levelDisplay = getLevelLabel(routine.level);
  const goalDisplay = getGoalLabel(routine.goal);

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        title={routine.name}
        backHref="/admin/routines"
        backLabel="Volver a rutinas"
        description={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{levelDisplay}</Badge>
            <Badge variant="outline">{goalDisplay}</Badge>
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 text-primary"
            >
              <Users className="mr-1 size-3" />
              {activeAssignedClients.length} asesorado
              {activeAssignedClients.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        }
        actions={
          <RoutineDetailActions
            routineId={routineId}
            routineName={routine.name}
            clients={assignableClients}
          />
        }
      />

      <div className={ADMIN_DATA_PAGE_SHELL}>
        <div className="grid gap-6">
          {/* Routine Info */}
          <Card className="rounded-[1.5rem] border-border/50 bg-card/60 shadow-sm backdrop-blur-xl overflow-hidden">
            <CardHeader className="bg-muted/10 pb-4 border-b border-border/30">
              <CardTitle className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-4.5" />
                </div>
                Información de la rutina
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-5 bg-card/40">
              <div className="rounded-xl border border-border/40 bg-background/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                  Descripción
                </p>
                <p className="text-[14px] leading-relaxed text-foreground/90 font-medium">
                  {routine.description || "Sin descripción"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-border/40 bg-background/50 p-4 flex flex-col justify-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Nivel / Objetivo
                  </p>
                  <p className="font-semibold text-[15px] text-foreground">
                    {levelDisplay}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {goalDisplay}
                  </p>
                </div>
                <div className="rounded-xl border border-border/40 bg-background/50 p-4 flex flex-col justify-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Duración
                  </p>
                  <p className="font-semibold text-[15px] text-foreground">
                    {routine.duration_weeks
                      ? `${routine.duration_weeks} semanas`
                      : "Continua (según membresía)"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/40 bg-background/50 p-4 flex flex-col justify-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Frecuencia
                  </p>
                  <p className="font-semibold text-[15px] text-foreground">
                    {trainingDaysPerWeek} día
                    {trainingDaysPerWeek !== 1 ? "s" : ""} / semana
                  </p>
                </div>
                <div className="rounded-xl border border-border/40 bg-background/50 p-4 flex flex-col justify-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Volumen semanal
                  </p>
                  <p className="font-semibold text-[15px] text-foreground">
                    {totalExercises} ej. · {totalWeeklySets} series
                  </p>
                </div>
              </div>

              {activeAssignedClients.length > 0 && (
                <div className="rounded-xl border border-border/40 bg-background/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2.5 flex items-center gap-1.5">
                    <Users className="size-3.5 text-primary" />
                    Asesorados entrenando con este plan (
                    {activeAssignedClients.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeAssignedClients.map((client) => (
                      <Link
                        key={client.assignmentId}
                        href={`/admin/clients/${client.id}`}
                        className="group inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                      >
                        <span className="size-2 rounded-full bg-emerald-500" />
                        <span>{client.full_name}</span>
                        <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] border-border/50 bg-card/60 shadow-sm backdrop-blur-xl overflow-hidden">
            <CardHeader className="bg-muted/10 pb-4 border-b border-border/30">
              <CardTitle className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-4.5" />
                </div>
                Distribución anatómica y volumen semanal
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <WeeklyMuscleCoverage load={routineMuscleLoad} />
            </CardContent>
          </Card>

          <section className="grid gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Plan semanal</h2>
            </div>
            <RoutineDayCards days={routine.routine_days || []} />
          </section>
        </div>
      </div>
    </div>
  );
}

