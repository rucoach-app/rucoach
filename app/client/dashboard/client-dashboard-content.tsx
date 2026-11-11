"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { LevelProgress } from "@/components/client/level-progress";
import { ClientDashboardCards } from "@/components/client/client-dashboard-cards";
import { Skeleton } from "@/components/ui/skeleton";

const ClientWorkoutChart = dynamic(
  () =>
    import("@/components/client/client-workout-chart").then((m) => ({
      default: m.ClientWorkoutChart,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[220px] w-full rounded-3xl" />,
  },
);
import { NextWorkoutCard } from "@/components/client/next-workout-card";
import { AchievementBadge } from "@/components/client/achievement-badge";
import {
  Award,
  CalendarClock,
  Check,
  ChevronRight,
  CreditCard,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Profile,
  Routine,
  RoutineDay,
  LevelInfo,
  UserAchievement,
} from "@/lib/types";
import {
  ClientStackPageHeader,
  CLIENT_DATA_PAGE_SHELL,
} from "@/components/client/client-app-page-parts";

export interface WeekDayStatus {
  label: string;
  dateStr: string;
  completed: boolean;
  isToday: boolean;
}

interface ClientDashboardContentProps {
  profile: Profile | null;
  levelInfo: LevelInfo;
  totalWorkouts: number;
  totalVolume: number;
  prsThisMonth: number;
  assignedRoutine: Routine | null;
  clientRoutineId?: string | null;
  /** Mismo criterio que /client/workout/start (última sesión completada + orden day_number). */
  nextWorkoutRoutineDay: RoutineDay | null;
  isRoutineCompleted?: boolean;
  userAchievements: UserAchievement[];
  chartData: { date: string; sessions: number }[];
  membershipEnd?: string | null;
  currentWeek?: number | null;
  durationWeeks?: number | null;
  workoutsThisWeek?: number;
  weeklyTarget?: number;
  weekDaysStatus?: WeekDayStatus[];
}

export function ClientDashboardContent({
  profile,
  levelInfo,
  totalWorkouts,
  totalVolume,
  prsThisMonth,
  assignedRoutine,
  clientRoutineId,
  nextWorkoutRoutineDay,
  isRoutineCompleted,
  userAchievements,
  chartData,
  membershipEnd,
  currentWeek,
  durationWeeks,
  workoutsThisWeek = 0,
  weeklyTarget = 4,
  weekDaysStatus = [],
}: ClientDashboardContentProps) {
  const userLabel =
    profile?.full_name?.split(/\s+/).filter(Boolean)[0] || "Asesorado";

  const trainDays = useMemo(() => {
    return ((assignedRoutine?.routine_days || []) as any[]).filter(
      (d) => !d.is_rest_day,
    );
  }, [assignedRoutine]);

  const daysUntilExpiry = (() => {
    if (!membershipEnd) return null;
    const endDay = membershipEnd.slice(0, 10);
    const endDate = new Date(`${endDay}T23:59:59`);
    if (Number.isNaN(endDate.getTime())) return null;
    return Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  })();

  const formattedExpiry = (() => {
    if (!membershipEnd) return null;
    const endDay = membershipEnd.slice(0, 10);
    const d = new Date(`${endDay}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  })();

  return (
    <>
      <ClientStackPageHeader
        kicker={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' }).toUpperCase()}
        title={`¿Listo para el reto, ${userLabel}?`}
        subtitle="Sigue tu plan, supera tus marcas y desbloquea el siguiente nivel."
        backHref={null}
      />
      <div className={`${CLIENT_DATA_PAGE_SHELL} grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-12`}>
        {daysUntilExpiry !== null && daysUntilExpiry <= 5 && (
          <div className="lg:col-span-12">
            <Card className="overflow-hidden rounded-2xl border-warning/40 bg-warning/10 shadow-sm">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-warning/30 bg-warning/20 text-warning-foreground">
                    <CalendarClock className="size-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {daysUntilExpiry < 0
                        ? "Tu membresía ha vencido"
                        : daysUntilExpiry === 0
                          ? "Tu membresía vence hoy"
                          : `Tu membresía vence en ${daysUntilExpiry} día${daysUntilExpiry === 1 ? "" : "s"}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formattedExpiry
                        ? `Fecha de corte: ${formattedExpiry}. Coordina tu renovación con tu coach para mantener acceso continuo.`
                        : "Coordina tu renovación con tu coach para mantener acceso continuo."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button asChild variant="outline" size="sm" className="h-9 rounded-xl text-xs font-bold">
                    <Link href="/client/profile#membership">
                      <CreditCard className="mr-1.5 size-3.5" />
                      Ver mi membresía
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="h-9 rounded-xl text-xs font-bold">
                    <Link href="/client/messages">Contactar coach</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <aside className="order-2 xl:order-1 flex flex-col gap-4 sm:gap-6 lg:gap-8 lg:col-span-12 xl:col-span-4 xl:sticky xl:top-[calc(96px+1.5rem)] xl:self-start">
          <LevelProgress
            levelInfo={levelInfo}
            username={profile?.username || profile?.full_name}
            avatarUrl={profile?.avatar_url}
          />
          <ClientDashboardCards
            streakDays={profile?.streak_days || 0}
            totalWorkouts={totalWorkouts}
            totalVolume={totalVolume}
            prsThisMonth={prsThisMonth}
          />
        </aside>

        <section className="order-1 xl:order-2 flex min-w-0 flex-col gap-4 sm:gap-6 lg:gap-8 lg:col-span-12 xl:col-span-8">
          <div className="flex flex-col gap-3.5 sm:gap-4">
            {weekDaysStatus.length > 0 && (
              <Card className="overflow-hidden border-border/80 shadow-sm ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
                <CardContent className="p-3.5 sm:p-6 flex flex-col gap-3 sm:gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-7 sm:size-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary shrink-0">
                        <Flame className="size-3.5 sm:size-4" aria-hidden />
                      </div>
                      <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-foreground truncate">
                        Meta Semanal
                      </span>
                    </div>
                    <span
                      className={cn(
                        "rounded-xl px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wider tabular-nums whitespace-nowrap shrink-0",
                        workoutsThisWeek >= weeklyTarget
                          ? "bg-success/15 text-success border border-success/30"
                          : "bg-primary/10 text-primary border border-primary/20",
                      )}
                    >
                      {workoutsThisWeek} / {weeklyTarget} esta semana
                    </span>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
                    {weekDaysStatus.map((day) => (
                      <div
                        key={day.dateStr}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl py-2 sm:py-2.5 px-0.5 sm:px-1 border transition-all",
                          day.completed
                            ? "border-success/40 bg-success/10 text-success shadow-xs"
                            : day.isToday
                              ? "border-primary/60 bg-primary/10 text-primary ring-2 ring-primary/20"
                              : "border-border/40 bg-muted/10 text-muted-foreground/60",
                        )}
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {day.label}
                        </span>
                        <div
                          className={cn(
                            "flex size-6 sm:size-7 items-center justify-center rounded-full text-[10px] font-black",
                            day.completed
                              ? "bg-success text-success-foreground shadow-xs"
                              : day.isToday
                                ? "bg-primary/20 text-primary"
                                : "bg-background/50 text-muted-foreground/40",
                          )}
                        >
                          {day.completed ? (
                            <Check className="size-3.5 stroke-[3]" aria-hidden />
                          ) : day.isToday ? (
                            <span className="size-2 rounded-full bg-primary animate-pulse" />
                          ) : (
                            <span className="size-1.5 rounded-full bg-muted-foreground/25" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <NextWorkoutCard
              routineDay={nextWorkoutRoutineDay as any}
              routineName={assignedRoutine?.name}
              hasAssignedRoutine={!!assignedRoutine}
              isRoutineCompleted={isRoutineCompleted}
              currentWeek={currentWeek}
              durationWeeks={durationWeeks}
              focus={nextWorkoutRoutineDay?.focus}
              clientRoutineId={clientRoutineId}
              trainDays={trainDays}
            />
          </div>

          <ClientWorkoutChart data={chartData} />

          {userAchievements.length > 0 ? (
            <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-4 pt-6 px-6 sm:px-8">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary shrink-0">
                      <Award className="size-4" aria-hidden />
                    </div>
                    <CardTitle className="text-lg font-black tracking-tight">Hitos Recientes</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-9 px-3 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-primary/5 hover:text-primary transition-all"
                  >
                    <Link
                      href="/client/achievements"
                      className="inline-flex items-center gap-1.5"
                    >
                      Muro de títulos
                      <ChevronRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-8 pb-6">
                <div className="relative -mx-2 px-2 overflow-hidden">
                  <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-card/90 to-transparent z-10 pointer-events-none" />
                  <div className="flex gap-6 overflow-x-auto pb-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {userAchievements.slice(0, 6).map((ua) => (
                      <div
                        key={ua.id}
                        className="group flex min-w-[84px] flex-col items-center gap-3"
                      >
                        <AchievementBadge
                          achievement={ua.achievements!}
                          unlocked
                          size="md"
                          className="transition-transform group-hover:scale-110 duration-300"
                        />
                        <span className="line-clamp-2 w-full text-center text-[10px] font-black uppercase tracking-tight text-foreground/80 group-hover:text-primary transition-colors">
                          {ua.achievements!.name}
                        </span>
                      </div>
                    ))}
                    {userAchievements.length > 6 && (
                      <Link
                        href="/client/achievements"
                        className="group flex min-w-[84px] flex-col items-center justify-center gap-3"
                      >
                        <div className="flex size-14 items-center justify-center rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 transition-all group-hover:border-primary group-hover:bg-primary/10">
                          <span className="text-xs font-black text-primary tabular-nums">
                            +{userAchievements.length - 6}
                          </span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary">
                          Ver más
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </section>
      </div>
    </>
  );
}
