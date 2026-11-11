"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FitnessGoal, ExperienceLevel } from "@/lib/types";
import { formatDateKeyInTimezone } from "@/lib/calendar-date";

/** Mapea FitnessGoal (onboarding) a clients.goal (DB) */
const GOAL_MAP: Record<FitnessGoal, string> = {
  lose_weight: "weight_loss",
  gain_muscle: "muscle_gain",
  maintain: "maintenance",
  strength: "toning",
  endurance: "endurance",
};

/** Mapea clients.goal (DB) a FitnessGoal (profiles) */
const GOAL_REVERSE: Record<string, FitnessGoal> = {
  weight_loss: "lose_weight",
  muscle_gain: "gain_muscle",
  maintenance: "maintain",
  toning: "strength",
  endurance: "endurance",
};

interface OnboardingData {
  userId: string;
  fullName: string;
  username: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  height?: number;
  initialWeight?: number;
  waistCm?: number;
  bodyFatPct?: number;
  fitnessGoal: FitnessGoal;
  experienceLevel: ExperienceLevel;
  trainingDaysPerWeek?: number;
  injuryRegion?: string | null;
  injurySeverity?: number;
  injuryNotes?: string;
  notificationsEnabled?: boolean;
}

export interface OnboardingInitialData {
  fullName: string;
  username: string;
  phone: string;
  birthDate: string;
  gender: string;
  height: string;
  initialWeight: string;
  fitnessGoal: FitnessGoal | null;
  experienceLevel: ExperienceLevel | null;
}

import { notifyUser } from "@/lib/push";
import { sendWelcomeEmail } from "@/lib/email";

const PAIN_REGION_LABELS: Record<string, string> = {
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

/**
 * Obtiene los datos pre-registrados por el coach o en el perfil para pre-llenar el onboarding.
 */
export async function getOnboardingInitialData(
  userId: string,
  userEmail?: string | null,
): Promise<OnboardingInitialData> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "full_name, username, phone, birth_date, gender, fitness_goal, experience_level",
    )
    .eq("id", userId)
    .maybeSingle();

  let { data: client } = await admin
    .from("clients")
    .select(
      "full_name, phone, birth_date, gender, height, initial_weight, current_weight, goal, experience_level",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!client && userEmail) {
    const { data: clientByEmail } = await admin
      .from("clients")
      .select(
        "full_name, phone, birth_date, gender, height, initial_weight, current_weight, goal, experience_level",
      )
      .eq("email", userEmail)
      .is("user_id", null)
      .limit(1)
      .maybeSingle();
    client = clientByEmail;
  }

  const rawFullName =
    client?.full_name && client.full_name !== "Nuevo Asesorado"
      ? client.full_name
      : profile?.full_name && profile.full_name !== "Usuario"
        ? profile.full_name
        : "";

  const mappedGoal =
    (profile?.fitness_goal as FitnessGoal | null) ??
    (client?.goal ? (GOAL_REVERSE[client.goal] ?? null) : null);

  const mappedExperience =
    (profile?.experience_level as ExperienceLevel | null) ??
    ((client?.experience_level as ExperienceLevel | null) || null);

  const weightVal = client?.initial_weight ?? client?.current_weight ?? null;

  return {
    fullName: rawFullName,
    username: profile?.username || "",
    phone: client?.phone || profile?.phone || "",
    birthDate: client?.birth_date || profile?.birth_date || "",
    gender: client?.gender || profile?.gender || "",
    height: client?.height ? String(client.height) : "",
    initialWeight: weightVal ? String(weightVal) : "",
    fitnessGoal: mappedGoal,
    experienceLevel: mappedExperience,
  };
}

export async function completeOnboarding(data: OnboardingData) {
  const supabase = await createClient();

  // Verificar que el usuario autenticado sea el que actualiza su propio perfil
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== data.userId) {
    return { success: false, error: "No autorizado" };
  }

  const cleanFullName = data.fullName.trim();
  const cleanUsername = data.username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "");

  if (cleanFullName.length < 2) {
    return {
      success: false,
      error: "Ingresa tu nombre completo (mínimo 2 caracteres).",
      field: "fullName",
    };
  }

  if (cleanUsername.length < 3 || cleanUsername.length > 24) {
    return {
      success: false,
      error: "El nombre de usuario debe tener entre 3 y 24 caracteres válidos.",
      field: "username",
    };
  }

  if (
    typeof data.height === "number" &&
    (data.height < 100 || data.height > 250)
  ) {
    return {
      success: false,
      error: "Ingresa una estatura válida entre 100 y 250 cm.",
      field: "height",
    };
  }

  if (
    typeof data.initialWeight === "number" &&
    (data.initialWeight < 30 || data.initialWeight > 300)
  ) {
    return {
      success: false,
      error: "Ingresa un peso válido entre 30 y 300 kg.",
      field: "initialWeight",
    };
  }

  const admin = createAdminClient();

  // Check if username is available
  const { data: existingUser } = await admin
    .from("profiles")
    .select("id")
    .eq("username", cleanUsername)
    .neq("id", data.userId)
    .maybeSingle();

  if (existingUser) {
    return {
      success: false,
      error: "Este nombre de usuario ya está en uso. Elige otro.",
      field: "username",
    };
  }

  // Update profile (admin bypassa RLS, evita recursión)
  const profileUpdate: Record<string, unknown> = {
    full_name: cleanFullName,
    username: cleanUsername,
    phone: data.phone?.trim() || null,
    birth_date: data.birthDate || null,
    gender: data.gender || null,
    fitness_goal: data.fitnessGoal,
    experience_level: data.experienceLevel,
    onboarding_completed: true,
    xp_points: 0,
    level: 1,
    streak_days: 0,
  };
  if (typeof data.notificationsEnabled === "boolean") {
    profileUpdate.notifications_enabled = data.notificationsEnabled;
  }
  const { error: profileError } = await admin
    .from("profiles")
    .update(profileUpdate)
    .eq("id", data.userId);

  if (profileError) {
    console.error("Profile update error:", profileError);
    return { success: false, error: "Error al actualizar el perfil" };
  }

  const clientGoal = GOAL_MAP[data.fitnessGoal] ?? "maintenance";

  // Construir resumen de onboarding para las notas del coach (disponibilidad + lesiones)
  const onboardingNotesParts: string[] = [];
  if (data.trainingDaysPerWeek) {
    onboardingNotesParts.push(
      `Disponibilidad: ${data.trainingDaysPerWeek} días/semana`,
    );
  }
  if (data.injuryRegion) {
    const regionLabel =
      PAIN_REGION_LABELS[data.injuryRegion] ?? data.injuryRegion;
    const sev = data.injurySeverity ?? 5;
    const extra = data.injuryNotes?.trim()
      ? ` (${data.injuryNotes.trim()})`
      : "";
    onboardingNotesParts.push(
      `Molestia inicial reportada: ${regionLabel} — severidad ${sev}/10${extra}`,
    );
  } else if (data.injuryNotes?.trim()) {
    onboardingNotesParts.push(
      `Observación física inicial: ${data.injuryNotes.trim()}`,
    );
  }
  const onboardingSummaryLine =
    onboardingNotesParts.length > 0
      ? `[Onboarding] ${onboardingNotesParts.join(" · ")}`
      : null;

  // Buscar cliente ya vinculado a este usuario
  let { data: existingClient } = await admin
    .from("clients")
    .select("id, notes")
    .eq("user_id", data.userId)
    .maybeSingle();

  const mergeClientNotes = (prevNotes?: string | null) => {
    if (!onboardingSummaryLine) return prevNotes ?? null;
    if (!prevNotes?.trim()) return onboardingSummaryLine;
    if (prevNotes.includes(onboardingSummaryLine)) return prevNotes;
    return `${prevNotes.trim()}\n\n${onboardingSummaryLine}`;
  };

  if (existingClient) {
    const clientUpdatePayload: Record<string, unknown> = {
      full_name: cleanFullName,
      phone: data.phone?.trim() || null,
      birth_date: data.birthDate || null,
      gender: data.gender || null,
      height: data.height || null,
      initial_weight: data.initialWeight || null,
      current_weight: data.initialWeight || null,
      goal: clientGoal,
      experience_level: data.experienceLevel,
      notes: mergeClientNotes(existingClient.notes),
    };

    const { error: updateError } = await admin
      .from("clients")
      .update(clientUpdatePayload)
      .eq("id", existingClient.id);

    if (updateError) {
      console.error(
        "Error updating existing client with onboarding data:",
        updateError,
      );
    }
  } else if (user.email) {
    // Fallback: cliente pre-creado por admin con mismo email pero sin user_id
    const { data: clientByEmail } = await admin
      .from("clients")
      .select("id, coach_id, goal, experience_level, full_name, status, notes")
      .eq("email", user.email)
      .is("user_id", null)
      .limit(1)
      .maybeSingle();

    if (clientByEmail) {
      const updatePayload: Record<string, unknown> = {
        user_id: data.userId,
        full_name: cleanFullName,
        phone: data.phone?.trim() || null,
        birth_date: data.birthDate || null,
        gender: data.gender || null,
        height: data.height || null,
        initial_weight: data.initialWeight || null,
        current_weight: data.initialWeight || null,
        goal: clientGoal,
        experience_level: data.experienceLevel,
        notes: mergeClientNotes(clientByEmail.notes),
      };

      if (clientByEmail.status === "pending") {
        updatePayload.status = "pending_payment";
      }

      const { error: linkError } = await admin
        .from("clients")
        .update(updatePayload)
        .eq("id", clientByEmail.id);

      if (linkError) {
        console.error(
          "[completeOnboarding] Error vinculando cliente por email:",
          linkError,
        );
      } else {
        existingClient = { id: clientByEmail.id, notes: clientByEmail.notes };
      }
    }
  }

  if (!existingClient) {
    const { data: usedInvitation } = await admin
      .from("invitation_codes")
      .select("created_by")
      .eq("used_by_user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let coachId = (usedInvitation?.created_by as string | null) ?? null;
    if (!coachId) {
      const { data: firstAdmin } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();
      coachId = firstAdmin?.id ?? null;
    }

    if (coachId) {
      const newClientId = crypto.randomUUID();
      const { error: clientError } = await admin.from("clients").insert({
        id: newClientId,
        user_id: data.userId,
        coach_id: coachId,
        full_name: cleanFullName,
        phone: data.phone?.trim() || null,
        email: user.email || "",
        birth_date: data.birthDate || null,
        gender: data.gender || null,
        height: data.height || null,
        initial_weight: data.initialWeight || null,
        current_weight: data.initialWeight || null,
        goal: clientGoal,
        experience_level: data.experienceLevel,
        notes: onboardingSummaryLine,
        status: "pending_payment",
      });

      if (clientError) {
        console.error("Client creation error:", clientError);
      } else {
        existingClient = { id: newClientId, notes: onboardingSummaryLine };
      }
    }
  }

  const { data: finalClient } = await admin
    .from("clients")
    .select("id, coach_id")
    .eq("user_id", data.userId)
    .maybeSingle();

  const resolvedClientId = finalClient?.id ?? existingClient?.id ?? null;

  // 1. Registrar medición base inicial en body_measurements para que las gráficas tengan Punto de Partida desde el Día 1
  if (
    resolvedClientId &&
    (typeof data.initialWeight === "number" ||
      typeof data.waistCm === "number" ||
      typeof data.bodyFatPct === "number")
  ) {
    try {
      const { count } = await admin
        .from("body_measurements")
        .select("id", { count: "exact", head: true })
        .eq("client_id", resolvedClientId);

      if ((count ?? 0) === 0) {
        const todayIso = `${formatDateKeyInTimezone(new Date())}T12:00:00Z`;
        await admin.from("body_measurements").insert({
          client_id: resolvedClientId,
          recorded_at: todayIso,
          weight:
            typeof data.initialWeight === "number" ? data.initialWeight : null,
          waist_cm: typeof data.waistCm === "number" ? data.waistCm : null,
          body_fat_pct:
            typeof data.bodyFatPct === "number" ? data.bodyFatPct : null,
        });
      }
    } catch (measurementErr) {
      console.warn(
        "[completeOnboarding] No se pudo insertar medición inicial:",
        measurementErr,
      );
    }
  }

  // 2. Si el asesorado reportó una molestia o lesión articular activa, registrarla en client_pain_reports
  if (resolvedClientId && data.injuryRegion) {
    try {
      const severity = Math.min(
        10,
        Math.max(1, Math.round(data.injurySeverity ?? 5)),
      );
      await admin.from("client_pain_reports").insert({
        client_id: resolvedClientId,
        body_region: data.injuryRegion,
        severity,
        notes: data.injuryNotes?.trim() || "Reportado durante el onboarding inicial",
        is_active: true,
      });
    } catch (painErr) {
      console.warn(
        "[completeOnboarding] No se pudo crear reporte de dolor inicial:",
        painErr,
      );
    }
  }

  const tasks: Promise<unknown>[] = [];

  if (user.email) {
    tasks.push(
      sendWelcomeEmail({
        to: user.email,
        clientName: cleanFullName,
      }).catch((err) => console.error("Error enviando email bienvenida:", err)),
    );
  }

  if (finalClient?.coach_id) {
    const injuryAlertSuffix = data.injuryRegion
      ? ` ⚠️ Reportó molestia en ${PAIN_REGION_LABELS[data.injuryRegion] ?? data.injuryRegion}.`
      : "";
    tasks.push(
      notifyUser(finalClient.coach_id, {
        title: "Nuevo expediente completado",
        body: `${cleanFullName} completó su onboarding inicial.${injuryAlertSuffix}`,
        url: resolvedClientId
          ? `/admin/clients/${resolvedClientId}`
          : "/admin/clients",
        tag: `onboarding-${data.userId}`,
      }),
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }

  return { success: true };
}

/**
 * Si el cliente fue pre-creado por el admin con TODOS sus datos biométricos y preferencias
 * (goal, experience_level, birth_date, gender, height, initial_weight),
 * marca onboarding como completado sin exigir el flujo.
 * Si falta biometría, no omite el flujo sino que pre-llena los datos en OnboardingFlow.
 */
export async function trySkipOnboardingForPreCreatedClient(
  userId: string,
): Promise<{
  skipped: boolean;
  fitnessGoal?: FitnessGoal;
  experienceLevel?: ExperienceLevel;
  fullName?: string;
}> {
  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select(
      "id, full_name, email, phone, birth_date, gender, height, initial_weight, coach_id, goal, experience_level",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (
    !client ||
    !client.goal ||
    !client.experience_level ||
    !client.birth_date ||
    !client.gender ||
    !client.height ||
    !client.initial_weight
  ) {
    return { skipped: false };
  }

  const fitnessGoal = GOAL_REVERSE[client.goal] ?? "maintain";
  const experienceLevel = (client.experience_level ||
    "beginner") as ExperienceLevel;

  const slug = (client.full_name || "user")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  const username =
    (slug || "user") + "_" + Math.random().toString(36).slice(2, 6);

  const profileUpdate: Record<string, unknown> = {
    full_name: client.full_name || "Usuario",
    username,
    phone: client.phone || null,
    birth_date: client.birth_date,
    gender: client.gender,
    fitness_goal: fitnessGoal,
    experience_level: experienceLevel,
    onboarding_completed: true,
    xp_points: 0,
    level: 1,
    streak_days: 0,
  };

  const { error } = await admin
    .from("profiles")
    .update(profileUpdate)
    .eq("id", userId);

  if (error) {
    console.error("[trySkipOnboarding] Error:", error);
    return { skipped: false };
  }

  const tasks: Promise<unknown>[] = [];

  if (client.email) {
    tasks.push(
      sendWelcomeEmail({
        to: client.email,
        clientName: client.full_name || "Atleta",
      }).catch((err) => console.error("Error enviando email bienvenida:", err)),
    );
  }

  if (client.coach_id) {
    tasks.push(
      notifyUser(client.coach_id, {
        title: "Nuevo registro completado",
        body: `${client.full_name || "Un asesorado"} activó su cuenta y está pendiente de pago.`,
        url: `/admin/clients/${client.id}`,
        tag: `onboarding-${userId}`,
      }),
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }

  return {
    skipped: true,
    fitnessGoal,
    experienceLevel,
    fullName: client.full_name || undefined,
  };
}

