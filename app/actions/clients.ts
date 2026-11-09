"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getUserProfile } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { sendClientInvitationEmail } from "@/lib/email";

function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createNewClient(formData: FormData) {
  const user = await getAuthUser();
  const profile = await getUserProfile();

  if (!user || profile?.role !== "admin") {
    throw new Error("No autorizado");
  }

  const supabase = await createClient();

  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const notes = formData.get("notes") as string;

  // Check if email already exists in profiles (includes admins)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (existingProfile) {
    throw new Error("Este correo ya está registrado en el sistema. Los asesores deben usar correos únicos.");
  }

  const clientId = crypto.randomUUID();

  const { error } = await supabase
    .from("clients")
    .insert([
      {
        id: clientId,
        coach_id: user.id,
        email,
        full_name: fullName,
        phone: phone || "",
        status: "pending",
        notes: notes || null,
      },
    ])
    .select();

  if (error) {
    console.error("Error creating client:", error);
    throw new Error(error.message);
  }

  const code = generateAccessCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await supabase.from("invitation_codes").insert({
    code,
    created_by: user.id,
    email: email || null,
    client_id: clientId,
    for_role: "client",
    expires_at: expiresAt.toISOString(),
    max_uses: 1,
    times_used: 0,
    is_active: true,
  });

  let emailSent = false;
  if (email?.trim()) {
    const result = await sendClientInvitationEmail({
      to: email.trim(),
      clientName: fullName,
      code,
    });
    emailSent = result.success;
    if (!result.success) {
      console.warn("No se pudo enviar el correo de invitación:", result.error);
    }
  }

  const params = new URLSearchParams({ accessCode: code });
  if (email?.trim()) params.set("emailSent", emailSent ? "1" : "0");
  redirect(`/admin/clients/${clientId}?${params.toString()}`);
}

export async function updateClient(clientId: string, formData: FormData) {
  const user = await getAuthUser();
  const profile = await getUserProfile();

  if (!user || profile?.role !== "admin") {
    throw new Error("No autorizado");
  }

  const supabase = await createClient();

  const fullName = formData.get("fullName") as string;
  const phone = formData.get("phone") as string;
  const birthDate = formData.get("birthDate") as string;
  const gender = formData.get("gender") as string;
  const status = formData.get("status") as string;
  const goalRaw = formData.get("goal") as string;
  const GOAL_MAP: Record<string, string> = {
    muscle_gain: "muscle_gain",
    fat_loss: "weight_loss",
    weight_loss: "weight_loss",
    strength: "toning",
    toning: "toning",
    endurance: "endurance",
    general_fitness: "maintenance",
    maintenance: "maintenance",
  };
  const goal = goalRaw && GOAL_MAP[goalRaw] ? GOAL_MAP[goalRaw] : null;

  const experienceLevelRaw = formData.get("experienceLevel") as string;
  const validExperienceLevels = ["beginner", "intermediate", "advanced"];
  const experienceLevel = validExperienceLevels.includes(experienceLevelRaw)
    ? experienceLevelRaw
    : null;

  const notes = formData.get("notes") as string;
  const currentWeight = formData.get("currentWeight") as string;
  const height = formData.get("height") as string;

  const { error } = await supabase
    .from("clients")
    .update({
      full_name: fullName,
      phone: phone || null,
      birth_date: birthDate || null,
      gender: gender || null,
      status,
      goal: goal || null,
      experience_level: experienceLevel || null,
      notes: notes || null,
      current_weight: currentWeight ? parseFloat(currentWeight) : null,
      height: height ? parseFloat(height) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .eq("coach_id", user.id);

  if (error) {
    console.error("Error updating client:", error);
    throw new Error(error.message);
  }

  // Nota: La sincronización con la tabla 'profiles' se maneja automáticamente
  // mediante un trigger de base de datos (tr_sync_client_status_to_profile).

  redirect(`/admin/clients/${clientId}`);
}

import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteClient(clientId: string) {
  const user = await getAuthUser();
  const profile = await getUserProfile();

  if (!user || profile?.role !== "admin") {
    return { success: false, error: "No autorizado" };
  }

  const supabase = await createClient();

  // First fetch the client to check if they have an associated user_id
  const { data: clientToDelete, error: fetchError } = await supabase
    .from("clients")
    .select("user_id")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .single();

  if (fetchError || !clientToDelete) {
    return { success: false, error: fetchError?.message || "Cliente no encontrado" };
  }

  // If the client has registered and has a user_id, wiping their auth account cleans up everything thanks to ON DELETE CASCADE
  if (clientToDelete.user_id) {
    const adminAuth = createAdminClient();
    const { error: deleteAuthError } = await adminAuth.auth.admin.deleteUser(
      clientToDelete.user_id
    );
    if (deleteAuthError) {
      return { success: false, error: deleteAuthError.message };
    }
  } else {
    // If the client never registered, just delete the client row
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId)
      .eq("coach_id", user.id);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

export async function updateClientStatus(clientId: string, status: string) {
  const user = await getAuthUser();
  const profile = await getUserProfile();

  if (!user || profile?.role !== "admin") {
    return { success: false, error: "No autorizado" };
  }

  const supabase = await createClient();

  const updatePayload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "active") {
    updatePayload.admin_approved = true;
  }

  const { error } = await supabase
    .from("clients")
    .update(updatePayload)
    .eq("id", clientId)
    .eq("coach_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/clients");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/payments");
  revalidatePath("/suspended");
  revalidatePath("/client/dashboard");

  return { success: true };
}
