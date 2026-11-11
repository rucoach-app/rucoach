import { getAuthData, getCurrentClientRecord } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculateLevel, type RoutineDay } from "@/lib/types";
import { CLIENT_DASHBOARD_SESSIONS_CAP } from "@/lib/performance-limits";
import { getNextRoutineDay } from "@/lib/next-routine-day";
import { getNowInTimezone, getStartOfMonthInTimezone } from "@/lib/calendar-date";
import { ClientDashboardContent } from "./client-dashboard-content";

export default async function ClientDashboard() {
  const { user, profile } = await getAuthData();

  if (!user) {
    redirect("/auth/login");
  }

  const [supabase, client] = await Promise.all([
    createClient(),
    getCurrentClientRecord(user.id),
  ]);

  let workoutSessions:
    | {
        id?: string;
        total_volume_kg?: number | null;
        status?: string;
        started_at?: string;
        routine_day_id?: string | null;
      }[]
    | null = null;
  let prsThisMonth = 0;
  let routineId =
    (client as { assigned_routine_id?: string } | null)?.assigned_routine_id ??
    null;
  let latestCompletedRoutineDayId: string | null = null;
  let clientCurrentWeek = 1;
  let activeClientRoutineId: string | null = null;
  let overrideNextDayId: string | null = null;
  let timeZone = "America/Mexico_City";

  // Pre-calculate start of current month (default timezone Mexico City; adjusted if gym settings differ)
  let nowInTz = getNowInTimezone(timeZone);
  let startOfMonth = getStartOfMonthInTimezone(new Date(), timeZone);

  // Single Parallel Wave: fetch achievements, settings, sessions, active routine with full graph, and PR count
  const [
    userAchievementsRes,
    gymSettingsRes,
    sessionsRes,
    crRes,
    prsRes,
  ] = await Promise.all([
    supabase
      .from("user_achievements")
      .select("*, achievements(*)")
      .eq("user_id", user.id),
    client?.coach_id
      ? supabase
          .from("gym_settings")
          .select("timezone")
          .eq("admin_id", client.coach_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client?.id
      ? supabase
          .from("workout_sessions")
          .select("*")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(CLIENT_DASHBOARD_SESSIONS_CAP)
      : Promise.resolve({ data: null }),
    client?.id
      ? supabase
          .from("client_routines")
          .select(`
            id,
            routine_id,
            current_week,
            override_next_day_id,
            routines (
              *,
              routine_days (
                *,
                routine_exercises (
                  *,
                  exercises (*)
                )
              )
            )
          `)
          .eq("client_id", client.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client?.id
      ? supabase
          .from("pr_events")
          .select("*", { count: "exact", head: true })
          .eq("client_id", client.id)
          .gte("achieved_at", startOfMonth.toISOString())
      : Promise.resolve({ count: 0 }),
  ]);

  const userAchievements = userAchievementsRes.data || [];
  if (gymSettingsRes.data?.timezone && gymSettingsRes.data.timezone !== timeZone) {
    timeZone = gymSettingsRes.data.timezone;
    nowInTz = getNowInTimezone(timeZone);
    startOfMonth = getStartOfMonthInTimezone(new Date(), timeZone);
  }

  let assignedRoutine: any = null;
  let isRoutineCompleted = false;

  if (client?.id) {
    workoutSessions = sessionsRes.data;
    // Derive latest completed routine_day_id directly in memory without a duplicate network query
    const latestCompleted = (workoutSessions || []).find(
      (s: any) => s.status === "completed" && s.routine_day_id,
    );
    latestCompletedRoutineDayId = latestCompleted?.routine_day_id ?? null;

    clientCurrentWeek = crRes.data?.current_week ?? 1;
    activeClientRoutineId = crRes.data?.id ?? null;
    overrideNextDayId =
      (crRes.data as { override_next_day_id?: string | null } | null)
        ?.override_next_day_id ?? null;

    if (crRes.data?.routines) {
      assignedRoutine = Array.isArray(crRes.data.routines)
        ? crRes.data.routines[0]
        : crRes.data.routines;
      routineId = assignedRoutine?.id ?? crRes.data.routine_id;
    }
  }

  // Completed sessions only (for volume, chart and count)
  const completedSessions = (workoutSessions || []).filter(
    (s: any) => s.status === "completed" && s.started_at,
  );

  const monthStartMs = startOfMonth.getTime();
  const sessionIdsThisMonth = completedSessions
    .filter((s) => {
      if (!s.started_at || !s.id) return false;
      const t = new Date(s.started_at).getTime();
      return !Number.isNaN(t) && t >= monthStartMs;
    })
    .map((s) => s.id as string);

  // If assignedRoutine was not in client_routines (edge case), fetch routine by assigned_routine_id
  if (!assignedRoutine && routineId) {
    const { data: routineFallback } = await supabase
      .from("routines")
      .select(`
        *,
        routine_days (
          *,
          routine_exercises (
            *,
            exercises (*)
          )
        )
      `)
      .eq("id", routineId)
      .single();
    assignedRoutine = routineFallback;
  }

  if (assignedRoutine && assignedRoutine.duration_weeks) {
    isRoutineCompleted = clientCurrentWeek > assignedRoutine.duration_weeks;
  }

  // Calculate PRs count: use pr_events count; fallback to exercise_logs if 0 and sessions exist
  prsThisMonth = prsRes.count ?? 0;
  if (prsThisMonth === 0 && sessionIdsThisMonth.length > 0) {
    const { data: prLogRows } = await supabase
      .from("exercise_logs")
      .select("workout_session_id, is_warmup")
      .eq("is_pr", true)
      .in("workout_session_id", sessionIdsThisMonth);
    const prLogsCount = (prLogRows || []).filter((r) => !r.is_warmup).length;
    prsThisMonth = Math.max(prsThisMonth, prLogsCount);
  }

  // Calculate level info
  const levelInfo = calculateLevel(profile?.xp_points || 0);

  // Calculate total volume from completed sessions
  const totalVolume = completedSessions.reduce(
    (sum, s) => sum + (s.total_volume_kg || 0),
    0,
  );

  const formatDateInTimezone = (date: Date, tz: string): string => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  };

  const toDateKey = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const totalWorkoutsCompleted = completedSessions.length;
  const chartDataMap = new Map<string, number>();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(nowInTz);
    d.setDate(d.getDate() - i);
    chartDataMap.set(toDateKey(d), 0);
  }
  for (const s of completedSessions) {
    const dateStr = formatDateInTimezone(new Date(s.started_at!), timeZone);
    if (chartDataMap.has(dateStr)) {
      chartDataMap.set(dateStr, (chartDataMap.get(dateStr) || 0) + 1);
    }
  }
  const chartData = Array.from(chartDataMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sessions]) => ({ date, sessions }));

  const lastCompletedWithDayId =
    latestCompletedRoutineDayId ??
    (workoutSessions || []).find(
      (s) => s.status === "completed" && s.routine_day_id,
    )?.routine_day_id ??
    null;
  const routineDaysList = (assignedRoutine?.routine_days ?? []) as RoutineDay[];
  const overriddenDay = overrideNextDayId
    ? routineDaysList.find(
        (d) =>
          d.id === overrideNextDayId &&
          !d.is_rest_day &&
          Array.isArray(d.routine_exercises) &&
          d.routine_exercises.length > 0,
      ) ?? null
    : null;
  const nextWorkoutRoutineDay =
    overriddenDay ??
    getNextRoutineDay(routineDaysList, lastCompletedWithDayId);

  if (nextWorkoutRoutineDay?.routine_exercises?.length) {
    nextWorkoutRoutineDay.routine_exercises = [
      ...nextWorkoutRoutineDay.routine_exercises,
    ].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }

  if (
    activeClientRoutineId &&
    nextWorkoutRoutineDay?.routine_exercises?.length
  ) {
    const { applyExerciseOverrides } = await import(
      "@/app/actions/routine-overrides"
    );
    nextWorkoutRoutineDay.routine_exercises = await applyExerciseOverrides(
      activeClientRoutineId,
      nextWorkoutRoutineDay.routine_exercises,
      supabase,
    );
  }

  // Weekly progress (Monday to Sunday in gym timezone)
  const todayStr = toDateKey(nowInTz);
  const currentDayOfWeek = nowInTz.getDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const mondayOfThisWeek = new Date(nowInTz);
  mondayOfThisWeek.setDate(nowInTz.getDate() + diffToMonday);
  mondayOfThisWeek.setHours(0, 0, 0, 0);

  const trainedDatesSet = new Set<string>(
    completedSessions.map((s) =>
      formatDateInTimezone(new Date(s.started_at!), timeZone),
    ),
  );

  const weekDayLabels = ["L", "M", "X", "J", "V", "S", "D"];
  const weekDaysStatus = weekDayLabels.map((label, idx) => {
    const d = new Date(mondayOfThisWeek);
    d.setDate(mondayOfThisWeek.getDate() + idx);
    const dateStr = toDateKey(d);
    return {
      label,
      dateStr,
      completed: trainedDatesSet.has(dateStr),
      isToday: dateStr === todayStr,
    };
  });

  const currentWeekDatesSet = new Set(weekDaysStatus.map((d) => d.dateStr));
  const workoutsThisWeek = completedSessions.filter((s) =>
    currentWeekDatesSet.has(
      formatDateInTimezone(new Date(s.started_at!), timeZone),
    ),
  ).length;

  const weeklyTarget =
    assignedRoutine?.days_per_week ||
    routineDaysList.filter((d) => !d.is_rest_day).length ||
    4;

  return (
    <ClientDashboardContent
      profile={profile}
      levelInfo={levelInfo}
      totalWorkouts={totalWorkoutsCompleted}
      totalVolume={totalVolume}
      prsThisMonth={prsThisMonth || 0}
      assignedRoutine={assignedRoutine}
      clientRoutineId={activeClientRoutineId}
      nextWorkoutRoutineDay={nextWorkoutRoutineDay}
      isRoutineCompleted={isRoutineCompleted}
      userAchievements={userAchievements || []}
      chartData={chartData}
      membershipEnd={client?.membership_end ?? null}
      currentWeek={clientCurrentWeek}
      durationWeeks={assignedRoutine?.duration_weeks ?? null}
      workoutsThisWeek={workoutsThisWeek}
      weeklyTarget={weeklyTarget}
      weekDaysStatus={weekDaysStatus}
    />
  );
}
