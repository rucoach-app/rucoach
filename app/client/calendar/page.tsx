import { getAuthUser, getCurrentClientRecord } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  WorkoutCalendar,
  type MonthWorkoutStats,
} from "@/components/calendar/workout-calendar";
import {
  CLIENT_DATA_PAGE_SHELL,
  ClientStackPageHeader,
} from "@/components/client/client-app-page-parts";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";
import { getNowInTimezone } from "@/lib/calendar-date";

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function formatDateInTimezone(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

function clampMonthYear(y: number, m1: number) {
  const now = getNowInTimezone();
  const year =
    Number.isFinite(y) && y >= 2020 && y <= 2100 ? y : now.getFullYear();
  let monthIndex = m1 - 1; // URL uses 1–12
  if (!Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    monthIndex = now.getMonth();
  }
  return { year, monthIndex };
}

function addMonths(year: number, monthIndex: number, delta: number) {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

type Search = { y?: string; m?: string };

export default async function ClientCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const [sp, supabase, clientRecord] = await Promise.all([
    searchParams,
    createClient(),
    getCurrentClientRecord(user.id),
  ]);

  if (!clientRecord) redirect("/client/dashboard");

  const now = getNowInTimezone();
  const hasExplicitMonth = sp.y != null || sp.m != null;
  const parsedY = sp.y != null ? Number(sp.y) : now.getFullYear();
  const parsedM = sp.m != null ? Number(sp.m) : now.getMonth() + 1;
  let { year, monthIndex } = clampMonthYear(parsedY, parsedM);

  // Widen UTC bounds by 1 day on each side so sessions near midnight in gym timezone are included
  let start = new Date(Date.UTC(year, monthIndex, 0, 0, 0, 0));
  let end = new Date(Date.UTC(year, monthIndex + 1, 2, 23, 59, 59));

  const [gymSettingsRes, sessionsRes] = await Promise.all([
    clientRecord.coach_id
      ? supabase
          .from("gym_settings")
          .select("timezone")
          .eq("admin_id", clientRecord.coach_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("workout_sessions")
      .select("id, started_at, total_volume_kg, status")
      .eq("client_id", clientRecord.id)
      .eq("status", "completed")
      .gte("started_at", start.toISOString())
      .lte("started_at", end.toISOString())
      .order("started_at", { ascending: true }),
  ]);

  const timeZone = gymSettingsRes.data?.timezone || "America/Mexico_City";
  let sessions = sessionsRes.data;

  if (!hasExplicitMonth && (!sessions || sessions.length === 0)) {
    const { data: latestSession } = await supabase
      .from("workout_sessions")
      .select("started_at")
      .eq("client_id", clientRecord.id)
      .eq("status", "completed")
      .not("started_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSession?.started_at) {
      const latestKey = formatDateInTimezone(
        new Date(latestSession.started_at),
        timeZone,
      );
      const [ly, lm] = latestKey.split("-").map(Number);
      if (Number.isFinite(ly) && Number.isFinite(lm)) {
        const clamped = clampMonthYear(ly, lm);
        year = clamped.year;
        monthIndex = clamped.monthIndex;
        start = new Date(Date.UTC(year, monthIndex, 0, 0, 0, 0));
        end = new Date(Date.UTC(year, monthIndex + 1, 2, 23, 59, 59));
        const retry = await supabase
          .from("workout_sessions")
          .select("id, started_at, total_volume_kg, status")
          .eq("client_id", clientRecord.id)
          .eq("status", "completed")
          .gte("started_at", start.toISOString())
          .lte("started_at", end.toISOString())
          .order("started_at", { ascending: true });
        sessions = retry.data;
      }
    }
  }

  const monthPrefix = `${year}-${pad2(monthIndex + 1)}-`;

  const sessionsByDate: Record<
    string,
    { count: number; totalVolumeKg: number; lastSessionAt?: string | null }
  > = {};

  const dayKeys = new Set<string>();
  let totalVolMonth = 0;
  let completedThisMonth = 0;

  for (const s of sessions || []) {
    if (!s.started_at) continue;
    const key = formatDateInTimezone(new Date(s.started_at), timeZone);
    if (!key.startsWith(monthPrefix)) continue;

    completedThisMonth += 1;
    dayKeys.add(key);
    if (!sessionsByDate[key]) {
      sessionsByDate[key] = { count: 0, totalVolumeKg: 0, lastSessionAt: null };
    }
    sessionsByDate[key].count += 1;
    if (
      typeof s.total_volume_kg === "number" &&
      Number.isFinite(s.total_volume_kg)
    ) {
      sessionsByDate[key].totalVolumeKg += s.total_volume_kg;
      totalVolMonth += s.total_volume_kg;
    }
    sessionsByDate[key].lastSessionAt = s.started_at;
  }

  const monthCaption = new Date(year, monthIndex, 1).toLocaleDateString("es", {
    month: "long",
    year: "numeric",
  });
  let maxDayVolumeKg = 0;
  for (const v of Object.values(sessionsByDate)) {
    if (v.totalVolumeKg > maxDayVolumeKg) maxDayVolumeKg = v.totalVolumeKg;
  }

  const monthStats: MonthWorkoutStats = {
    totalVolumeKg: totalVolMonth,
    sessionCount: completedThisMonth,
    uniqueDays: dayKeys.size,
    avgVolumePerSession:
      completedThisMonth > 0 ? totalVolMonth / completedThisMonth : 0,
    maxDayVolumeKg,
  };

  const prev = addMonths(year, monthIndex, -1);
  const next = addMonths(year, monthIndex, 1);
  const prevMonthHref = `/client/calendar?y=${prev.year}&m=${prev.monthIndex + 1}`;
  const nextMonthHref = `/client/calendar?y=${next.year}&m=${next.monthIndex + 1}`;

  const calendarSubtitle =
    completedThisMonth === 0
      ? `Sin sesiones completadas en ${monthCaption}`
      : `${completedThisMonth} ${completedThisMonth === 1 ? "sesión" : "sesiones"} completadas en ${monthCaption}`;

  return (
    <>
      <ClientStackPageHeader title="Calendario" subtitle={calendarSubtitle} />
      <div className={`${CLIENT_DATA_PAGE_SHELL} flex flex-col gap-6`}>
        <WorkoutCalendar
          year={year}
          monthIndex={monthIndex}
          sessionsByDate={sessionsByDate}
          monthStats={monthStats}
          prevMonthHref={prevMonthHref}
          nextMonthHref={nextMonthHref}
        />

        {completedThisMonth === 0 && (
          <Empty className="rounded-3xl border-border/80 shadow-sm ring-1 ring-primary/5 py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarDays />
              </EmptyMedia>
              <EmptyTitle>Sin sesiones registradas en {monthCaption}</EmptyTitle>
              <EmptyDescription>
                Usa las flechas del calendario para consultar otros meses o completa un entreno desde{" "}
                <span className="font-medium">Mis rutinas</span>.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild size="sm">
                <Link href="/client/routines">Ir a mis rutinas</Link>
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </div>
    </>
  );
}
