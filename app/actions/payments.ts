"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getUserProfile } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function syncClientPlanDatesFromPayment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  fields: {
    period_start?: string | null;
    period_end?: string | null;
    plan_id?: string | null;
  },
) {
  const clientUpdate: Record<string, unknown> = {};
  if (fields.period_start) clientUpdate.membership_start = fields.period_start;
  if (fields.period_end) {
    clientUpdate.membership_end = fields.period_end;
    const endIso = fields.period_end.includes("T")
      ? fields.period_end
      : `${fields.period_end}T23:59:59`;
    const isExpired = new Date(endIso) < new Date();
    clientUpdate.status = isExpired ? "expired" : "active";
    if (!isExpired) clientUpdate.admin_approved = true;
  } else {
    clientUpdate.status = "active";
    clientUpdate.admin_approved = true;
  }
  if (fields.plan_id) clientUpdate.current_plan_id = fields.plan_id;
  
  if (Object.keys(clientUpdate).length === 0) return;
  const { data: updatedClient } = await supabase
    .from("clients")
    .update(clientUpdate)
    .eq("id", clientId)
    .select("user_id, status")
    .maybeSingle();

  if (updatedClient?.user_id && updatedClient.status) {
    await supabase
      .from("profiles")
      .update({ subscription_status: updatedClient.status })
      .eq("id", updatedClient.user_id);
  }

  revalidatePath("/suspended");
  revalidatePath("/client/dashboard");
  revalidatePath("/client", "layout");
}

import { notifyUser } from "@/lib/push";

async function notifyPayment(
  clientId: string,
  amount: number,
  planId?: string | null,
  periodEnd?: string | null,
) {
  try {
    const supabase = await createClient();
    const { data: client } = await supabase
      .from("clients")
      .select("user_id, full_name, email")
      .eq("id", clientId)
      .single();
    if (!client) return;

    let planName = "Plan Personalizado";
    if (planId) {
      const { data: plan } = await supabase
        .from("membership_plans")
        .select("name")
        .eq("id", planId)
        .single();
      if (plan) planName = plan.name;
    }

    const { sendPaymentConfirmation } = await import("@/lib/email");
    const formattedAmount = new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
    const formattedDate = periodEnd
      ? new Date(
          periodEnd.includes("T") ? periodEnd : `${periodEnd}T12:00:00`,
        ).toLocaleDateString("es-MX", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "N/A";

    if (client.email) {
      await sendPaymentConfirmation({
        to: client.email,
        clientName: client.full_name,
        amount: formattedAmount,
        planName,
        expiryDate: formattedDate,
      });
    }

    if (client.user_id) {
      await notifyUser(client.user_id, {
        title: "¡Pago Registrado!",
        body: `Hemos confirmado tu pago de ${formattedAmount}. Tu cuenta está activa.`,
        url: "/client/dashboard",
        tag: "payment-confirmed",
      });
    }
  } catch (err) {
    console.error("Error enviando notificación de pago:", err);
  }
}

export async function registerPayment(formData: FormData) {
  const user = await getAuthUser();
  const profile = await getUserProfile();

  if (!user || profile?.role !== "admin") {
    throw new Error("No autorizado");
  }

  const supabase = await createClient();

  const clientId = formData.get("clientId") as string;
  const amount = formData.get("amount") as string;
  const paymentMethod = formData.get("paymentMethod") as string;
  const planId = formData.get("planId") as string;
  const periodStart = formData.get("periodStart") as string;
  const periodEnd = formData.get("periodEnd") as string;
  const reference = formData.get("reference") as string;
  const paymentStatus = (formData.get("paymentStatus") as string) || "paid";
  const paidAtInput = formData.get("paidAt") as string | null;

  const isPaid = paymentStatus !== "pending";
  const resolvedPaidAt = isPaid
    ? paidAtInput
      ? new Date(
          paidAtInput.includes("T") ? paidAtInput : `${paidAtInput}T12:00:00`,
        ).toISOString()
      : new Date().toISOString()
    : null;

  const { error } = await supabase.from("payments").insert([
    {
      id: crypto.randomUUID(),
      client_id: clientId,
      amount: parseFloat(amount),
      payment_method: paymentMethod || null,
      plan_id: planId || null,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      reference: reference || null,
      paid_at: resolvedPaidAt,
    },
  ]);

  if (error) {
    console.error("Error creating payment:", error);
    throw new Error(error.message);
  }

  if (isPaid) {
    await syncClientPlanDatesFromPayment(supabase, clientId, {
      period_start: periodStart || null,
      period_end: periodEnd || null,
      plan_id: planId || null,
    });

    // Notificar al cliente antes del redirect para que Serverless no cancele el envío
    await notifyPayment(clientId, parseFloat(amount), planId, periodEnd).catch(
      console.error,
    );
  } else if (planId) {
    await supabase
      .from("clients")
      .update({ current_plan_id: planId })
      .eq("id", clientId);
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/dashboard");
  redirect("/admin/payments");
}

export async function markPaymentAsPaid(paymentId: string) {
  const user = await getAuthUser();
  const profile = await getUserProfile();

  if (!user || profile?.role !== "admin") {
    throw new Error("No autorizado");
  }

  const supabase = await createClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("payments")
    .select("client_id, period_start, period_end, plan_id, amount")
    .eq("id", paymentId)
    .maybeSingle();

  if (fetchErr || !existing?.client_id) {
    if (fetchErr) console.error("markPaymentAsPaid fetch", fetchErr);
    throw new Error(fetchErr?.message || "Pago no encontrado");
  }

  const { error } = await supabase
    .from("payments")
    .update({
      paid_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  if (error) {
    console.error("Error marking payment as paid:", error);
    throw new Error(error.message);
  }

  await syncClientPlanDatesFromPayment(supabase, existing.client_id, {
    period_start: existing.period_start,
    period_end: existing.period_end,
    plan_id: existing.plan_id,
  });

  if (existing.amount != null) {
    await notifyPayment(
      existing.client_id,
      existing.amount,
      existing.plan_id,
      existing.period_end,
    ).catch(console.error);
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${existing.client_id}`);
  revalidatePath("/admin/dashboard");

  return { success: true };
}

export async function updatePayment(
  paymentId: string,
  data: {
    amount?: number;
    paid_at?: string | null;
    payment_method?: string;
    period_start?: string;
    period_end?: string;
    reference?: string;
    plan_id?: string | null;
  },
) {
  const user = await getAuthUser();
  const profile = await getUserProfile();

  if (!user || profile?.role !== "admin") {
    return { success: false, error: "No autorizado" };
  }

  const supabase = await createClient();

  const updatePayload: Record<string, unknown> = {};
  if (data.amount != null) updatePayload.amount = data.amount;
  if (data.paid_at !== undefined) updatePayload.paid_at = data.paid_at;
  if (data.payment_method != null)
    updatePayload.payment_method = data.payment_method;
  if (data.period_start != null) updatePayload.period_start = data.period_start;
  if (data.period_end != null) updatePayload.period_end = data.period_end;
  if (data.reference != null) updatePayload.reference = data.reference;
  if (data.plan_id !== undefined) updatePayload.plan_id = data.plan_id;

  if (Object.keys(updatePayload).length === 0) {
    return { success: true };
  }

  const { data: before, error: fetchErr } = await supabase
    .from("payments")
    .select("client_id, paid_at, period_start, period_end, plan_id")
    .eq("id", paymentId)
    .maybeSingle();

  if (fetchErr || !before?.client_id) {
    return { success: false, error: fetchErr?.message || "Pago no encontrado" };
  }

  const { error } = await supabase
    .from("payments")
    .update(updatePayload)
    .eq("id", paymentId);

  if (error) {
    console.error("Error updating payment:", error);
    return { success: false, error: error.message };
  }

  const paidAt =
    data.paid_at !== undefined ? data.paid_at : before.paid_at;
  if (paidAt) {
    const periodStart =
      (updatePayload.period_start as string | undefined) ?? before.period_start;
    const periodEnd =
      (updatePayload.period_end as string | undefined) ?? before.period_end;
    const planId =
      data.plan_id !== undefined ? data.plan_id : before.plan_id;
    await syncClientPlanDatesFromPayment(supabase, before.client_id, {
      period_start: periodStart,
      period_end: periodEnd,
      plan_id: planId,
    });
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${before.client_id}`);
  revalidatePath("/admin/dashboard");
  return { success: true };
}

export async function deletePayment(paymentId: string) {
  const user = await getAuthUser();
  const profile = await getUserProfile();

  if (!user || profile?.role !== "admin") {
    return { success: false, error: "No autorizado" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId);

  if (error) {
    console.error("Error deleting payment:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/dashboard");
  return { success: true };
}
