import type { Metadata } from "next";
import Link from "next/link";
import { getAuthUser, getUserRole } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getExerciseLogsForSessions,
  getWorkoutSessions,
} from "@/lib/workouts";
import { getRoutineById } from "@/lib/routines";
import {
  ClientProfileHub,
  type ClientHubClient,
  type HubWorkoutSession,
} from "./client-profile-hub";
import type { Routine } from "@/lib/types";
import { AccessCodeBanner } from "./access-code-banner";
import {
  ADMIN_DATA_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { CreditCard, Dumbbell, Edit2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ accessCode?: string; emailSent?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("full_name")
    .eq("id", clientId)
    .single();
  return {
    title: client?.full_name || "Atleta",
  };
}

/** Medidas recientes suficientes para la ficha (evita traer miles de filas). */
const HUB_MEASUREMENTS_LIMIT = 150;

export default async function ClientProfilePage({
  params,
  searchParams,
}: Props) {
  const user = await getAuthUser();
  const role = await getUserRole();
  const { clientId } = await params;
  const { accessCode, emailSent } = await searchParams;

  if (!user) redirect("/auth/login");
  if (role !== "admin") redirect("/auth/login");

  const supabase = await createClient();

  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .single();

  if (error || !client) redirect("/admin/clients");

  const planPromise =
    client.current_plan_id != null
      ? supabase
          .from("membership_plans")
          .select("name")
          .eq("id", client.current_plan_id)
          .single()
      : Promise.resolve({ data: null as { name: string } | null });

  const adminClient = createAdminClient();

  const profilePromise = client.user_id
    ? adminClient
        .from("profiles")
        .select(
          "role, streak_days, last_workout_at, xp_points, level, onboarding_completed",
        )
        .eq("id", client.user_id)
        .single()
    : Promise.resolve({ data: null });

  const [
    planRes,
    profileRes,
    workoutSessions,
    bodyMeasurementsRes,
    photosRes,
    activeClientRoutineRes,
    prsRes,
    achievementsRes,
    painReportsRes,
    pendingInviteRes,
  ] = await Promise.all([
    planPromise,
    profilePromise,
    getWorkoutSessions(clientId, 365),
    supabase
      .from("body_measurements")
      .select(
        "id, recorded_at, weight, body_fat_pct, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm",
      )
      .eq("client_id", clientId)
      .order("recorded_at", { ascending: false })
      .limit(HUB_MEASUREMENTS_LIMIT),
    supabase
      .from("progress_photos")
      .select(
        "id, photo_url, view_type, weight_kg, taken_at, notes, created_at",
      )
      .eq("client_id", clientId)
      .order("taken_at", { ascending: false })
      .limit(30),
    supabase
      .from("client_routines")
      .select("id, routine_id")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("personal_records")
      .select("exercise_id, exercise_name, weight_kg, reps, achieved_at")
      .eq("client_id", clientId)
      .order("achieved_at", { ascending: false }),
    client.user_id
      ? adminClient
          .from("user_achievements")
          .select("*, achievements(*)")
          .eq("user_id", client.user_id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("client_pain_reports")
      .select("id, body_region, severity, notes, is_active, reported_at")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("reported_at", { ascending: false }),
    !client.user_id
      ? supabase
          .from("invitation_codes")
          .select("id, code")
          .eq("client_id", clientId)
          .eq("is_active", true)
          .eq("times_used", 0)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null as { id: string; code: string } | null }),
  ]);

  const bodyMeasurements = bodyMeasurementsRes.data ?? [];
  const personalRecords = prsRes.data ?? [];
  const userAchievements = (achievementsRes.data as any[]) ?? [];
  const activePainReports = painReportsRes.data ?? [];
  const pendingInvite = pendingInviteRes.data ?? null;
  const effectiveAccessCode = accessCode || pendingInvite?.code || null;

  const activeClientRoutineId = activeClientRoutineRes.data?.id ?? null;
  const routineIdFromClient =
    (client as { assigned_routine_id?: string | null }).assigned_routine_id ??
    activeClientRoutineRes.data?.routine_id ??
    null;

  const [sessionExerciseLogs, overridesRes, routine] = await Promise.all([
    getExerciseLogsForSessions(workoutSessions.map((s) => s.id)),
    activeClientRoutineId
      ? supabase
          .from("client_exercise_overrides")
          .select(
            "id, client_routine_id, original_routine_exercise_id, replacement_exercise_id, reason, changed_by, created_at, exercises!replacement_exercise_id(id, name, name_es), routine_exercises!original_routine_exercise_id(id, exercises(id, name, name_es), routine_days(day_number, day_name))",
          )
          .eq("client_routine_id", activeClientRoutineId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    routineIdFromClient
      ? getRoutineById(routineIdFromClient)
      : Promise.resolve(null),
  ]);

  const exerciseOverrides = overridesRes.data ?? [];

  const planName = planRes.data?.name ?? null;
  const profile = profileRes.data ?? null;
  const progressPhotos = photosRes.data ?? [];

  const daysUntilExpiry = client.membership_end
    ? Math.ceil(
        (new Date(client.membership_end).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  const clientWithExtras = {
    ...client,
    plan_name: planName,
    days_until_expiry: daysUntilExpiry,
  };

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        title={client.full_name}
        backHref="/admin/clients"
        backLabel="Volver a asesorados"
        description={`${planName ? `Plan de asesoría: ${planName}` : "Sin plan de asesoría"}${
          profile?.streak_days != null
            ? ` · ${profile.streak_days} días racha`
            : ""
        }`}
        actions={
          <>
            {client.user_id && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-initial gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3.5"
              >
                <Link href={`/admin/messages?clientId=${client.user_id}`}>
                  <MessageSquare className="size-3.5 sm:size-4 shrink-0" />
                  <span>Mensaje</span>
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3.5"
            >
              <Link href={`/admin/payments/new?clientId=${clientId}`}>
                <CreditCard className="size-3.5 sm:size-4 shrink-0" />
                <span>
                  <span className="hidden sm:inline">Registrar </span>Pago
                </span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3.5"
            >
              <Link href={`/admin/clients/${clientId}/edit`}>
                <Edit2 className="size-3.5 sm:size-4 shrink-0" />
                <span>
                  Editar<span className="hidden sm:inline"> cliente</span>
                </span>
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="flex-1 sm:flex-initial gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3.5"
            >
              <Link href={`/admin/clients/${clientId}/assign-routine`}>
                <Dumbbell className="size-3.5 sm:size-4 shrink-0" />
                <span className="sm:hidden">Rutina</span>
                <span className="hidden sm:inline">
                  {routine ? "Cambiar rutina" : "Asignar rutina"}
                </span>
              </Link>
            </Button>
          </>
        }
      />

      <div className={cn(ADMIN_DATA_PAGE_SHELL, "flex flex-col gap-8")}>
        {client.status === "pending_payment" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <CreditCard className="size-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Activación de Membresía Pendiente
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  <strong>{client.full_name}</strong> ya completó su onboarding inicial y está esperando la confirmación de su pago para desbloquear su acceso a la app.
                </p>
              </div>
            </div>
            <Button asChild size="sm" className="rounded-xl font-bold shrink-0">
              <Link href={`/admin/payments/new?clientId=${clientId}`}>
                <CreditCard className="mr-2 size-4" />
                Registrar Pago y Activar
              </Link>
            </Button>
          </div>
        )}
        {effectiveAccessCode && !client.user_id && (
          <AccessCodeBanner
            code={effectiveAccessCode}
            codeId={pendingInvite?.id ?? null}
            clientName={client.full_name}
            clientEmail={client.email}
            clientPhone={client.phone}
            emailSent={emailSent === "1"}
            emailFailed={emailSent === "0"}
          />
        )}
        <ClientProfileHub
          client={clientWithExtras as ClientHubClient}
          profile={profile}
          routine={routine as Routine | null}
          workoutSessions={workoutSessions as HubWorkoutSession[]}
          sessionExerciseLogs={sessionExerciseLogs}
          bodyMeasurements={bodyMeasurements}
          progressPhotos={progressPhotos ?? []}
          personalRecords={personalRecords}
          userAchievements={userAchievements}
          painReports={activePainReports as any}
          exerciseOverrides={exerciseOverrides as any}
          clientId={clientId}
        />
      </div>
    </div>
  );
}
