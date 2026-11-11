import { getAuthData } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Plus, Dumbbell, CalendarDays, Sigma, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminKpiStatCard } from "@/components/admin/admin-kpi-stat-card";
import {
  ADMIN_DATA_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";
import type { AssignableClientItem } from "@/components/admin/routines/assign-routine-modal";
import RoutineCardsClient, {
  type RoutineCardItem,
} from "./routine-cards-client";

type RoutineDayRow = {
  id: string;
  is_rest_day: boolean | null;
  routine_exercises?: { id: string | number }[] | null;
};

type ClientRoutineRow = {
  id: string;
  is_active: boolean | null;
};

type RoutineListRow = {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  level: string | null;
  duration_weeks: number | null;
  days_per_week: number | null;
  routine_days: RoutineDayRow[] | null;
  client_routines: ClientRoutineRow[] | null;
};

type RawClientRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  assigned_routine_id: string | null;
  routines: { name: string | null } | { name: string | null }[] | null;
};

function toRoutineCardItem(r: RoutineListRow): RoutineCardItem {
  const activeClientsCount = (r.client_routines ?? []).filter(
    (cr) => cr.is_active,
  ).length;

  return {
    id: r.id,
    name: r.name,
    description: r.description,
    goal: r.goal,
    level: r.level,
    duration_weeks: r.duration_weeks,
    days_per_week: r.days_per_week,
    routine_days: r.routine_days ?? undefined,
    active_clients_count: activeClientsCount,
  };
}

export default async function AdminRoutinesPage() {
  const { user, role } = await getAuthData();

  if (!user || role !== "admin") {
    redirect("/auth/login");
  }

  const supabase = await createClient();

  const [{ data: routinesRaw }, { data: clientsRaw }] = await Promise.all([
    supabase
      .from("routines")
      .select(
        `
        id,
        name,
        description,
        goal,
        level,
        duration_weeks,
        days_per_week,
        routine_days (
          id,
          is_rest_day,
          routine_exercises (id)
        ),
        client_routines (
          id,
          is_active
        )
      `,
      )
      .eq("coach_id", user.id)
      .order("created_at", { ascending: false }),
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

  const safeRoutines = (routinesRaw ?? []) as unknown as RoutineListRow[];
  const routineCards = safeRoutines.map(toRoutineCardItem);

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

  const totalRoutines = safeRoutines.length;
  const totalActiveAssignments = routineCards.reduce(
    (acc, r) => acc + (r.active_clients_count ?? 0),
    0,
  );
  const totalWeeklyDays = safeRoutines.reduce(
    (acc, r) =>
      acc +
      (r.routine_days && r.routine_days.length > 0
        ? r.routine_days.filter((day) => !day.is_rest_day).length
        : (r.days_per_week ?? 0)),
    0,
  );
  const avgDuration =
    totalRoutines > 0
      ? Math.round(
          safeRoutines.reduce((acc, r) => acc + (r.duration_weeks ?? 0), 0) /
            totalRoutines,
        )
      : 0;

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        sticky
        title="Rutinas de Entrenamiento"
        description={
          <>
            {totalRoutines} rutina{totalRoutines !== 1 ? "s" : ""} creada
            {totalRoutines !== 1 ? "s" : ""} · {totalActiveAssignments}{" "}
            asignación{totalActiveAssignments !== 1 ? "es" : ""} activa
            {totalActiveAssignments !== 1 ? "s" : ""}
          </>
        }
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/admin/routines/builder">
              <Plus className="mr-2 size-4" />
              Nueva Rutina (Builder)
            </Link>
          </Button>
        }
      />

      <div className={ADMIN_DATA_PAGE_SHELL}>
        {totalRoutines > 0 && (
          <section className="mb-6 grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
            <AdminKpiStatCard
              icon={Dumbbell}
              value={totalRoutines}
              label="Rutinas"
            />
            <AdminKpiStatCard
              icon={Users}
              value={totalActiveAssignments}
              label="Asesorados asignados"
            />
            <AdminKpiStatCard
              icon={CalendarDays}
              value={totalWeeklyDays}
              label="Días entreno / semana"
            />
            <AdminKpiStatCard
              icon={Sigma}
              value={`${avgDuration || "-"} sem`}
              label="Promedio duración"
            />
          </section>
        )}

        {routineCards.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No hay rutinas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                No tienes rutinas creadas aún. Crea una nueva para asignarla a
                tus clientes.
              </p>
              <Button asChild>
                <Link href="/admin/routines/builder">Crear primera rutina</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <RoutineCardsClient
            routines={routineCards}
            clients={assignableClients}
          />
        )}
      </div>
    </div>
  );
}

