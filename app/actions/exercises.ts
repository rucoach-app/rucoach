"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, isAdmin } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

function emptyToNull(s: string | null | undefined) {
  const t = s?.trim();
  return t ? t : null;
}

const MUSCLE_TO_BODY_PART_ES: Record<string, string[]> = {
  chest: ["pecho"],
  pecho: ["pecho"],
  back: ["espalda"],
  espalda: ["espalda"],
  shoulders: ["hombros"],
  hombros: ["hombros"],
  biceps: ["brazos"],
  bíceps: ["brazos"],
  triceps: ["brazos"],
  tríceps: ["brazos"],
  forearms: ["brazos"],
  antebrazos: ["brazos"],
  quadriceps: ["piernas"],
  cuádriceps: ["piernas"],
  hamstrings: ["piernas"],
  isquiotibiales: ["piernas"],
  glutes: ["piernas"],
  glúteos: ["piernas"],
  adductors: ["piernas"],
  aductores: ["piernas"],
  calves: ["pantorrillas"],
  pantorrillas: ["pantorrillas"],
  abs: ["abdomen"],
  abdomen: ["abdomen"],
  obliques: ["abdomen"],
  oblicuos: ["abdomen"],
  lower_back: ["espalda"],
  "espalda baja": ["espalda"],
  lumbar: ["espalda"],
  trapezius: ["espalda"],
  trapecios: ["espalda"],
  hip_flexors: ["piernas"],
  "flexores de cadera": ["piernas"],
  cardio: ["cardio"],
  full_body: ["cuerpo completo"],
};

const MUSCLE_TO_ES: Record<string, string> = {
  chest: "pecho",
  pecho: "pecho",
  back: "espalda",
  espalda: "espalda",
  shoulders: "hombros",
  hombros: "hombros",
  biceps: "bíceps",
  bíceps: "bíceps",
  triceps: "tríceps",
  tríceps: "tríceps",
  forearms: "antebrazos",
  antebrazos: "antebrazos",
  quadriceps: "cuádriceps",
  cuádriceps: "cuádriceps",
  quads: "cuádriceps",
  hamstrings: "isquiotibiales",
  isquiotibiales: "isquiotibiales",
  glutes: "glúteos",
  glúteos: "glúteos",
  adductors: "aductores",
  aductores: "aductores",
  calves: "pantorrillas",
  pantorrillas: "pantorrillas",
  gemelos: "pantorrillas",
  abs: "abdomen",
  abdomen: "abdomen",
  obliques: "oblicuos",
  oblicuos: "oblicuos",
  lower_back: "espalda baja",
  "espalda baja": "espalda baja",
  lumbar: "espalda baja",
  trapezius: "trapecios",
  trapecios: "trapecios",
  hip_flexors: "flexores de cadera",
  "flexores de cadera": "flexores de cadera",
  cardio: "cardio",
  full_body: "cuerpo completo",
};

const VALID_DB_MUSCLES = new Set([
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "abs",
  "glutes",
  "quadriceps",
  "hamstrings",
  "calves",
  "forearms",
  "full_body",
  "cardio",
]);

const MAP_TO_DB_PRIMARY: Record<string, string> = {
  chest: "chest",
  back: "back",
  shoulders: "shoulders",
  biceps: "biceps",
  triceps: "triceps",
  abs: "abs",
  glutes: "glutes",
  quadriceps: "quadriceps",
  hamstrings: "hamstrings",
  calves: "calves",
  forearms: "forearms",
  full_body: "full_body",
  cardio: "cardio",
  adductors: "quadriceps",
  trapezius: "back",
  lower_back: "back",
  obliques: "abs",
  hip_flexors: "quadriceps",
};

const SPANISH_OR_ALIAS_TO_SLUG: Record<string, string> = {
  pecho: "chest",
  pectorales: "chest",
  espalda: "back",
  dorsales: "back",
  hombros: "shoulders",
  deltoides: "shoulders",
  bíceps: "biceps",
  biceps: "biceps",
  tríceps: "triceps",
  triceps: "triceps",
  abdomen: "abs",
  core: "abs",
  glúteos: "glutes",
  gluteos: "glutes",
  gluteo: "glutes",
  cuádriceps: "quadriceps",
  cuadriceps: "quadriceps",
  isquiotibiales: "hamstrings",
  femorales: "hamstrings",
  isquios: "hamstrings",
  pantorrillas: "calves",
  gemelos: "calves",
  antebrazos: "forearms",
  antebrazo: "forearms",
  cuerpo_completo: "full_body",
  "cuerpo completo": "full_body",
  cardio: "cardio",
};

function toValidSecondarySlug(muscleList: string[]): string | null {
  for (const m of muscleList) {
    const raw = m.trim().toLowerCase();
    if (VALID_DB_MUSCLES.has(raw)) return raw;
    if (SPANISH_OR_ALIAS_TO_SLUG[raw]) return SPANISH_OR_ALIAS_TO_SLUG[raw];
  }
  return null;
}

const EQUIPMENT_TO_ES: Record<string, string> = {
  barbell: "barra",
  dumbbell: "mancuerna",
  machine: "máquina",
  cable: "polea",
  bodyweight: "peso corporal",
  kettlebell: "pesa rusa",
  bands: "bandas",
  other: "otro",
};

function translateMuscle(m: string): string {
  const key = m.trim().toLowerCase();
  return MUSCLE_TO_ES[key] ?? m.trim();
}

function translateEquipment(eq: string | null): string | null {
  if (!eq) return null;
  const key = eq.trim().toLowerCase();
  return EQUIPMENT_TO_ES[key] ?? eq.trim();
}

function parseInstructionsList(
  rawJson: string | null | undefined,
  fallbackText?: string | null,
): string[] {
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) =>
            typeof item === "string"
              ? item.replace(/^\s*(?:\d+[.)]\s*|[-•*]\s*)/, "").trim()
              : "",
          )
          .filter(Boolean);
      }
    } catch {
      // Fallback if invalid JSON
    }
  }
  if (fallbackText) {
    return fallbackText
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:\d+[.)]\s*|[-•*]\s*)/, "").trim())
      .filter(Boolean);
  }
  return [];
}

export async function createAdminExercise(
  formData: FormData,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return {
        success: false,
        error: "Debes iniciar sesión para realizar esta acción.",
      };
    }

    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) {
      return {
        success: false,
        error: "No tienes permisos de administrador para crear ejercicios.",
      };
    }

    const name = emptyToNull(formData.get("name") as string);
    if (!name) {
      return {
        success: false,
        error: "El nombre del ejercicio es obligatorio.",
      };
    }

    const rawPrimaryMuscle =
      emptyToNull(formData.get("primaryMuscle") as string) ?? "full_body";
    const dbPrimaryMuscle =
      MAP_TO_DB_PRIMARY[rawPrimaryMuscle.toLowerCase()] ??
      (VALID_DB_MUSCLES.has(rawPrimaryMuscle.toLowerCase())
        ? rawPrimaryMuscle.toLowerCase()
        : "full_body");

    const secondaryMuscleRaw = emptyToNull(
      formData.get("secondaryMuscle") as string,
    );
    const secondaryMusclesEs = secondaryMuscleRaw
      ? secondaryMuscleRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const secondaryMusclesSlugs = secondaryMusclesEs
      .map((m) => {
        const raw = m.toLowerCase();
        return VALID_DB_MUSCLES.has(raw)
          ? raw
          : (SPANISH_OR_ALIAS_TO_SLUG[raw] ?? null);
      })
      .filter((s): s is string => Boolean(s));

    const dbSecondaryMuscle = toValidSecondarySlug(secondaryMusclesEs);

    const exerciseType =
      emptyToNull(formData.get("exerciseType") as string) ?? "strength";
    const equipment = emptyToNull(formData.get("equipment") as string);
    const techniqueNotes = emptyToNull(
      formData.get("techniqueNotes") as string,
    );
    const instructionsEsJson = formData.get("instructionsEs") as string | null;
    const usesExternalLoadRaw = formData.get("usesExternalLoad");
    const usesExternalLoad =
      usesExternalLoadRaw === null
        ? exerciseType === "strength"
        : usesExternalLoadRaw === "true";

    const bodyPartsEs = MUSCLE_TO_BODY_PART_ES[rawPrimaryMuscle] ?? [
      translateMuscle(rawPrimaryMuscle),
    ];
    const targetMusclesEs = [translateMuscle(rawPrimaryMuscle)];
    const equipmentEs = translateEquipment(equipment);
    const instructionsEs = parseInstructionsList(instructionsEsJson);

    // Usar admin client para evitar fallas por RLS o caducidad de cookies en Server Actions
    const adminClient = createAdminClient();

    const row: Record<string, unknown> = {
      id: crypto.randomUUID(),
      name,
      name_es: name,
      primary_muscle: dbPrimaryMuscle,
      secondary_muscle: dbSecondaryMuscle,
      secondary_muscles: secondaryMusclesSlugs,
      secondary_muscles_es: secondaryMusclesEs,
      exercise_type: exerciseType,
      uses_external_load: usesExternalLoad,
      equipment,
      equipment_es: equipmentEs,
      equipments: equipmentEs ? [equipmentEs] : [],
      body_parts_es: bodyPartsEs,
      target_muscles_es: targetMusclesEs,
      instructions_es: instructionsEs,
      technique_notes: techniqueNotes,
      gif_url: emptyToNull(formData.get("gifUrl") as string),
      image_url: emptyToNull(formData.get("imageUrl") as string),
      demo_video_url: emptyToNull(formData.get("demoVideoUrl") as string),
    };

    const { data, error } = await adminClient
      .from("exercises")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("createAdminExercise error:", error);
      return { success: false, error: error.message };
    }

    try {
      revalidatePath("/admin/exercises");
      revalidatePath("/admin/exercises/new");
      revalidatePath("/admin/routines");
      revalidatePath("/admin/routines/builder");
    } catch (revErr) {
      console.warn("revalidatePath warning in createAdminExercise:", revErr);
    }

    return { success: true, id: data.id as string };
  } catch (err) {
    console.error("Unexpected error in createAdminExercise:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al crear el ejercicio.",
    };
  }
}

export async function updateAdminExercise(
  exerciseId: string,
  formData: FormData,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return {
        success: false,
        error: "Debes iniciar sesión para realizar esta acción.",
      };
    }

    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) {
      return {
        success: false,
        error: "No tienes permisos de administrador para editar ejercicios.",
      };
    }

    if (!exerciseId) {
      return { success: false, error: "ID de ejercicio inválido." };
    }

    const name = emptyToNull(formData.get("name") as string);
    if (!name) {
      return {
        success: false,
        error: "El nombre del ejercicio es obligatorio.",
      };
    }

    const rawPrimaryMuscle =
      emptyToNull(formData.get("primaryMuscle") as string) ?? "full_body";
    const dbPrimaryMuscle =
      MAP_TO_DB_PRIMARY[rawPrimaryMuscle.toLowerCase()] ??
      (VALID_DB_MUSCLES.has(rawPrimaryMuscle.toLowerCase())
        ? rawPrimaryMuscle.toLowerCase()
        : "full_body");

    const secondaryMuscleRaw = emptyToNull(
      formData.get("secondaryMuscle") as string,
    );
    const secondaryMusclesEs = secondaryMuscleRaw
      ? secondaryMuscleRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const secondaryMusclesSlugs = secondaryMusclesEs
      .map((m) => {
        const raw = m.toLowerCase();
        return VALID_DB_MUSCLES.has(raw)
          ? raw
          : (SPANISH_OR_ALIAS_TO_SLUG[raw] ?? null);
      })
      .filter((s): s is string => Boolean(s));

    const dbSecondaryMuscle = toValidSecondarySlug(secondaryMusclesEs);

    const exerciseType =
      emptyToNull(formData.get("exerciseType") as string) ?? "strength";
    const equipment = emptyToNull(formData.get("equipment") as string);
    const techniqueNotes = emptyToNull(
      formData.get("techniqueNotes") as string,
    );
    const instructionsEsJson = formData.get("instructionsEs") as string | null;
    const usesExternalLoadRaw = formData.get("usesExternalLoad");

    const adminClient = createAdminClient();

    const { data: existing, error: fetchError } = await adminClient
      .from("exercises")
      .select(
        "id, name, name_es, primary_muscle, body_parts_es, target_muscles_es, uses_external_load",
      )
      .eq("id", exerciseId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "No se encontró el ejercicio a editar." };
    }

    const usesExternalLoad =
      usesExternalLoadRaw === null
        ? (existing.uses_external_load ?? exerciseType === "strength")
        : usesExternalLoadRaw === "true";

    const primaryChanged = existing.primary_muscle !== dbPrimaryMuscle;
    const bodyPartsEs =
      primaryChanged || !existing.body_parts_es?.length
        ? (MUSCLE_TO_BODY_PART_ES[rawPrimaryMuscle] ?? [
            translateMuscle(rawPrimaryMuscle),
          ])
        : existing.body_parts_es;

    const targetMusclesEs =
      primaryChanged || !existing.target_muscles_es?.length
        ? [translateMuscle(rawPrimaryMuscle)]
        : existing.target_muscles_es;

    const equipmentEs = translateEquipment(equipment);
    const instructionsEs = parseInstructionsList(instructionsEsJson);

    // Si el ejercicio original tenía name === name_es (creado por el admin), mantenemos ambos sincronizados
    const shouldSyncEnglishName =
      !existing.name || existing.name === existing.name_es;

    const updates: Record<string, unknown> = {
      name_es: name,
      ...(shouldSyncEnglishName ? { name } : {}),
      primary_muscle: dbPrimaryMuscle,
      secondary_muscle: dbSecondaryMuscle,
      secondary_muscles: secondaryMusclesSlugs,
      secondary_muscles_es: secondaryMusclesEs,
      exercise_type: exerciseType,
      uses_external_load: usesExternalLoad,
      equipment,
      equipment_es: equipmentEs,
      equipments: equipmentEs ? [equipmentEs] : [],
      body_parts_es: bodyPartsEs,
      target_muscles_es: targetMusclesEs,
      instructions_es: instructionsEs,
      technique_notes: techniqueNotes,
      gif_url: emptyToNull(formData.get("gifUrl") as string),
      image_url: emptyToNull(formData.get("imageUrl") as string),
      demo_video_url: emptyToNull(formData.get("demoVideoUrl") as string),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await adminClient
      .from("exercises")
      .update(updates)
      .eq("id", exerciseId);

    if (updateError) {
      console.error("updateAdminExercise error:", updateError);
      return { success: false, error: updateError.message };
    }

    try {
      revalidatePath("/admin/exercises");
      revalidatePath(`/admin/exercises/${exerciseId}/edit`);
      revalidatePath("/admin/routines");
      revalidatePath("/admin/routines/builder");
    } catch (revErr) {
      console.warn("revalidatePath warning in updateAdminExercise:", revErr);
    }

    return { success: true, id: exerciseId };
  } catch (err) {
    console.error("Unexpected error in updateAdminExercise:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al actualizar el ejercicio.",
    };
  }
}

export async function deleteAdminExercise(
  exerciseId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return {
        success: false,
        error: "Debes iniciar sesión para realizar esta acción.",
      };
    }

    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) {
      return {
        success: false,
        error: "No tienes permisos de administrador para eliminar ejercicios.",
      };
    }

    if (!exerciseId) {
      return { success: false, error: "ID de ejercicio inválido." };
    }

    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("exercises")
      .delete()
      .eq("id", exerciseId);

    if (error) {
      console.error("deleteAdminExercise", error);
      if (error.code === "23503") {
        return {
          success: false,
          error:
            "Este ejercicio no se puede eliminar porque está siendo usado en una rutina o historial de entrenamiento.",
        };
      }
      return {
        success: false,
        error: error.message || "No se pudo eliminar el ejercicio.",
      };
    }

    try {
      revalidatePath("/admin/exercises");
      revalidatePath("/admin/routines");
      revalidatePath("/admin/routines/builder");
    } catch (revErr) {
      console.warn("revalidatePath warning in deleteAdminExercise:", revErr);
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al eliminar el ejercicio.",
    };
  }
}

export async function getExercisesForSelector() {
  const supabase = await createClient();

  // Fetch all exercises (handling 1000 row limit)
  let allExercises: any[] = [];
  let from = 0;
  let to = 999;

  while (true) {
    const { data, error } = await supabase
      .from("exercises")
      .select(
        "id, name, name_es, gif_url, body_parts, body_parts_es, target_muscles, target_muscles_es, equipments, primary_muscle, secondary_muscle, secondary_muscles, secondary_muscles_es, exercise_type, equipment, equipment_es, instructions_es, technique_notes",
      )
      .order("name")
      .range(from, to);

    if (error || !data || data.length === 0) break;
    allExercises = [...allExercises, ...data];
    if (data.length < 1000) break;
    from += 1000;
    to += 1000;
  }

  return allExercises;
}




