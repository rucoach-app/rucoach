import { getAuthData } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  ClientManagementContent,
  type ClientManagementCard,
} from "./client-management-content";
import {
  ADMIN_DATA_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";
import {
  fetchLatestCompletedSessionByClients,
  fetchLatestPaidPaymentByClients,
} from "@/lib/admin-client-rollups";
import {
  diffWholeDaysFromNow,
  isoTimestampsDifferMoreThanDays,
} from "@/lib/calendar-date";

export default async function AdminClientsPage() {
  const { user, role } = await getAuthData();

  if (!user || role !== "admin") redirect("/auth/login");

  const supabase = await createClient();

  // 1. Fetch clients with basic info
  const { data: clientsData, error: clientsError } = await supabase
    .from("clients")
    .select(
      `
      id, 
      user_id, 
      full_name, 
      avatar_url, 
      status, 
      email, 
      phone, 
      goal, 
      experience_level, 
      membership_end, 
      last_session_at, 
      created_at,
      current_plan_id
    `,
    )
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false });

  if (clientsError) throw clientsError;
  const clientsList = clientsData || [];

  const now = new Date();
  const staleExpiredIds: string[] = [];
  for (const c of clientsList) {
    if (c.status === "active" && c.membership_end) {
      const endDay = c.membership_end.slice(0, 10);
      if (new Date(`${endDay}T23:59:59`) < now) {
        staleExpiredIds.push(c.id);
        c.status = "expired";
      }
    }
  }
  if (staleExpiredIds.length > 0) {
    await supabase
      .from("clients")
      .update({ status: "expired" })
      .in("id", staleExpiredIds);
  }

  const clientIds = clientsList.map((c) => c.id);
  const planIds = [
    ...new Set(clientsList.map((c) => c.current_plan_id).filter(Boolean)),
  ] as string[];

  const [latestCompletedByClient, latestPaidByClient, plansRes] =
    await Promise.all([
      fetchLatestCompletedSessionByClients(supabase, clientIds),
      fetchLatestPaidPaymentByClients(supabase, clientIds),
      planIds.length > 0
        ? supabase.from("membership_plans").select("id, name").in("id", planIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

  // 2. Map plans to resolve names
  const plansById = new Map<string, string>();
  for (const p of plansRes.data || []) plansById.set(p.id, p.name);

  // 3. Map to Management Cards (fuente de verdad: sesiones completadas + último pago)
  const clients: ClientManagementCard[] = clientsList.map((c) => {
    const fromSessions = latestCompletedByClient.get(c.id);
    const lastSessionAt = fromSessions ?? c.last_session_at ?? null;
    const latestPay = latestPaidByClient.get(c.id);
    const latestPaidPeriodEnd = latestPay?.period_end ?? null;
    const membershipVsLastPaymentMismatch =
      Boolean(latestPaidPeriodEnd) &&
      isoTimestampsDifferMoreThanDays(c.membership_end, latestPaidPeriodEnd, 1);

    return {
      id: c.id,
      userId: c.user_id,
      fullName: c.full_name,
      email: c.email,
      phone: c.phone,
      avatarUrl: c.avatar_url,
      status: c.status,
      membershipEnd: c.membership_end,
      goal: c.goal,
      experienceLevel: c.experience_level,
      lastSessionAt,
      daysSinceLastSession: diffWholeDaysFromNow(lastSessionAt),
      latestPaidPeriodEnd,
      membershipVsLastPaymentMismatch,
      planName: c.current_plan_id
        ? (plansById.get(c.current_plan_id) ?? null)
        : null,
      createdAt: c.created_at,
    };
  });

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        sticky
        title="Gestión de Asesorados"
        description={`${clients.length} asesorado${clients.length !== 1 ? "s" : ""} en total`}
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/admin/clients/new">
              <Plus className="mr-2 size-4" />
              Nuevo asesorado
            </Link>
          </Button>
        }
      />

      <div className={ADMIN_DATA_PAGE_SHELL}>
        <ClientManagementContent clients={clients} />
      </div>
    </div>
  );
}
