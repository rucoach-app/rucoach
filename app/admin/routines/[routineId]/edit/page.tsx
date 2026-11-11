import { getAuthData } from "@/lib/auth-utils";
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ADMIN_DATA_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";
import { RoutineBuilderClient } from "../../builder/routine-builder-client";
import { normalizeRoutineLevel } from "@/lib/constants";

type RoutineExerciseRow = {
  id: string | number;
  exercise_id: string;
  order_index: number;
  sets: number | null;
  reps: string | number | null;
  rest_seconds: number | null;
  superset_group: string | null;
  notes: string | null;
  warmup_sets?: string | null;
};

type RoutineDayRow = {
  id: string;
  day_number: number;
  day_name: string | null;
  focus: string | null;
  is_rest_day: boolean | null;
  routine_exercises: RoutineExerciseRow[] | null;
};

interface Props {
  params: Promise<{ routineId: string }>;
}

export default async function EditRoutinePage({ params }: Props) {
  const [{ user, role }, { routineId }] = await Promise.all([
    getAuthData(),
    params,
  ]);

  if (!user) redirect("/auth/login");
  if (role !== "admin") redirect("/client/dashboard");

  const admin = createAdminClient();
  const { data: routine } = await admin
    .from("routines")
    .select(
      `
      *,
      routine_days (
        id,
        day_number,
        day_name,
        focus,
        is_rest_day,
        routine_exercises (
          *
        )
      )
    `,
    )
    .eq("id", routineId)
    .single();

  if (!routine) notFound();

  if (routine.coach_id && routine.coach_id !== user.id) {
    redirect("/admin/routines");
  }

  const dayNames = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ];
  const existingDays: RoutineDayRow[] = (
    (routine.routine_days ?? []) as RoutineDayRow[]
  )
    .slice()
    .sort((a, b) => a.day_number - b.day_number);

  const builderInitialData = {
    name: routine.name,
    description: routine.description || "",
    durationWeeks: routine.duration_weeks ?? null,
    goal: routine.goal ?? "",
    level: normalizeRoutineLevel(routine.level) || routine.level || "",
    days: dayNames.map((name, i) => {
      const rd = existingDays.find((d) => d.day_number === i + 1);
      if (rd) {
        return {
          id: rd.id,
          dayNumber: rd.day_number,
          name: rd.day_name ?? name,
          focus: rd.focus ?? "",
          isRestDay: rd.is_rest_day ?? false,
          exercises: (rd.routine_exercises ?? [])
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
            .map((re) => ({
              id: String(re.id),
              exerciseId: re.exercise_id,
              sets: re.sets ?? 3,
              reps: re.reps != null && String(re.reps).trim() !== "" ? String(re.reps) : "10-12",
              restSeconds: re.rest_seconds ?? 60,
              supersetGroup: re.superset_group ?? null,
              notes: re.notes ?? "",
              warmupSets: re.warmup_sets ?? "",
            })),
        };
      }
      return {
        id: String(i + 1),
        dayNumber: i + 1,
        name,
        focus: "",
        isRestDay: [5, 6].includes(i),
        exercises: [],
      };
    }),
  };

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        sticky
        title="Editar rutina"
        description={routine.name}
        backHref={`/admin/routines/${routineId}`}
        backLabel="Volver a la rutina"
      />

      <div className={ADMIN_DATA_PAGE_SHELL}>
        <RoutineBuilderClient
          routineId={routineId}
          initialData={builderInitialData}
        />
      </div>
    </div>
  );
}
