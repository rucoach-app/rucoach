"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AdminDashboardCards } from "@/components/admin/admin-dashboard-cards";
import { Skeleton } from "@/components/ui/skeleton";

const AdminWorkoutChart = dynamic(
  () =>
    import("@/components/admin/admin-workout-chart").then((m) => ({
      default: m.AdminWorkoutChart,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[220px] w-full rounded-xl" />,
  },
);
import {
  AdminCardWithActions,
  AdminCardHeaderWithActions,
  type AdminCardMenuSection,
} from "@/components/admin/admin-card-with-actions";
import {
  type CoachClientCard,
  type CoachOverviewMetrics,
} from "./coach-overview";
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  Eye,
  Edit2,
  Info,
  UserCheck,
  UserX,
  Sparkles,
  Trophy,
  Users,
  Clock,
  AlertCircle,
  Zap,
  Dumbbell,
  Search,
  X,
  MessageSquare,
  UserPlus,
  KeyRound,
  CreditCard,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { updateClientStatus } from "@/app/actions/clients";
import { restartClientRoutine } from "@/app/actions/routine-assignment";
import { toast } from "sonner";

function formatRelativeDays(days: number) {
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

function _MetricHint({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="-m-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={label}
        >
          <Info className="size-3.5 opacity-70" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[min(100vw-1rem,17rem)] text-pretty"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function scheduleScrollToElement(el: HTMLElement | null) {
  if (!el) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      el.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  });
}

export function CoachOverviewClient({
  cards,
  metrics,
  planNames,
  routineNames,
}: {
  cards: CoachClientCard[];
  metrics: CoachOverviewMetrics;
  planNames: string[];
  routineNames: string[];
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [routineFilter, setRoutineFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [cardsState, setCardsState] = useState(cards);
  const clientsSectionRef = useRef<HTMLElement>(null);

  const scrollToClientsSection = useCallback(() => {
    scheduleScrollToElement(clientsSectionRef.current);
  }, []);

  useEffect(() => {
    setCardsState(cards);
  }, [cards]);

  const handleStatusChange = async (clientId: string, newStatus: string) => {
    try {
      const result = await updateClientStatus(clientId, newStatus);
      if (result?.success) {
        setCardsState((prev) =>
          prev.map((c) =>
            c.id === clientId ? { ...c, status: newStatus } : c,
          ),
        );
        const label = newStatus === "active" ? "Activo" : "Suspendido";
        toast.success(`Asesorado marcado como «${label}».`);
      } else {
        toast.error(result?.error || "No pudimos cambiar el estado.");
      }
    } catch {
      toast.error("No pudimos cambiar el estado. Revisa tu conexión.");
    }
  };

  const handleRestartRoutine = async (
    clientRoutineId: string,
    fullName: string,
  ) => {
    if (
      !confirm(
        `¿Estás seguro de que quieres reiniciar la rutina de ${fullName} a la Semana 1?`,
      )
    )
      return;

    try {
      const result = await restartClientRoutine(clientRoutineId);
      if (result?.success) {
        setCardsState((prev) =>
          prev.map((c) =>
            c.clientRoutineId === clientRoutineId
              ? {
                  ...c,
                  currentWeek: 1,
                  isRoutineCompleted: false,
                  attentionReason: null,
                  needsAttention: false,
                }
              : c,
          ),
        );
        toast.success(`Rutina de ${fullName} reiniciada a la Semana 1.`);
      } else {
        toast.error("No pudimos reiniciar la rutina.");
      }
    } catch {
      toast.error("Error al reiniciar la rutina.");
    }
  };

  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cardsState
      .filter((c) => {
        if (!query) return true;
        return c.fullName.toLowerCase().includes(query);
      })
      .filter((c) => {
        if (activeTab === "activeWeek")
          return (
            c.status === "active" &&
            c.daysSinceLastSession != null &&
            c.daysSinceLastSession <= 6
          );
        if (activeTab === "inactive3")
          return (
            c.status === "active" &&
            (c.daysSinceLastSession == null || c.daysSinceLastSession >= 3)
          );
        if (activeTab === "attention") return c.needsAttention;
        if (activeTab === "all") return true;

        return true;
      })
      .filter((c) => {
        if (planFilter === "all") return true;
        return (c.planName || "") === planFilter;
      })
      .filter((c) => {
        if (routineFilter === "all") return true;
        return (c.assignedRoutineName || "") === routineFilter;
      });
  }, [cardsState, search, activeTab, planFilter, routineFilter]);

  const pendingPaymentCards = useMemo(
    () => cardsState.filter((c) => c.status === "pending_payment"),
    [cardsState],
  );

  return (
    <div className="flex flex-1 flex-col gap-6 lg:gap-8">
      <section className="flex flex-col gap-4" aria-label="Resumen y actividad">
        {pendingPaymentCards.length > 0 && (
          <Card className="overflow-hidden rounded-2xl border-amber-500/40 bg-amber-500/10 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                    <CreditCard className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      Activación y Pago Pendiente ({pendingPaymentCards.length})
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Nuevos asesorados que ya completaron su registro inicial y esperan confirmación de pago para acceder a la app.
                    </p>
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingPaymentCards.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-card/90 px-3.5 py-2.5 shadow-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground truncate">
                          {c.fullName}
                        </p>
                        <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          Esperando confirmación de pago
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          asChild
                          size="sm"
                          className="h-8 rounded-lg px-2.5 text-xs font-bold"
                        >
                          <Link href={`/admin/payments/new?clientId=${c.id}`}>
                            <CreditCard className="mr-1.5 size-3.5" />
                            Registrar Pago
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg px-2.5 text-xs font-semibold"
                          onClick={() => handleStatusChange(c.id, "active")}
                        >
                          <UserCheck className="mr-1 size-3.5 text-emerald-500" />
                          Activar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {metrics.attentionCount > 0 ? (
          <Alert
            variant="default"
            className="border-warning/35 bg-warning/10 text-foreground [&>svg]:text-warning"
          >
            <AlertTriangle className="size-4" aria-hidden />
            <AlertTitle className="text-sm font-semibold text-foreground sm:text-base">
              Hay {metrics.attentionCount} asesorado
              {metrics.attentionCount !== 1 ? "s" : ""} que priorizar
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-3 text-xs text-muted-foreground sm:text-sm">
              <span className="text-pretty leading-relaxed">
                Incluye alertas de dolor activo, planes vencidos, sin rutina o
                sin entrenar varios días. Usa el filtro &quot;Atención&quot;
                para ver la lista completa.
              </span>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="w-full shadow-sm sm:w-fit"
                onClick={() => {
                  setActiveTab("attention");
                  scrollToClientsSection();
                }}
              >
                Ver solo atención
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <AdminDashboardCards
          totalTrainingsThisWeek={metrics.totalTrainingsThisWeek}
          prsThisMonth={metrics.prsThisMonth}
          prsLastMonth={metrics.prsLastMonth}
          mostActiveClientId={metrics.mostActiveClientId}
          mostActiveClientName={metrics.mostActiveClientName}
          attentionClientId={metrics.attentionClientId}
          attentionClientName={metrics.attentionClientName}
          attentionReason={metrics.attentionReason}
          trainingsLastWeek={metrics.trainingsLastWeek}
          totalClients={metrics.totalClients}
          activeThisWeekCount={metrics.activeThisWeekCount}
          attentionCount={metrics.attentionCount}
        />

        <AdminWorkoutChart data={metrics.chartData} />
      </section>

      <section
        ref={clientsSectionRef}
        className="flex scroll-mt-24 flex-col gap-4 sm:scroll-mt-28"
        aria-label="Listado de asesorados"
        tabIndex={-1}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">
              Tus asesorados
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Filtra por comportamiento real: activos esta semana, baja actividad
            o casos que necesitan prioridad.
          </p>
        </div>

        {cardsState.length === 0 ? (
          <Card className="overflow-hidden rounded-3xl border-dashed border-border/70 bg-card/50 backdrop-blur-xl shadow-sm">
            <CardContent className="flex flex-col items-center justify-center gap-4 p-8 sm:p-12 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="size-8" aria-hidden />
              </div>
              <div className="flex flex-col gap-1.5 max-w-md">
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                  No tienes asesorados todavía
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Comienza registrando a tu primer atleta, diseñando tu catálogo
                  de rutinas o compartiendo un código de invitación.
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                <Button asChild className="rounded-xl font-bold">
                  <Link href="/admin/clients/new">
                    <UserPlus className="mr-2 size-4" />
                    Nuevo asesorado
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-xl font-bold">
                  <Link href="/admin/routines/new">
                    <Dumbbell className="mr-2 size-4" />
                    Crear rutina
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-xl font-bold">
                  <Link href="/admin/invitations">
                    <KeyRound className="mr-2 size-4" />
                    Códigos de invitación
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="py-0 gap-0 rounded-2xl border-border/50 bg-card/60 backdrop-blur-xl shadow-sm">
              <CardHeader className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-bold tracking-tight text-foreground">
                    Filtros
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Puedes combinar búsqueda por nombre, pestañas, plan y rutina.
                  </CardDescription>
                </div>
                <div className="w-full sm:w-auto">
                  <Tabs
                    value={activeTab}
                    onValueChange={(v) => {
                      setActiveTab(v);
                      if (v === "attention") scrollToClientsSection();
                    }}
                    className="hidden sm:block"
                  >
                    <TabsList className="inline-flex w-auto bg-card/60 backdrop-blur-xl p-1 h-12 rounded-[1rem] border border-border/50 shadow-sm">
                      <TabsTrigger
                        value="all"
                        className="rounded-lg px-3.5 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold transition-all gap-2 text-[14px] font-medium"
                      >
                        <Users className="size-4" />
                        Todos
                      </TabsTrigger>
                      <TabsTrigger
                        value="activeWeek"
                        className="rounded-lg px-3.5 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold transition-all gap-2 text-[14px] font-medium"
                      >
                        <Zap className="size-4" />
                        Activos 7d
                      </TabsTrigger>
                      <TabsTrigger
                        value="inactive3"
                        className="rounded-lg px-3.5 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold transition-all gap-2 text-[14px] font-medium"
                      >
                        <Clock className="size-4" />
                        Baja actividad
                      </TabsTrigger>
                      <TabsTrigger
                        value="attention"
                        className="rounded-lg px-3.5 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold transition-all gap-2 text-[14px] font-medium"
                      >
                        <AlertCircle className="size-4" />
                        Atención
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="block sm:hidden w-full mt-2">
                    <Select
                      value={activeTab}
                      onValueChange={(v) => {
                        setActiveTab(v);
                        if (v === "attention") scrollToClientsSection();
                      }}
                    >
                      <SelectTrigger
                        className="h-12 w-full bg-card/60 backdrop-blur-xl border-border/50 shadow-sm rounded-[1rem] px-4 font-bold text-[15px] text-foreground hover:bg-card/80 transition-all"
                        aria-label="Seleccionar vista"
                      >
                        <SelectValue placeholder="Vista" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectGroup>
                          <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-2 py-1.5">
                            Actividad
                          </SelectLabel>
                          <SelectItem value="all" className="rounded-lg py-2.5">
                            <div className="flex items-center gap-2">
                              <Users className="size-4" />
                              <span>Todos los asesorados</span>
                            </div>
                          </SelectItem>
                          <SelectItem
                            value="activeWeek"
                            className="rounded-lg py-2.5"
                          >
                            <div className="flex items-center gap-2">
                              <Zap className="size-4" />
                              <span>Activos (7 días)</span>
                            </div>
                          </SelectItem>
                          <SelectItem
                            value="inactive3"
                            className="rounded-lg py-2.5"
                          >
                            <div className="flex items-center gap-2">
                              <Clock className="size-4" />
                              <span>Baja actividad (3+ días)</span>
                            </div>
                          </SelectItem>
                          <SelectItem
                            value="attention"
                            className="rounded-lg py-2.5"
                          >
                            <div className="flex items-center gap-2">
                              <AlertCircle className="size-4" />
                              <span>Requieren atención</span>
                            </div>
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 p-4 pt-0 sm:p-5 sm:pt-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="relative w-full sm:w-[260px]">
                    <Search
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar asesorado por nombre..."
                      className="h-12 w-full rounded-[1rem] border-border/50 bg-card/60 pl-10 pr-9 text-[14px] font-medium backdrop-blur-xl shadow-sm transition-all hover:bg-card/80"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        aria-label="Limpiar búsqueda"
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger
                      className="h-12 w-full sm:w-[200px] bg-card/60 backdrop-blur-xl border-border/50 shadow-sm rounded-[1rem] px-4 font-medium text-[14px] transition-all hover:bg-card/80"
                      aria-label="Filtrar por plan"
                    >
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent className="rounded-[1rem]">
                      <SelectGroup>
                        <SelectLabel>Plan</SelectLabel>
                        <SelectItem value="all">Todos los planes</SelectItem>
                        {planNames.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select value={routineFilter} onValueChange={setRoutineFilter}>
                    <SelectTrigger
                      className="h-12 w-full sm:w-[200px] bg-card/60 backdrop-blur-xl border-border/50 shadow-sm rounded-[1rem] px-4 font-medium text-[14px] transition-all hover:bg-card/80"
                      aria-label="Filtrar por rutina"
                    >
                      <SelectValue placeholder="Rutina" />
                    </SelectTrigger>
                    <SelectContent className="rounded-[1rem]">
                      <SelectGroup>
                        <SelectLabel>Rutina</SelectLabel>
                        <SelectItem value="all">Todas las rutinas</SelectItem>
                        {routineNames.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    className="h-12 w-full sm:w-auto rounded-[1rem] border-border/50 bg-card/60 backdrop-blur-xl shadow-sm text-[14px] px-6 transition-all hover:-translate-y-0.5"
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setActiveTab("all");
                      setPlanFilter("all");
                      setRoutineFilter("all");
                    }}
                  >
                    Restablecer filtros
                  </Button>
                </div>

                <p className="text-sm font-medium tabular-nums text-muted-foreground">
                  {filteredCards.length} resultado
                  {filteredCards.length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            {/* Cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCards.map((c) => {
                const menuSections: AdminCardMenuSection[] = [
                  {
                    items: [
                      {
                        label: "Ver perfil",
                        icon: <Eye className="mr-2 size-4" />,
                        href: `/admin/clients/${c.id}`,
                      },
                      {
                        label: "Editar",
                        icon: <Edit2 className="mr-2 size-4" />,
                        href: `/admin/clients/${c.id}/edit`,
                      },
                      {
                        label: "Registrar pago / Activar",
                        icon: <CreditCard className="mr-2 size-4" />,
                        href: `/admin/payments/new?clientId=${c.id}`,
                      },
                      ...(c.userId
                        ? [
                            {
                              label: "Enviar mensaje",
                              icon: <MessageSquare className="mr-2 size-4" />,
                              href: `/admin/messages?clientId=${c.userId}`,
                            },
                          ]
                        : []),
                    ],
                  },
                  ...(c.isRoutineCompleted && c.clientRoutineId
                    ? [
                        {
                          separatorBefore: true as const,
                          items: [
                            {
                              label: "Reiniciar rutina (W1)",
                              icon: <Sparkles className="mr-2 size-4" />,
                              onClick: () =>
                                handleRestartRoutine(
                                  c.clientRoutineId!,
                                  c.fullName,
                                ),
                              className: "text-primary focus:text-primary",
                            },
                          ],
                        },
                      ]
                    : []),
                  ...(c.status === "active" ||
                  c.status === "suspended" ||
                  c.status === "pending_payment" ||
                  c.status === "expired"
                    ? [
                        {
                          separatorBefore: true as const,
                          items: [
                            c.status === "active"
                              ? {
                                  label: "Suspender",
                                  icon: <UserX className="mr-2 size-4" />,
                                  onClick: () =>
                                    handleStatusChange(c.id, "suspended"),
                                  className: "text-warning focus:text-warning",
                                }
                              : {
                                  label: "Activar acceso directo",
                                  icon: <UserCheck className="mr-2 size-4" />,
                                  onClick: () =>
                                    handleStatusChange(c.id, "active"),
                                  className: "text-success focus:text-success",
                                },
                          ],
                        },
                      ]
                    : []),
                ];

                const hasPainReports =
                  c.activePainReports && c.activePainReports.length > 0;

                return (
                  <AdminCardWithActions
                    key={c.id}
                    menuSections={menuSections}
                    cardClassName={cn(
                      "border-border/50 bg-card/60 rounded-[1.5rem] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-primary/20 group pb-1 flex flex-col h-full",
                      hasPainReports
                        ? "border-destructive/40 border-l-[4px] border-l-destructive bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent hover:border-destructive/60"
                        : c.needsAttention &&
                            "border-warning/30 border-l-[4px] border-l-warning bg-gradient-to-br from-warning/10 via-warning/5 to-transparent hover:border-warning/50",
                    )}
                  >
                    <AdminCardHeaderWithActions menuSections={menuSections}>
                      <div className="flex items-center gap-3.5">
                        <Avatar className="size-[3.25rem] rounded-[1.1rem] border-2 border-background shadow-xs shrink-0 transition-transform group-hover:scale-105">
                          {c.avatarUrl ? (
                            <AvatarImage
                              src={c.avatarUrl}
                              alt={c.fullName}
                              className="object-cover"
                            />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary font-black text-sm">
                            {c.fullName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="text-[17px] font-bold truncate leading-none mb-1 group-hover:text-primary transition-colors">
                            {c.fullName}
                          </CardTitle>
                          <div className="text-[13px] font-medium opacity-80 text-muted-foreground truncate">
                            {c.planName ? `Plan: ${c.planName}` : "Sin plan"}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-4 ml-1">
                        {c.activePainReports?.map((report, idx) => (
                          <Badge
                            key={`${report.bodyPart}-${idx}`}
                            variant="secondary"
                            className="font-bold text-[10px] bg-destructive/15 text-destructive shadow-sm uppercase tracking-widest px-2.5 py-0.5 gap-1 border border-destructive/30"
                            title={`Dolor activo: ${report.bodyPart} (${report.severity}/10)`}
                          >
                            <AlertTriangle className="size-3" aria-hidden />
                            Dolor: {report.bodyPart} ({report.severity}/10)
                          </Badge>
                        ))}
                        {(c.unreadMessagesCount ?? 0) > 0 && (
                          <Badge
                            asChild={!!c.userId}
                            variant="secondary"
                            className="font-bold text-[10px] bg-primary/15 text-primary shadow-sm uppercase tracking-widest px-2.5 py-0.5 gap-1 border border-primary/30 hover:bg-primary/25 transition-colors"
                          >
                            {c.userId ? (
                              <Link
                                href={`/admin/messages?clientId=${c.userId}`}
                              >
                                <MessageSquare
                                  className="size-3"
                                  aria-hidden
                                />
                                {c.unreadMessagesCount} msg sin leer
                              </Link>
                            ) : (
                              <span>
                                <MessageSquare
                                  className="size-3"
                                  aria-hidden
                                />
                                {c.unreadMessagesCount} msg sin leer
                              </span>
                            )}
                          </Badge>
                        )}
                        {c.isRoutineCompleted ? (
                          <Badge
                            variant="secondary"
                            className="font-bold text-[10px] bg-success/20 text-success shadow-sm uppercase tracking-widest px-2.5 py-0.5 gap-1 border-success/30"
                            title="Rutina completada"
                          >
                            <Trophy className="size-3" aria-hidden />
                            Completada
                          </Badge>
                        ) : c.needsAttention && !hasPainReports ? (
                          <Badge
                            variant="secondary"
                            className="font-bold text-[10px] bg-warning/20 text-warning-foreground shadow-sm uppercase tracking-widest px-2.5 py-0.5 gap-1 border-warning/30"
                            title={c.attentionReason || "Atención"}
                          >
                            <AlertTriangle className="size-3" aria-hidden />
                            {c.attentionReason || "Atención"}
                          </Badge>
                        ) : c.streakDays != null && c.streakDays > 0 ? (
                          <Badge
                            variant="secondary"
                            className="font-bold text-[10px] bg-primary/20 text-primary shadow-sm uppercase tracking-widest px-2.5 py-0.5"
                          >
                            {c.streakDays}d racha
                          </Badge>
                        ) : null}
                      </div>
                    </AdminCardHeaderWithActions>

                    <CardContent className="flex flex-col gap-2.5 pt-1 px-4.5 pb-4 flex-1 justify-end bg-gradient-to-b from-transparent to-background/30">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex flex-col gap-1.5 rounded-[1rem] border border-border/40 bg-background/50 p-3 shadow-sm transition-colors hover:bg-background/80">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-80">
                            <Clock className="size-3.5" />
                            Última sesión
                          </div>
                          <span className="text-[14px] font-bold tabular-nums text-foreground">
                            {c.daysSinceLastSession != null
                              ? formatRelativeDays(c.daysSinceLastSession)
                              : "Nunca"}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5 rounded-[1rem] border border-border/40 bg-background/50 p-3 shadow-sm transition-colors hover:bg-background/80">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-80">
                            <Zap className="size-3.5" />
                            Meta Sem/7d
                          </div>
                          <span className="text-[14px] font-bold tabular-nums text-foreground">
                            {c.compliance7dPct != null ? (
                              <>
                                {Math.round(c.compliance7dPct * 100)}%
                                {c.complianceSessionsDone7d != null &&
                                c.complianceSessionsTarget != null ? (
                                  <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                                    ({c.complianceSessionsDone7d}/
                                    {c.complianceSessionsTarget})
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              "Sin meta"
                            )}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5 rounded-[1rem] border border-border/40 bg-background/50 p-3 shadow-sm transition-colors hover:bg-background/80">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-80">
                            <Sparkles className="size-3.5" />
                            Volumen
                          </div>
                          <span className="flex min-w-0 items-center justify-start gap-1 text-[14px] font-bold">
                            {c.trend === "up" ? (
                              <span className="flex items-center gap-0.5 text-primary">
                                <ArrowUp className="size-3.5" aria-hidden />
                                Sube
                              </span>
                            ) : c.trend === "down" ? (
                              <span className="flex items-center gap-0.5 text-destructive">
                                <ArrowDown className="size-3.5" aria-hidden />
                                Baja
                              </span>
                            ) : (
                              <span className="text-foreground/70">Igual</span>
                            )}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5 rounded-[1rem] border border-border/40 bg-background/50 p-3 shadow-sm transition-colors hover:bg-background/80">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-80">
                            <Dumbbell className="size-3.5" />
                            Series PR (30d)
                          </div>
                          <span className="text-[14px] font-bold tabular-nums text-foreground">
                            {typeof c.prEvents30d === "number"
                              ? c.prEvents30d
                              : "0"}
                          </span>
                        </div>
                      </div>

                      {(c.status === "pending_payment" ||
                        c.status === "expired") && (
                        <div className="mt-1 flex items-center justify-between gap-2 rounded-[1rem] border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 shadow-sm">
                          <span className="text-[11px] text-amber-700 dark:text-amber-300 font-black tracking-widest uppercase">
                            {c.status === "pending_payment"
                              ? "Pago pendiente"
                              : "Membresía vencida"}
                          </span>
                          <Link
                            href={`/admin/payments/new?clientId=${c.id}`}
                            className="inline-flex items-center gap-1 text-[13px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                          >
                            <CreditCard className="size-3.5" />
                            Confirmar pago →
                          </Link>
                        </div>
                      )}

                      <div className="mt-1 flex items-center justify-between gap-2 rounded-[1rem] border border-border/40 bg-background/50 px-4 py-2.5 shadow-sm">
                        <span className="text-[11px] text-muted-foreground font-black tracking-widest uppercase opacity-80">
                          Rutina
                        </span>
                        <span className="max-w-[70%] truncate text-right text-[13px] font-bold text-foreground">
                          {c.assignedRoutineName ? (
                            c.assignedRoutineName
                          ) : (
                            <Link
                              href={`/admin/clients/${c.id}/assign-routine`}
                              className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
                            >
                              Asignar rutina →
                            </Link>
                          )}
                        </span>
                      </div>

                      {c.userId && (
                        <div className="flex items-center justify-end pt-0.5">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-lg px-2.5 text-xs font-bold text-muted-foreground hover:text-primary"
                          >
                            <Link
                              href={`/admin/messages?clientId=${c.userId}`}
                            >
                              <MessageSquare className="mr-1.5 size-3.5" />
                              Enviar mensaje
                            </Link>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </AdminCardWithActions>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
