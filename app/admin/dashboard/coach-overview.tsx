import { getAuthData } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { COACH_OVERVIEW_SESSIONS_CAP } from "@/lib/performance-limits";
import { fetchLatestCompletedSessionByClients } from "@/lib/admin-client-rollups";
import { diffWholeDaysFromNow, getNowInTimezone } from "@/lib/calendar-date";
import { CoachOverviewClient } from "./coach-overview-client";

export type CoachOverviewMetrics = {
  totalTrainingsThisWeek: number;
  prsThisMonth: number;
  /** Para tendencia MoM en el KPI (misma lógica que `prsThisMonth`). */
  prsLastMonth: number;
  mostActiveClientId: string | null;
  mostActiveClientName: string | null;
  attentionClientId: string | null;
  attentionClientName: string | null;
  attentionReason: string | null;
  trainingsLastWeek: number;
  totalClients: number;
  attentionCount: number;
  activeThisWeekCount: number;
  chartData: { date: string; sessions: number }[];
};

export type CoachClientCard = {
  id: string;
  userId?: string | null;
  fullName: string;
  avatarUrl?: string | null;
  planName?: string | null;
  assignedRoutineId?: string | null;
  assignedRoutineName?: string | null;
  assignedRoutineDaysPerWeek?: number | null;
  status?: string | null;
  lastSessionAt?: string | null;
  daysSinceLastSession?: number | null;
  streakDays?: number | null;
  trend?: "up" | "down" | "flat";
  compliance7dPct?: number | null;
  /** Sesiones completadas en la ventana de 7 días y meta según rutina (días/semana). */
  complianceSessionsDone7d?: number | null;
  complianceSessionsTarget?: number | null;
  /** Repeticiones máx entre eventos `pr_events` y series marcadas `is_pr` en logs (alineado con lo que ve el cliente). */
  prEvents30d?: number;
  prStalled30d?: boolean;
  needsAttention?: boolean;
  attentionReason?: string | null;
  isRoutineCompleted?: boolean;
  clientRoutineId?: string | null;
  currentWeek?: number | null;
  durationWeeks?: number | null;
  activePainReports?: { bodyPart: string; severity: number }[];
  unreadMessagesCount?: number;
};

type ClientDbRow = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  status: string | null;
  last_session_at: string | null;
  current_plan_id: string | null;
};

type CompletedSessionRow = {
  id: string;
  client_id: string;
  started_at: string | null;
  total_volume_kg: number | null;
  status: string | null;
};

const PR_LOG_IN_CHUNK = 120;

type CoachSupabase = Awaited<ReturnType<typeof createClient>>;

/** Cuenta series marcadas PR en logs (excl. calentamiento), misma fuente que las tarjetas por cliente. */
async function countPrSetsFromExerciseLogs(
  supabase: CoachSupabase,
  sessionIds: string[],
  sessionToClient: Map<string, string>,
  allowedClientIds: Set<string>,
): Promise<number> {
  if (sessionIds.length === 0) return 0;
  const chunks: string[][] = [];
  for (let i = 0; i < sessionIds.length; i += PR_LOG_IN_CHUNK) {
    chunks.push(sessionIds.slice(i, i + PR_LOG_IN_CHUNK));
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("exercise_logs")
        .select("workout_session_id, is_warmup")
        .eq("is_pr", true)
        .in("workout_session_id", chunk),
    ),
  );
  let n = 0;
  for (const { data: prLogRows } of results) {
    for (const row of prLogRows || []) {
      if (row.is_warmup) continue;
      const cid = sessionToClient.get(row.workout_session_id);
      if (!cid || !allowedClientIds.has(cid)) continue;
      n++;
    }
  }
  return n;
}

export async function CoachOverview() {
  const { user, role } = await getAuthData();

  if (!user || role !== "admin") return null;

  const supabase = await createClient();

  // Wave 1: Cargar asesorados, zona horaria del gimnasio y mensajes no leídos en paralelo
  const [
    { data: clientsData, error: clientsError },
    { data: gymSettings },
    unreadMessagesRes,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, user_id, full_name, avatar_url, status, last_session_at, current_plan_id",
      )
      .eq("coach_id", user.id),
    supabase
      .from("gym_settings")
      .select("timezone")
      .eq("admin_id", user.id)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("from_user_id")
      .eq("to_user_id", user.id)
      .eq("is_read", false),
  ]);

  if (clientsError) throw clientsError;
  const clientsList: ClientDbRow[] = clientsData ?? [];
  const clientIds = clientsList.map((c) => c.id).filter(Boolean);

  const timeZone = gymSettings?.timezone || "America/Mexico_City";
  const nowInTz = getNowInTimezone(timeZone);

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

  if (clientsList.length === 0) {
    const emptyChartData: { date: string; sessions: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(nowInTz);
      d.setDate(d.getDate() - i);
      emptyChartData.push({ date: toDateKey(d), sessions: 0 });
    }
    return (
      <CoachOverviewClient
        cards={[]}
        metrics={{
          totalTrainingsThisWeek: 0,
          prsThisMonth: 0,
          prsLastMonth: 0,
          mostActiveClientId: null,
          mostActiveClientName: null,
          attentionClientId: null,
          attentionClientName: null,
          attentionReason: null,
          trainingsLastWeek: 0,
          totalClients: 0,
          attentionCount: 0,
          activeThisWeekCount: 0,
          chartData: emptyChartData,
        }}
        planNames={[]}
        routineNames={[]}
      />
    );
  }

  const planIds = [
    ...new Set(clientsList.map((c) => c.current_plan_id).filter(Boolean)),
  ] as string[];
  const userIds = clientsList
    .map((c) => c.user_id)
    .filter((id): id is string => Boolean(id));

  const startOfWeek = new Date(nowInTz);
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(nowInTz);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 13);
  startOfLastWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(nowInTz);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startOfLast30Days = new Date(nowInTz);
  startOfLast30Days.setDate(startOfLast30Days.getDate() - 29);
  startOfLast30Days.setHours(0, 0, 0, 0);

  const startOfPrevMonth = new Date(startOfMonth);
  startOfPrevMonth.setMonth(startOfPrevMonth.getMonth() - 1);

  const earliestPrBound =
    startOfPrevMonth.getTime() < startOfLast30Days.getTime()
      ? startOfPrevMonth
      : startOfLast30Days;

  const adminClient = createAdminClient();

  // Wave 2: Cargar en paralelo sesiones recientes, planes, rutinas activas, perfiles, reportes de dolor, sesiones completadas y PR events
  const [
    latestCompletedByClient,
    plansRes,
    crRes,
    profilesRes,
    painReportsRes,
    completedSessionsRes,
    allPrEventsRes,
  ] = await Promise.all([
    fetchLatestCompletedSessionByClients(supabase, clientIds),
    planIds.length > 0
      ? supabase.from("membership_plans").select("id, name").in("id", planIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase
      .from("client_routines")
      .select(
        "id, client_id, routine_id, current_week, routines(id, name, days_per_week, duration_weeks)",
      )
      .in("client_id", clientIds)
      .eq("is_active", true),
    userIds.length > 0
      ? adminClient
          .from("profiles")
          .select("id, streak_days, last_workout_at")
          .in("id", userIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            streak_days: number | null;
            last_workout_at: string | null;
          }[],
        }),
    supabase
      .from("client_pain_reports")
      .select("client_id, body_part, severity")
      .in("client_id", clientIds)
      .eq("active", true),
    supabase
      .from("workout_sessions")
      .select("id, client_id, started_at, total_volume_kg, status")
      .in("client_id", clientIds)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(COACH_OVERVIEW_SESSIONS_CAP),
    supabase
      .from("pr_events")
      .select("id, client_id, achieved_at")
      .in("client_id", clientIds)
      .gte("achieved_at", earliestPrBound.toISOString()),
  ]);

  const plansById = new Map<string, string>();
  for (const p of plansRes.data || []) plansById.set(p.id, p.name);

  const routineByClient = new Map<
    string,
    { id: string; routine_id: string; current_week: number }
  >();
  const routinesById = new Map<
    string,
    { name: string; daysPerWeek: number | null; durationWeeks: number | null }
  >();

  for (const cr of crRes.data || []) {
    routineByClient.set(cr.client_id, {
      id: cr.id,
      routine_id: cr.routine_id,
      current_week: cr.current_week ?? 1,
    });
    const rel = (
      cr as {
        routines?:
          | {
              id: string;
              name: string;
              days_per_week: number | null;
              duration_weeks: number | null;
            }
          | {
              id: string;
              name: string;
              days_per_week: number | null;
              duration_weeks: number | null;
            }[]
          | null;
      }
    ).routines;
    const r = Array.isArray(rel) ? rel[0] : rel;
    if (r?.id) {
      routinesById.set(r.id, {
        name: r.name,
        daysPerWeek: r.days_per_week ?? null,
        durationWeeks: r.duration_weeks ?? null,
      });
    }
  }

  const clientsSummary = clientsList.map((c) => ({
    id: c.id,
    user_id: c.user_id,
    full_name: c.full_name,
    avatar_url: c.avatar_url,
    status: c.status,
    last_session_at: c.last_session_at,
    plan_name: c.current_plan_id
      ? (plansById.get(c.current_plan_id) ?? null)
      : null,
    assigned_routine_id: routineByClient.get(c.id)?.routine_id ?? null,
    client_routine_id: routineByClient.get(c.id)?.id ?? null,
    current_week: routineByClient.get(c.id)?.current_week ?? 1,
  }));

  const profilesByUserId = new Map<
    string,
    { streak_days?: number | null; last_workout_at?: string | null }
  >();
  for (const p of profilesRes.data || []) {
    profilesByUserId.set(p.id, {
      streak_days: p.streak_days,
      last_workout_at: p.last_workout_at,
    });
  }

  const painReportsByClient = new Map<
    string,
    { bodyPart: string; severity: number }[]
  >();
  for (const pr of painReportsRes.data || []) {
    if (!pr.client_id) continue;
    const list = painReportsByClient.get(pr.client_id) || [];
    list.push({
      bodyPart: pr.body_part,
      severity: Number(pr.severity) || 0,
    });
    painReportsByClient.set(pr.client_id, list);
  }
  for (const [cid, list] of painReportsByClient.entries()) {
    painReportsByClient.set(
      cid,
      list.sort((a, b) => b.severity - a.severity),
    );
  }

  const unreadMessagesByUserId = new Map<string, number>();
  for (const msg of unreadMessagesRes.data || []) {
    if (!msg.from_user_id) continue;
    unreadMessagesByUserId.set(
      msg.from_user_id,
      (unreadMessagesByUserId.get(msg.from_user_id) || 0) + 1,
    );
  }

  const sessionsList: CompletedSessionRow[] = completedSessionsRes.data ?? [];

  const sessionsByClientId = new Map<
    string,
    { started_at?: string; total_volume_kg?: number | null }[]
  >();
  for (const s of sessionsList) {
    const arr = sessionsByClientId.get(s.client_id) || [];
    arr.push({
      started_at: s.started_at ?? undefined,
      total_volume_kg: s.total_volume_kg,
    });
    sessionsByClientId.set(s.client_id, arr);
  }

  const clientIdSet = new Set(clientIds);
  const sessionToClient = new Map(sessionsList.map((s) => [s.id, s.client_id]));

  const monthStartMs = startOfMonth.getTime();
  const prevMonthStartMs = startOfPrevMonth.getTime();
  const last30StartMs = startOfLast30Days.getTime();
  const nowMs = nowInTz.getTime();

  let prEventsThisMonthCount = 0;
  let prEventsPrevMonthCount = 0;
  const prCount30ByClient = new Map<string, number>();

  for (const row of allPrEventsRes.data || []) {
    const t = row.achieved_at ? new Date(row.achieved_at).getTime() : NaN;
    if (Number.isNaN(t)) continue;
    if (t >= monthStartMs) {
      prEventsThisMonthCount++;
    } else if (t >= prevMonthStartMs && t < monthStartMs) {
      prEventsPrevMonthCount++;
    }
    if (t >= last30StartMs) {
      prCount30ByClient.set(
        row.client_id,
        (prCount30ByClient.get(row.client_id) || 0) + 1,
      );
    }
  }

  const sessionIdsThisMonth = [
    ...new Set(
      sessionsList
        .filter((s) => {
          if (!s.started_at || !clientIdSet.has(s.client_id)) return false;
          const t = new Date(s.started_at).getTime();
          return !Number.isNaN(t) && t >= monthStartMs && t <= nowMs;
        })
        .map((s) => s.id),
    ),
  ];

  const sessionIdsPrevMonth = [
    ...new Set(
      sessionsList
        .filter((s) => {
          if (!s.started_at || !clientIdSet.has(s.client_id)) return false;
          const t = new Date(s.started_at).getTime();
          return !Number.isNaN(t) && t >= prevMonthStartMs && t < monthStartMs;
        })
        .map((s) => s.id),
    ),
  ];

  const sessionIdsForPrLogs = [
    ...new Set(
      sessionsList
        .filter((s) => {
          if (!s.started_at || !clientIdSet.has(s.client_id)) return false;
          return new Date(s.started_at).getTime() >= last30StartMs;
        })
        .map((s) => s.id),
    ),
  ];

  const prLogCount30ByClient = new Map<string, number>();
  const last30Chunks: string[][] = [];
  for (let i = 0; i < sessionIdsForPrLogs.length; i += PR_LOG_IN_CHUNK) {
    last30Chunks.push(sessionIdsForPrLogs.slice(i, i + PR_LOG_IN_CHUNK));
  }

  // Wave 3: Contar series PR en paralelo
  const [prLogsThisMonth, prLogsPrevMonth, ...last30ChunkResults] =
    await Promise.all([
      countPrSetsFromExerciseLogs(
        supabase,
        sessionIdsThisMonth,
        sessionToClient,
        clientIdSet,
      ),
      countPrSetsFromExerciseLogs(
        supabase,
        sessionIdsPrevMonth,
        sessionToClient,
        clientIdSet,
      ),
      ...last30Chunks.map((chunk) =>
        supabase
          .from("exercise_logs")
          .select("workout_session_id, is_warmup")
          .eq("is_pr", true)
          .in("workout_session_id", chunk),
      ),
    ]);

  for (const { data: prLogRows } of last30ChunkResults) {
    for (const row of prLogRows || []) {
      if (row.is_warmup) continue;
      const cid = sessionToClient.get(row.workout_session_id);
      if (!cid || !clientIdSet.has(cid)) continue;
      prLogCount30ByClient.set(cid, (prLogCount30ByClient.get(cid) || 0) + 1);
    }
  }

  const prsThisMonth = Math.max(prEventsThisMonthCount, prLogsThisMonth);
  const prsLastMonth = Math.max(prEventsPrevMonthCount, prLogsPrevMonth);

  const totalTrainingsThisWeek = sessionsList.filter((s) => {
    if (!s.started_at) return false;
    const d = new Date(s.started_at);
    return !Number.isNaN(d.getTime()) && d >= startOfWeek;
  }).length;

  const trainingsLastWeek = sessionsList.filter((s) => {
    if (!s.started_at) return false;
    const d = new Date(s.started_at);
    return (
      !Number.isNaN(d.getTime()) && d >= startOfLastWeek && d < startOfWeek
    );
  }).length;

  // Chart data: sessions per day for last 90 days in gym timezone
  const chartDataMap = new Map<string, number>();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(nowInTz);
    d.setDate(d.getDate() - i);
    chartDataMap.set(toDateKey(d), 0);
  }
  for (const s of sessionsList) {
    if (!s.started_at) continue;
    const dateStr = formatDateInTimezone(new Date(s.started_at), timeZone);
    if (chartDataMap.has(dateStr)) {
      chartDataMap.set(dateStr, (chartDataMap.get(dateStr) || 0) + 1);
    }
  }
  const chartData = Array.from(chartDataMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sessions]) => ({ date, sessions }));

  // Most active client in last 30 days
  const last30 = sessionsList.filter((s) => {
    if (!s.started_at) return false;
    const d = new Date(s.started_at);
    return !Number.isNaN(d.getTime()) && d >= startOfLast30Days;
  });
  const countByClient = new Map<string, number>();
  for (const s of last30)
    countByClient.set(s.client_id, (countByClient.get(s.client_id) || 0) + 1);

  let mostActiveClientId: string | null = null;
  let mostActiveClientName: string | null = null;
  for (const [id, count] of countByClient.entries()) {
    if (
      !mostActiveClientId ||
      count > (countByClient.get(mostActiveClientId) || 0)
    ) {
      const found = clientsSummary.find((c) => c.id === id);
      mostActiveClientId = id;
      mostActiveClientName = found?.full_name ?? null;
    }
  }

  const cards: CoachClientCard[] = clientsSummary.map((c) => {
    const streak = c.user_id ? profilesByUserId.get(c.user_id) : undefined;
    const last = (sessionsByClientId.get(c.id) || [])[0];
    const prev = (sessionsByClientId.get(c.id) || [])[1];

    const lastSessionAt =
      latestCompletedByClient.get(c.id) ??
      last?.started_at ??
      c.last_session_at ??
      null;
    const daysSinceLastSession = diffWholeDaysFromNow(lastSessionAt, nowInTz);

    const lastVol =
      typeof last?.total_volume_kg === "number" ? last.total_volume_kg : null;
    const prevVol =
      typeof prev?.total_volume_kg === "number" ? prev.total_volume_kg : null;

    let trend: "up" | "down" | "flat" = "flat";
    if (lastVol !== null && prevVol !== null) {
      if (lastVol > prevVol) trend = "up";
      else if (lastVol < prevVol) trend = "down";
    }

    const isPending = c.status === "pending";
    const isPendingPayment = c.status === "pending_payment";
    const isExpired = c.status === "expired";
    const isSuspended = c.status === "suspended";
    const isActive = c.status === "active";

    const routineMeta = c.assigned_routine_id
      ? routinesById.get(c.assigned_routine_id)
      : undefined;
    const isRoutineCompleted = !!(
      routineMeta?.durationWeeks && c.current_week > routineMeta.durationWeeks
    );

    const expectedPerWeek = routineMeta?.daysPerWeek ?? null;
    const doneLast7 = sessionsList.filter((s) => {
      if (s.client_id !== c.id) return false;
      if (!s.started_at) return false;
      const d = new Date(s.started_at);
      return !Number.isNaN(d.getTime()) && d >= startOfWeek;
    }).length;
    const compliance7dPct =
      expectedPerWeek && expectedPerWeek > 0
        ? Math.min(doneLast7 / expectedPerWeek, 1)
        : null;
    const complianceSessionsDone7d =
      expectedPerWeek && expectedPerWeek > 0 ? doneLast7 : null;
    const complianceSessionsTarget =
      expectedPerWeek && expectedPerWeek > 0 ? expectedPerWeek : null;

    const fromEvents = prCount30ByClient.get(c.id) || 0;
    const fromLogs = prLogCount30ByClient.get(c.id) || 0;
    const prEvents30d = Math.max(fromEvents, fromLogs);
    const prStalled30d = prEvents30d === 0;

    const activePainReports = painReportsByClient.get(c.id) || [];
    const unreadMessagesCount = c.user_id
      ? (unreadMessagesByUserId.get(c.user_id) || 0)
      : 0;

    let attentionReason: string | null = null;
    if (activePainReports.length > 0)
      attentionReason = `Dolor activo: ${activePainReports[0].bodyPart}`;
    else if (isPendingPayment) attentionReason = "Pago por confirmar";
    else if (isRoutineCompleted) attentionReason = "Rutina completada";
    else if (isPending) attentionReason = "Falta registro";
    else if (isExpired) attentionReason = "Plan vencido";
    else if (isSuspended) attentionReason = "Suspendido";
    else if (isActive) {
      if (!c.assigned_routine_id) attentionReason = "Sin rutina asignada";
      else if (daysSinceLastSession === null)
        attentionReason = "No ha entrenado nunca";
      else if (daysSinceLastSession >= 7)
        attentionReason = `Inactivo hace ${daysSinceLastSession}d`;
      else if (compliance7dPct != null && compliance7dPct < 0.5)
        attentionReason = "Bajo cumplimiento 7d";
    }

    const needsAttention = attentionReason !== null;

    return {
      id: c.id,
      userId: c.user_id ?? null,
      fullName: c.full_name ?? "Cliente",
      avatarUrl: c.avatar_url,
      planName: c.plan_name ?? null,
      assignedRoutineId: c.assigned_routine_id ?? null,
      assignedRoutineName: c.assigned_routine_id
        ? routinesById.get(c.assigned_routine_id)?.name || null
        : null,
      assignedRoutineDaysPerWeek: c.assigned_routine_id
        ? (routinesById.get(c.assigned_routine_id)?.daysPerWeek ?? null)
        : null,
      status: c.status ?? null,
      lastSessionAt,
      daysSinceLastSession,
      streakDays: streak?.streak_days ?? null,
      trend,
      compliance7dPct,
      complianceSessionsDone7d,
      complianceSessionsTarget,
      prEvents30d,
      prStalled30d,
      needsAttention,
      attentionReason,
      isRoutineCompleted,
      clientRoutineId: (c as any).client_routine_id,
      currentWeek: c.current_week,
      durationWeeks: routineMeta?.durationWeeks ?? null,
      activePainReports,
      unreadMessagesCount,
    };
  });

  // Re-evaluar los candidatos de atención basados en la nueva lógica de negocio
  const attentionCandidates = cards.filter((c) => c.needsAttention);
  let attentionClientId: string | null = null;
  let attentionClientName: string | null = null;

  if (attentionCandidates.length > 0) {
    // Prioridad de atención:
    // Máxima: Dolor activo (6), luego Rutina completada (5), Plan vencido (4), Sin rutina (3), Inactivo +7d (2), Falta registro (1)
    const sorted = [...attentionCandidates].sort((a, b) => {
      const getScore = (c: CoachClientCard) => {
        if (c.activePainReports && c.activePainReports.length > 0) return 7;
        if (c.status === "pending_payment") return 6;
        if (c.attentionReason === "Rutina completada") return 5;
        if (c.status === "expired") return 4;
        if (c.status === "active" && !c.assignedRoutineId) return 3;
        if (
          c.status === "active" &&
          c.daysSinceLastSession != null &&
          c.daysSinceLastSession >= 7
        )
          return 2;
        if (c.status === "pending") return 1;
        return 0;
      };
      return getScore(b) - getScore(a);
    });
    attentionClientId = sorted[0]?.id ?? null;
    attentionClientName = sorted[0]?.fullName ?? null;
  }

  const activeThisWeekCount = cards.filter(
    (c) =>
      c.status === "active" &&
      c.daysSinceLastSession != null &&
      c.daysSinceLastSession <= 6,
  ).length;

  const metrics: CoachOverviewMetrics = {
    totalTrainingsThisWeek,
    prsThisMonth,
    prsLastMonth,
    mostActiveClientId,
    mostActiveClientName,
    attentionClientId,
    attentionClientName,
    attentionReason:
      attentionCandidates.length > 0
        ? (cards.find((c) => c.id === attentionClientId)?.attentionReason ??
          null)
        : null,
    trainingsLastWeek,
    totalClients: cards.length,
    attentionCount: attentionCandidates.length,
    activeThisWeekCount,
    chartData,
  };

  return (
    <CoachOverviewClient
      cards={cards}
      metrics={metrics}
      planNames={
        Array.from(
          new Set(cards.map((c) => c.planName).filter(Boolean)),
        ) as string[]
      }
      routineNames={
        Array.from(
          new Set(cards.map((c) => c.assignedRoutineName).filter(Boolean)),
        ) as string[]
      }
    />
  );
}
