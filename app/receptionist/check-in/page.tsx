import { getAuthData } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Search,
  Clock,
  Activity,
} from "lucide-react";
import { getNowInTimezone, getStartOfDayInTimezone } from "@/lib/calendar-date";

export default async function ReceptionistCheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user, role } = await getAuthData();

  if (!user || (role !== "receptionist" && role !== "admin")) {
    redirect("/auth/login");
  }

  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();

  const supabase = await createClient();
  const now = getNowInTimezone();
  const startOfToday = getStartOfDayInTimezone().toISOString();

  const [clientsRes, todaySessionsRes] = await Promise.all([
    supabase
      .from("clients")
      .select(
        `
        id,
        full_name,
        email,
        phone,
        status,
        membership_end,
        membership_plans (
          name
        )
      `,
      )
      .order("full_name", { ascending: true }),
    supabase
      .from("workout_sessions")
      .select(
        `
        id,
        client_id,
        started_at,
        finished_at,
        clients (
          full_name
        )
      `,
      )
      .gte("started_at", startOfToday)
      .order("started_at", { ascending: false }),
  ]);

  const allClients = clientsRes.data ?? [];
  const todaySessions = todaySessionsRes.data ?? [];
  const checkedInClientIds = new Set(todaySessions.map((s) => s.client_id));

  const filteredClients = query
    ? allClients.filter(
        (c) =>
          c.full_name?.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.phone?.toLowerCase().includes(query),
      )
    : allClients.slice(0, 18);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Control de Acceso
          </h1>
          <p className="text-sm text-muted-foreground">
            Verifica vigencia de membresías y entrenamientos del día
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5 w-fit">
          <Activity className="size-3.5 text-primary" />
          {todaySessions.length} sesiones hoy
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Search className="size-4 text-primary" />
            Verificar Membresía de Atleta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form method="GET" className="flex flex-col sm:flex-row gap-3">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Ingresa nombre, correo o teléfono para validar acceso..."
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button type="submit">Verificar</Button>
              {q && (
                <Button variant="outline" asChild>
                  <Link href="/receptionist/check-in">Limpiar</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {todaySessions.length > 0 && !q && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Actividad de Hoy ({todaySessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {todaySessions.map((session) => {
                const clientObj = Array.isArray(session.clients)
                  ? session.clients[0]
                  : session.clients;
                return (
                  <Badge
                    key={session.id}
                    variant="outline"
                    className="px-3 py-1.5 text-xs bg-background border-border/60 gap-2"
                  >
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold">
                      {clientObj?.full_name ?? "Atleta"}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(session.started_at).toLocaleTimeString(
                        "es-MX",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Mexico_City",
                        },
                      )}
                    </span>
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredClients.map((client) => {
          const planObj = Array.isArray(client.membership_plans)
            ? client.membership_plans[0]
            : client.membership_plans;
          const isExpiredDate =
            client.membership_end &&
            new Date(`${client.membership_end.slice(0, 10)}T23:59:59`) < now;
          const canEnter = client.status === "active" && !isExpiredDate;
          const trainedToday = checkedInClientIds.has(client.id);

          return (
            <Card
              key={client.id}
              className={
                canEnter
                  ? "border-emerald-500/20 shadow-sm"
                  : "border-red-500/20 bg-red-500/[0.02] shadow-sm"
              }
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-base truncate">
                      {client.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {planObj?.name ?? "Sin plan"}
                    </p>
                  </div>
                  {canEnter ? (
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1 shrink-0"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Acceso OK
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 gap-1 shrink-0"
                    >
                      <XCircle className="size-3.5" />
                      Renovar
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
                  <span>
                    Vence:{" "}
                    {client.membership_end
                      ? new Date(
                          `${client.membership_end.slice(0, 10)}T12:00:00`,
                        ).toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "Sin fecha"}
                  </span>
                  {trainedToday && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Entrenó hoy
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

