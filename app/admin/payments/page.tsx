import { getAuthData } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Plus,
  CreditCard,
  Hourglass,
  TrendingUp,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { AdminKpiStatCard } from "@/components/admin/admin-kpi-stat-card";
import { createClient } from "@/lib/supabase/server";
import {
  PaymentCardsClient,
  type PaymentCardItem,
} from "./payment-cards-client";
import {
  ADMIN_DATA_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";

type PaymentQueryRow = {
  id: string;
  client_id: string;
  amount: number;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  payment_method: string | null;
  reference: string | null;
  clients:
    | { full_name: string; email?: string | null; avatar_url?: string | null; membership_end?: string | null; status?: string | null }
    | { full_name: string; email?: string | null; avatar_url?: string | null; membership_end?: string | null; status?: string | null }[]
    | null;
  membership_plans:
    | { name: string }
    | { name: string }[]
    | null;
};

function toPaymentCardItem(
  row: PaymentQueryRow,
  isLatestForClient: boolean,
): PaymentCardItem {
  const rel = row.clients;
  const clients =
    rel == null ? null : Array.isArray(rel) ? (rel[0] ?? null) : rel;
  const planRel = row.membership_plans;
  const planObj =
    planRel == null
      ? null
      : Array.isArray(planRel)
        ? (planRel[0] ?? null)
        : planRel;
  return {
    id: row.id,
    client_id: row.client_id,
    amount: row.amount,
    paid_at: row.paid_at,
    period_start: row.period_start,
    period_end: row.period_end,
    payment_method: row.payment_method,
    reference: row.reference,
    plan_name: planObj?.name ?? null,
    is_latest_for_client: isLatestForClient,
    clients,
  };
}

function formatMoney(amount: number) {
  return `$${amount.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getDaysUntilDate(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const datePart = dateStr.slice(0, 10);
  const endDate = new Date(`${datePart}T23:59:59`);
  if (Number.isNaN(endDate.getTime())) return null;
  const diffMs = endDate.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default async function AdminPaymentsPage() {
  const { user, role } = await getAuthData();

  if (!user || role !== "admin") {
    redirect("/auth/login");
  }

  const supabase = await createClient();

  const { data: coachClients } = await supabase
    .from("clients")
    .select("id, full_name, status, membership_start, membership_end, current_plan_id")
    .eq("coach_id", user.id);

  const clientRows = coachClients ?? [];
  const clientIds = clientRows.map((c) => c.id).filter(Boolean);

  // Auto-sincronizar en BD los clientes cuyo membership_end ya venció pero siguen con status='active'
  const staleActiveClientIds = clientRows
    .filter((c) => {
      if (c.status !== "active" || !c.membership_end) return false;
      const daysLeft = getDaysUntilDate(c.membership_end);
      return daysLeft !== null && daysLeft < 0;
    })
    .map((c) => c.id);

  if (staleActiveClientIds.length > 0) {
    await supabase
      .from("clients")
      .update({ status: "expired" })
      .in("id", staleActiveClientIds);

    for (const c of clientRows) {
      if (staleActiveClientIds.includes(c.id)) {
        c.status = "expired";
      }
    }
  }

  let payments: PaymentCardItem[] = [];
  if (clientIds.length > 0) {
    const { data } = await supabase
      .from("payments")
      .select(
        `
        id,
        client_id,
        amount,
        paid_at,
        period_start,
        period_end,
        payment_method,
        reference,
        clients (full_name, email, avatar_url, membership_end, status),
        membership_plans (name)
      `,
      )
      .in("client_id", clientIds)
      .order("created_at", { ascending: false });

    const seenLatestByClient = new Set<string>();
    payments = (data ?? []).map((raw) => {
      const row = raw as unknown as PaymentQueryRow;
      const isLatest = !seenLatestByClient.has(row.client_id);
      if (row.client_id) {
        seenLatestByClient.add(row.client_id);
      }
      return toPaymentCardItem(row, isLatest);
    });
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const currentMonthRevenue = payments.reduce((sum, p) => {
    if (!p.paid_at) return sum;
    const d = new Date(
      p.paid_at.includes("T") ? p.paid_at : `${p.paid_at}T12:00:00`,
    );
    if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
      return sum + (p.amount || 0);
    }
    return sum;
  }, 0);

  const totalRevenue = payments.reduce(
    (sum, p) => (p.paid_at ? sum + (p.amount || 0) : sum),
    0,
  );

  const pendingAmount = payments.reduce(
    (sum, p) => (!p.paid_at ? sum + (p.amount || 0) : sum),
    0,
  );
  const pendingCount = payments.filter((p) => !p.paid_at).length;

  // Evaluar estado efectivo de membresía por cliente usando fecha de corte real
  const clientsWithEffectiveStatus = clientRows.map((c) => {
    const daysLeft = getDaysUntilDate(c.membership_end);
    const isPendingPayment = c.status === "pending_payment";
    const isExpired =
      !isPendingPayment &&
      (c.status === "expired" || (daysLeft !== null && daysLeft < 0));
    const isExpiringSoon =
      !isPendingPayment &&
      !isExpired &&
      daysLeft !== null &&
      daysLeft >= 0 &&
      daysLeft <= 5;
    const isActive = !isExpired && !isPendingPayment && c.status === "active";
    return {
      ...c,
      daysLeft,
      isPendingPayment,
      isExpired,
      isExpiringSoon,
      isActive,
    };
  });

  const activeClientsCount = clientsWithEffectiveStatus.filter(
    (c) => c.isActive,
  ).length;
  const pendingPaymentClients = clientsWithEffectiveStatus.filter(
    (c) => c.isPendingPayment,
  );
  const expiredClients = clientsWithEffectiveStatus.filter((c) => c.isExpired);
  const expiringSoonClients = clientsWithEffectiveStatus.filter(
    (c) => c.isExpiringSoon,
  );
  const expiredClientsCount = expiredClients.length;

  const clientsNeedingAttention = [
    ...pendingPaymentClients,
    ...expiredClients,
    ...expiringSoonClients,
  ];

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        sticky
        title="Pagos y Membresías"
        description={`${payments.length} cobro${payments.length !== 1 ? "s" : ""} registrado${payments.length !== 1 ? "s" : ""} · Control de ingresos y vigencias`}
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/admin/payments/new">
              <Plus className="mr-2 size-4" />
              Nuevo Pago
            </Link>
          </Button>
        }
      />

      <div className={ADMIN_DATA_PAGE_SHELL}>
        <div className="grid gap-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <AdminKpiStatCard
              icon={TrendingUp}
              value={formatMoney(currentMonthRevenue)}
              label="Ingresos del Mes"
              description="Cobrado este mes"
              tone="success"
            />
            <AdminKpiStatCard
              icon={CreditCard}
              value={formatMoney(totalRevenue)}
              label="Ingresos Históricos"
              description={`${payments.length - pendingCount} pagos liquidados`}
              tone="primary"
            />
            <AdminKpiStatCard
              icon={Hourglass}
              value={formatMoney(pendingAmount)}
              label="Por Cobrar"
              description={
                pendingCount > 0
                  ? `${pendingCount} cobro${pendingCount === 1 ? "" : "s"} pendiente${pendingCount === 1 ? "" : "s"}`
                  : pendingPaymentClients.length > 0
                    ? `${pendingPaymentClients.length} nuevo${pendingPaymentClients.length === 1 ? "" : "s"} por confirmar 1er pago`
                    : "Sin adeudos"
              }
              tone="warning"
            />
            <AdminKpiStatCard
              icon={UserCheck}
              value={`${activeClientsCount}/${clientRows.length}`}
              label="Membresías Vigentes"
              description={
                pendingPaymentClients.length > 0
                  ? `${pendingPaymentClients.length} por activar (1er pago)`
                  : expiredClientsCount > 0
                    ? `${expiredClientsCount} vencida${expiredClientsCount === 1 ? "" : "s"} por renovar`
                    : expiringSoonClients.length > 0
                      ? `${expiringSoonClients.length} por vencer pronto`
                      : "Todas al corriente"
              }
              tone={
                expiredClientsCount > 0
                  ? "destructive"
                  : pendingPaymentClients.length > 0
                    ? "warning"
                    : "neutral"
              }
            />
          </div>

          {/* Alerta Operativa de Activaciones, Membresías Vencidas o Próximas a Vencer */}
          {clientsNeedingAttention.length > 0 && (
            <Card className="overflow-hidden rounded-2xl border-destructive/30 bg-destructive/5 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/15 text-destructive shrink-0">
                        <AlertTriangle className="size-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-foreground">
                          Activaciones y Renovaciones Requeridas ({clientsNeedingAttention.length})
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          Asesorados esperando confirmación de su primer pago o cuya vigencia ya venció / está por vencer.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {clientsNeedingAttention.map((client) => {
                      const days = client.daysLeft ?? 0;
                      return (
                        <div
                          key={client.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/80 px-3.5 py-2.5 shadow-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground truncate">
                              {client.full_name}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              {client.isPendingPayment ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0"
                                >
                                  Nuevo · Falta 1er pago
                                </Badge>
                              ) : client.isExpired ? (
                                <Badge
                                  variant="outline"
                                  className="border-destructive/35 bg-destructive/10 text-destructive text-[10px] font-bold px-1.5 py-0"
                                >
                                  Vencida
                                  {days < 0 ? ` hace ${Math.abs(days)}d` : ""}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-warning/40 bg-warning/15 text-warning-foreground text-[10px] font-bold px-1.5 py-0"
                                >
                                  <Clock className="mr-1 size-2.5" />
                                  Vence en {days}d
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            asChild
                            size="sm"
                            className="h-8 rounded-lg px-2.5 text-xs font-bold shrink-0"
                          >
                            <Link href={`/admin/payments/new?clientId=${client.id}`}>
                              <RefreshCw className="mr-1.5 size-3" />
                              {client.isPendingPayment ? "Activar / Pagar" : "Renovar"}
                            </Link>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payments List */}
          <div className="flex flex-col gap-4">
            {payments.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <p className="text-muted-foreground text-center">
                    No hay pagos registrados aún.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <PaymentCardsClient payments={payments} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
