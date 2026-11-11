import { Suspense } from "react";
import { getAuthUser, getCurrentClientRecord } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getClientStats, getWorkoutSessionsByDateRange } from "@/lib/workouts";
import { sessionInstantLabel } from "@/lib/format-workout-session";
import { CalendarDays, ChevronRight, Clock, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CLIENT_DATA_PAGE_SHELL,
  ClientIncompleteProfileCard,
  ClientStackPageHeader,
} from "@/components/client/client-app-page-parts";
import { WorkoutsHistoryDateRangePicker } from "@/components/client/workouts-history-date-range";
import { formatLocalDateYmd, getNowInTimezone } from "@/lib/calendar-date";

type SearchParams = { from?: string; to?: string };

export default async function ClientWorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const clientRecord = await getCurrentClientRecord(user.id);

  if (!clientRecord) {
    return (
      <>
        <ClientStackPageHeader
          title="Historial"
          subtitle="Completa tu perfil para ver tus sesiones y volumen."
        />
        <div className={CLIENT_DATA_PAGE_SHELL}>
          <ClientIncompleteProfileCard />
        </div>
      </>
    );
  }

  const sp = await searchParams;

  // Rango por defecto: últimos 30 días (si no hay sesiones en 30d pero sí históricas y no hay filtro explícito, ampliamos a 365d)
  const today = getNowInTimezone();
  let defaultFromDate = new Date(today);
  defaultFromDate.setDate(today.getDate() - 30);

  let fromIso = sp.from || formatLocalDateYmd(defaultFromDate);
  const toIso = sp.to || formatLocalDateYmd(today);

  const [initialWorkoutSessions, stats] = await Promise.all([
    getWorkoutSessionsByDateRange(clientRecord.id, fromIso, toIso),
    getClientStats(clientRecord.id),
  ]);
  let workoutSessions = initialWorkoutSessions;

  if (
    !sp.from &&
    !sp.to &&
    (!workoutSessions || workoutSessions.length === 0) &&
    (stats.totalSessions ?? 0) > 0
  ) {
    const yearAgo = new Date(today);
    yearAgo.setDate(today.getDate() - 365);
    defaultFromDate = yearAgo;
    fromIso = formatLocalDateYmd(yearAgo);
    workoutSessions = await getWorkoutSessionsByDateRange(
      clientRecord.id,
      fromIso,
      toIso,
    );
  }

  const rangeSessionCount = workoutSessions?.length ?? 0;
  const totalCompleted = stats.totalSessions ?? 0;

  const historySubtitle =
    totalCompleted === 0
      ? "Sin sesiones aún · empieza un entreno desde Mis rutinas."
      : rangeSessionCount === 0
        ? `Ninguna sesión en este rango${totalCompleted > 0 ? ` · ${totalCompleted} en total histórico` : ""}.`
        : `${rangeSessionCount} ${rangeSessionCount === 1 ? "sesión" : "sesiones"} encontradas${totalCompleted > rangeSessionCount ? ` · ${totalCompleted} en total histórico` : ""}.`;

  const historyAside = (
    <aside className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-4 lg:sticky lg:top-[calc(112px+1.5rem)] lg:self-start">
      <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl transition-all hover:shadow-lg">
        <CardHeader className="pb-5 pt-6 px-6">
          <div className="flex items-center gap-4">
            <div className="flex size-11 grow-0 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
              <Dumbbell className="size-5 text-primary" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">Acciones</CardTitle>
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                {totalCompleted === 0 ? "Comenzar" : "Gestión de Plan"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-6 pb-6 pt-0">
          <div className="rounded-2xl border bg-muted/15 p-4 sm:p-5 ring-1 ring-border/5">
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {totalCompleted === 0 ? (
                <>
                  Aún no tienes sesiones. Tu viaje fitness comienza con tu primera rutina completada.
                </>
              ) : (
                <>
                  Has completado <span className="tabular-nums font-black text-primary text-base">{totalCompleted}</span> sesiones en total. 
                  {rangeSessionCount > 0 && (
                    <span className="block mt-1 text-xs text-muted-foreground">
                      Viendo <span className="font-bold text-foreground">{rangeSessionCount}</span> en el rango actual.
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
          
          <div className="space-y-3">
            <Button asChild className="h-12 w-full font-bold text-base rounded-2xl shadow-sm transition-all active:scale-[0.98]">
              <Link href="/client/routines">
                Ir a mis rutinas
                <ChevronRight className="ml-2 size-4 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 w-full font-bold text-sm rounded-2xl border-border/60 hover:bg-muted/30 transition-all active:scale-[0.98]">
              <Link href="/client/progress">Analizar mi progreso</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  );

  return (
    <>
      <ClientStackPageHeader title="Historial" subtitle={historySubtitle} />

      <div
        className={`${CLIENT_DATA_PAGE_SHELL} flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start`}
      >
        <section className="order-1 flex min-w-0 flex-col gap-6 lg:order-2 lg:col-span-8">
          {totalCompleted === 0 ? (
            <Card className="overflow-hidden rounded-3xl border-border/80 shadow-sm ring-1 ring-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <CalendarDays className="size-4 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">
                      Sesiones
                    </CardTitle>
                    <CardDescription>
                      Cada entreno que completes aparecerá aquí
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 px-4 py-8 text-center sm:px-6">
                  <p className="text-sm font-medium text-foreground">
                    Aún no tienes entrenamientos registrados
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground text-pretty">
                    Cuando completes un entreno desde{" "}
                    <span className="font-medium text-foreground">
                      Mis rutinas
                    </span>
                    , podrás revisarlo aquí filtrado por fecha.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl">
              <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 pt-6 px-6 border-b bg-muted/5">
                <div className="flex items-center gap-4">
                  <div className="flex size-11 grow-0 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <CalendarDays className="size-5 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-xl font-bold tracking-tight">
                      Sesiones Completadas
                    </CardTitle>
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                      Rango de tiempo seleccionado
                    </CardDescription>
                  </div>
                </div>

                <div className="shrink-0 w-full md:w-auto">
                  <Suspense fallback={null}>
                    <WorkoutsHistoryDateRangePicker
                      defaultFrom={defaultFromDate}
                      defaultTo={today}
                    />
                  </Suspense>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {!workoutSessions || workoutSessions.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/60 bg-muted/10 px-6 py-12 text-center transition-all">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted/20 mb-4">
                      <CalendarDays className="size-7 text-muted-foreground/40" />
                    </div>
                    <p className="text-lg font-bold text-foreground">
                      Sin registros hallados
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground text-pretty max-w-sm mx-auto font-medium">
                      Intenta ampliar el rango de fechas para visualizar tus entrenamientos de semanas anteriores.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {workoutSessions.map((session) => {
                      const rd = session.routine_days;
                      const dayMeta = Array.isArray(rd) ? rd[0] : rd;
                      const when = sessionInstantLabel(
                        session.started_at ?? session.created_at,
                      );
                      const planLabel =
                        dayMeta?.day_name?.trim() ||
                        (dayMeta?.day_number != null
                          ? `Día ${dayMeta.day_number}`
                          : null);

                      return (
                        <article
                          key={session.id}
                          className="group relative flex flex-col gap-4 rounded-3xl border border-border/40 bg-card/40 p-5 sm:p-6 shadow-sm transition-all hover:shadow-xl hover:bg-card hover:border-primary/20 hover:-translate-y-0.5 overflow-hidden ring-1 ring-border/5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 relative z-10">
                            <div className="min-w-0 flex flex-col gap-1 text-left">
                               <div className="flex flex-wrap items-center gap-2 mb-1">
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider rounded-md",
                                    session.status === "completed" 
                                      ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 shadow-sm shadow-green-500/10" 
                                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm shadow-amber-500/10"
                                  )}
                                >
                                  {session.status === "completed" ? "Sesión Finalizada" : "En progreso"}
                                </Badge>
                                {when.timeLine ? (
                                  <Badge className="font-bold text-[10px] bg-primary/5 text-primary border-none shadow-none uppercase tracking-tighter">
                                    {when.timeLine}
                                  </Badge>
                                ) : null}
                              </div>
                              <h2 className="text-xl font-black text-foreground leading-[1.1] tracking-tight group-hover:text-primary transition-colors">
                                {when.dateLine}
                              </h2>
                              {planLabel && (
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="size-1.5 rounded-full bg-primary/40 animate-pulse" />
                                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                    Enfoque: <span className="text-foreground">{planLabel}</span>
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="hidden sm:block">
                               <Button asChild size="icon" variant="ghost" className="size-9 rounded-full bg-muted/5 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                  <Link href={`/client/workout/summary?sessionId=${session.id}`}>
                                    <ChevronRight className="size-5" />
                                  </Link>
                               </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-x-6 gap-y-4 pt-4 border-t border-border/40 relative z-10">
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 items-center justify-center rounded-full bg-primary/5 border border-primary/10 shadow-inner group-hover:bg-primary/10 transition-colors">
                                <Dumbbell className="size-4 text-primary" aria-hidden />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-black tabular-nums text-foreground leading-tight">
                                  {session.exercises_completed ?? 0}
                                </span>
                                <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest">Ejercicios</span>
                              </div>
                            </div>

                            {session.duration_minutes != null && (
                              <div className="flex items-center gap-3">
                                <div className="flex size-9 items-center justify-center rounded-full bg-primary/5 border border-primary/10 shadow-inner group-hover:bg-primary/10 transition-colors">
                                  <Clock className="size-4 text-primary" aria-hidden />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-black tabular-nums text-foreground leading-tight">
                                    {session.duration_minutes}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest">Mins</span>
                                </div>
                              </div>
                            )}

                            {session.total_volume_kg != null && session.total_volume_kg > 0 && (
                              <div className="flex items-center gap-3 col-span-2 sm:col-span-1">
                                <div className="flex size-9 items-center justify-center rounded-full bg-primary/5 border border-primary/10 shadow-inner group-hover:bg-primary/10 transition-colors">
                                  <div className="font-black text-primary text-[10px]">KG</div>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-black tabular-nums text-foreground leading-tight">
                                    {session.total_volume_kg.toLocaleString()}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest">Total Volumen</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {session.feeling_note ? (
                            <div className="mt-2 relative rounded-2xl bg-muted/15 px-5 py-4 border-l-4 border-primary/20 group-hover:bg-primary/5 transition-all">
                              <p className="text-sm font-medium italic leading-relaxed text-muted-foreground group-hover:text-foreground/80 transition-colors">
                                &ldquo;{session.feeling_note}&rdquo;
                              </p>
                            </div>
                          ) : null}
                          
                          <div className="block sm:hidden mt-2 pt-2 border-t border-border/20">
                             <Button asChild variant="link" className="w-full justify-center gap-2 font-bold text-primary text-xs uppercase tracking-widest">
                                <Link href={`/client/workout/summary?sessionId=${session.id}`}>
                                   Ver Detalles <ChevronRight className="size-3" />
                                </Link>
                             </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </section>
        {historyAside}
      </div>
    </>
  );
}
