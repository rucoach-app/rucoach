"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toZonedWallClockDate } from "@/lib/calendar-date";
import {
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { AdminKpiStatCard } from "@/components/admin/admin-kpi-stat-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AdminCardWithActions,
  AdminCardHeaderWithActions,
  type AdminCardMenuSection,
} from "@/components/admin/admin-card-with-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserCheck,
  UserX,
  CalendarX,
  Search,
  Eye,
  Edit2,
  Trash2,
  Dumbbell,
  Target,
  Calendar,
  AlertTriangle,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { deleteClient, updateClientStatus } from "@/app/actions/clients";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getGoalLabel } from "@/lib/constants";
import { AdminClientStatusBadge } from "@/components/admin/admin-client-status-badge";

const CLIENT_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  expired: "Vencido",
  suspended: "Suspendido",
  inactive: "Inactivo",
  pending: "Pendiente",
  pending_payment: "Pendiente de pago",
};

export type ClientManagementCard = {
  id: string;
  userId?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  status: string;
  membershipEnd?: string | null;
  goal?: string | null;
  experienceLevel?: string | null;
  lastSessionAt?: string | null;
  daysSinceLastSession?: number | null;
  /** period_end del pago pagado más reciente (para contrastar con membership_end). */
  latestPaidPeriodEnd?: string | null;
  membershipVsLastPaymentMismatch?: boolean;
  planName?: string | null;
  assignedRoutineName?: string | null;
  createdAt: string;
};

interface ClientManagementContentProps {
  clients: ClientManagementCard[];
}

function parseLocalDate(dateStr: string) {
  return new Date(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`);
}

function getEffectiveStatus(client: ClientManagementCard): string {
  if (client.status === "active" && client.membershipEnd) {
    const endDay = client.membershipEnd.slice(0, 10);
    if (new Date(`${endDay}T23:59:59`) < new Date()) {
      return "expired";
    }
  }
  return client.status;
}

export function ClientManagementContent({
  clients: initialClients,
}: ClientManagementContentProps) {
  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        c.fullName.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search);

      if (!matchesSearch) return false;

      const effectiveStatus = getEffectiveStatus(c);
      if (activeTab === "all") return true;
      if (activeTab === "active") return effectiveStatus === "active";
      if (activeTab === "pending") return effectiveStatus === "pending";
      if (activeTab === "pending_payment") return effectiveStatus === "pending_payment";
      if (activeTab === "expired") return effectiveStatus === "expired";
      if (activeTab === "suspended") return effectiveStatus === "suspended";

      return true;
    });
  }, [clients, search, activeTab]);

  const stats = useMemo(() => {
    return {
      total: clients.length,
      active: clients.filter((c) => getEffectiveStatus(c) === "active").length,
      expired: clients.filter((c) => getEffectiveStatus(c) === "expired").length,
      suspended: clients.filter((c) => getEffectiveStatus(c) === "suspended").length,
      pending: clients.filter((c) => getEffectiveStatus(c) === "pending").length,
      pendingPayment: clients.filter((c) => getEffectiveStatus(c) === "pending_payment").length,
    };
  }, [clients]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const result = await deleteClient(deleteId);
      if (result.success) {
        setClients(clients.filter((c) => c.id !== deleteId));
        toast.success("¡Asesorado eliminado correctamente!");
      } else {
        toast.error("No pudimos eliminar al asesorado. Intenta de nuevo.");
      }
    } catch {
      toast.error("No pudimos eliminar al asesorado. Revisa tu conexión.");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  function formatLastWorkoutLabel(client: ClientManagementCard) {
    if (!client.lastSessionAt)
      return { primary: "Nunca" as const, secondary: null as string | null };
    const d = client.daysSinceLastSession;
    const zonedLast = toZonedWallClockDate(client.lastSessionAt);
    let primary: string;
    if (d === 0) primary = "Hoy";
    else if (d === 1) primary = "Ayer";
    else if (d != null && d < 7) primary = `Hace ${d} días`;
    else
      primary = format(zonedLast, "d MMM yyyy", {
        locale: es,
      });
    const secondary =
      d != null && d < 7
        ? format(zonedLast, "EEE d MMM · HH:mm", {
            locale: es,
          })
        : null;
    return { primary, secondary };
  }

  const handleStatusChange = async (
    clientId: string,
    userId: string | null | undefined,
    newStatus: string,
  ) => {
    try {
      const result = await updateClientStatus(clientId, newStatus);
      if (result.success) {
        setClients(
          clients.map((c) =>
            c.id === clientId ? { ...c, status: newStatus } : c,
          ),
        );
        const label =
          CLIENT_STATUS_LABELS[newStatus.toLowerCase()] ?? "actualizado";
        toast.success(`Asesorado marcado como «${label}».`);
      } else {
        toast.error("No pudimos cambiar el estado. Intenta de nuevo.");
      }
    } catch {
      toast.error("No pudimos cambiar el estado. Revisa tu conexión.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs — mismo patrón que el dashboard del coach; color solo en el pozo del icono */}
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <AdminKpiStatCard
          icon={Users}
          value={stats.total}
          label="Total"
          tone="primary"
          className="bg-card/60 backdrop-blur-xl border-border/50 rounded-[1.5rem] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
        />
        <AdminKpiStatCard
          icon={UserCheck}
          value={stats.active}
          label="Activos"
          tone="success"
          className="bg-card/60 backdrop-blur-xl border-border/50 rounded-[1.5rem] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
        />
        <AdminKpiStatCard
          icon={CalendarX}
          value={stats.expired}
          label="Vencidos"
          tone="destructive"
          className="bg-card/60 backdrop-blur-xl border-border/50 rounded-[1.5rem] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
        />
        <AdminKpiStatCard
          icon={UserX}
          value={stats.suspended}
          label="Suspendidos"
          tone="warning"
          className="bg-card/60 backdrop-blur-xl border-border/50 rounded-[1.5rem] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 rounded-[1rem] bg-card/60 border-border/50 backdrop-blur-xl shadow-sm focus-visible:ring-primary/20 text-[15px] transition-all hover:bg-card/80"
            />
          </div>
          <div className="w-full sm:w-auto">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="hidden sm:block"
            >
              <TabsList className="inline-flex w-auto bg-muted/50 p-1 h-11 rounded-xl border border-border/40 shadow-sm">
                <TabsTrigger
                  value="all"
                  className="rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm gap-2 text-sm"
                >
                  <Users className="size-3.5" />
                  Todos
                </TabsTrigger>
                <TabsTrigger
                  value="active"
                  className="rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm gap-2 text-sm"
                >
                  <UserCheck className="size-3.5" />
                  Activos
                </TabsTrigger>
                <TabsTrigger
                  value="pending"
                  className="rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm gap-2 text-sm"
                >
                  <AlertCircle className="size-3.5" />
                  Pendientes
                </TabsTrigger>
                <TabsTrigger
                  value="pending_payment"
                  className="rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm gap-2 text-sm"
                >
                  <Badge variant="outline" className="px-1 text-[10px] w-3.5 h-3.5 p-0 flex items-center justify-center border-amber-500/50 bg-amber-500/10 text-amber-500">$</Badge>
                  Falta Pago
                </TabsTrigger>
                <TabsTrigger
                  value="expired"
                  className="rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm gap-2 text-sm"
                >
                  <CalendarX className="size-3.5" />
                  Vencidos
                </TabsTrigger>
                <TabsTrigger
                  value="suspended"
                  className="rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm gap-2 text-sm"
                >
                  <UserX className="size-3.5" />
                  Susp.
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="block sm:hidden w-full">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="h-12 w-full bg-card/60 backdrop-blur-xl border-border/50 shadow-sm rounded-[1rem] px-4 font-bold text-[15px] text-foreground hover:bg-card/80 transition-all" aria-label="Seleccionar estado">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectGroup>
                    <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-2 py-1.5">Estado</SelectLabel>
                    <SelectItem value="all" className="rounded-lg py-2.5">
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-muted-foreground" />
                        <span>Todos</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="active" className="rounded-lg py-2.5">
                      <div className="flex items-center gap-2">
                        <UserCheck className="size-4 text-muted-foreground" />
                        <span>Activos</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="pending" className="rounded-lg py-2.5">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="size-4 text-muted-foreground" />
                        <span>Pendientes</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="pending_payment" className="rounded-lg py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center size-4 border rounded-full border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-600 font-bold">$</span>
                        <span>Falta Pago</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="expired" className="rounded-lg py-2.5">
                      <div className="flex items-center gap-2">
                        <CalendarX className="size-4 text-muted-foreground" />
                        <span>Vencidos</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="suspended" className="rounded-lg py-2.5">
                      <div className="flex items-center gap-2">
                        <UserX className="size-4 text-muted-foreground" />
                        <span>Suspendidos</span>
                      </div>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.length === 0 ? (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl">
              <p className="text-muted-foreground">
                No se encontraron asesorados
              </p>
            </div>
          ) : (
            filteredClients.map((client) => {
              const lastWorkout = formatLastWorkoutLabel(client);
              const menuSections: AdminCardMenuSection[] = [
                {
                  items: [
                    {
                      label: "Ver perfil",
                      icon: <Eye className="mr-2 size-4" />,
                      href: `/admin/clients/${client.id}`,
                    },
                    {
                      label: "Editar",
                      icon: <Edit2 className="mr-2 size-4" />,
                      href: `/admin/clients/${client.id}/edit`,
                    },
                    {
                      label: "Registrar pago / Renovar",
                      icon: <CreditCard className="mr-2 size-4" />,
                      href: `/admin/payments/new?clientId=${client.id}`,
                    },
                  ],
                },
                {
                  separatorBefore: true,
                  items: [
                    client.status === "active"
                      ? {
                          label: "Suspender",
                          icon: <UserX className="mr-2 size-4" />,
                          onClick: () =>
                            handleStatusChange(
                              client.id,
                              client.userId,
                              "suspended",
                            ),
                          className: "text-warning focus:text-warning",
                        }
                      : {
                          label: "Activar",
                          icon: <UserCheck className="mr-2 size-4" />,
                          onClick: () =>
                            handleStatusChange(
                              client.id,
                              client.userId,
                              "active",
                            ),
                          className: "text-success focus:text-success",
                        },
                  ],
                },
                {
                  separatorBefore: true,
                  items: [
                    {
                      label: "Eliminar",
                      icon: <Trash2 className="mr-2 size-4" />,
                      onClick: () => setDeleteId(client.id),
                      variant: "destructive" as const,
                    },
                  ],
                },
              ];
              return (
                <AdminCardWithActions
                  key={client.id}
                  menuSections={menuSections}
                  cardClassName="border-border/50 bg-card/60 rounded-[1.5rem] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-primary/20 group pb-1"
                >
                  <AdminCardHeaderWithActions menuSections={menuSections}>
                    <div className="flex items-center gap-3.5">
                      <Avatar className="size-[3.25rem] rounded-[1.1rem] border-2 border-background shadow-xs shrink-0 transition-transform group-hover:scale-105">
                        {client.avatarUrl ? (
                          <AvatarImage
                            src={client.avatarUrl}
                            alt={client.fullName}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-sm">
                          {client.fullName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <CardTitle className="text-[17px] font-bold truncate leading-none mb-1 group-hover:text-primary transition-colors">
                          {client.fullName}
                        </CardTitle>
                        <CardDescription className="text-[13px] font-medium opacity-80 truncate">
                          {client.email || "Sin email"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 ml-1">
                      <AdminClientStatusBadge status={getEffectiveStatus(client)} />
                      {client.planName && (
                        <Badge
                          variant="secondary"
                          className="font-bold text-[10px] bg-secondary/60 text-secondary-foreground shadow-sm uppercase tracking-widest px-2.5 py-0.5"
                        >
                          {client.planName}
                        </Badge>
                      )}
                    </div>
                  </AdminCardHeaderWithActions>
                  <CardContent className="flex flex-col gap-3 p-4 pt-4 px-4.5 bg-gradient-to-b from-transparent to-background/30">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1.5 rounded-[1rem] border border-border/40 bg-background/50 p-3 shadow-sm transition-colors hover:bg-background/80">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-80">
                          <Dumbbell className="size-3.5" />
                          Último Entreno
                        </div>
                        <div className="min-h-0">
                          <p className="text-[14px] font-bold leading-tight text-foreground">
                            {lastWorkout.primary}
                          </p>
                          {lastWorkout.secondary ? (
                            <p className="mt-0.5 text-[11px] capitalize font-medium leading-snug text-muted-foreground">
                              {lastWorkout.secondary}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 rounded-[1rem] border border-border/40 bg-background/50 p-3 shadow-sm transition-colors hover:bg-background/80">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-80">
                          <Calendar className="size-3.5" />
                          Vencimiento
                        </div>
                        <p className="text-[14px] font-bold leading-tight text-foreground">
                          {client.membershipEnd
                            ? format(
                                parseLocalDate(client.membershipEnd),
                                "d MMM yyyy",
                                { locale: es },
                              )
                            : "Sin fecha"}
                        </p>
                        {client.latestPaidPeriodEnd ? (
                          <p className="text-[11px] leading-snug text-muted-foreground font-medium mt-0.5">
                            Último pago: hasta{" "}
                            {format(
                              parseLocalDate(client.latestPaidPeriodEnd),
                              "d MMM yyyy",
                              { locale: es },
                            )}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {client.membershipVsLastPaymentMismatch ? (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-950 dark:text-amber-100">
                        <AlertTriangle
                          className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                          aria-hidden
                        />
                        <span>
                          La fecha de la ficha y la del{" "}
                          <span className="font-medium">último pago</span> no
                          coinciden. Actualiza el pago o la ficha para que
                          administración y acceso queden alineados.
                        </span>
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2 px-1.5 mt-0.5 text-[12px] text-muted-foreground font-medium">
                      <Target className="size-3.5 text-primary/70" />
                      <span className="truncate opacity-80">
                        {client.goal ? `Objetivo: ${getGoalLabel(client.goal)}` : "Sin objetivo especificado"}
                      </span>
                    </div>

                    {client.status === "pending" && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 text-[11px] text-primary border border-primary/10">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        <span>
                          Pendiente de que el usuario complete su registro
                        </span>
                      </div>
                    )}
                    {client.status === "pending_payment" && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-300 border border-amber-500/25">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
                          <span className="font-semibold">
                            Falta confirmar pago para activar
                          </span>
                        </div>
                        <Link
                          href={`/admin/payments/new?clientId=${client.id}`}
                          className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 hover:underline shrink-0"
                        >
                          <CreditCard className="size-3.5" />
                          Registrar pago →
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </AdminCardWithActions>
              );
            })
          )}
        </div>
      </div>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar asesorado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los datos
              asociados al cliente (sesiones, medidas, fotos, notas).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
