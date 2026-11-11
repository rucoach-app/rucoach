import { getAuthData } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Users, Calendar, CreditCard, CheckCircle } from "lucide-react";
import {
  getNowInTimezone,
  getStartOfDayInTimezone,
  getStartOfMonthInTimezone,
} from "@/lib/calendar-date";

export default async function ReceptionistDashboard() {
  const { user, role } = await getAuthData();

  if (!user || (role !== "receptionist" && role !== "admin")) {
    redirect("/auth/login");
  }

  const supabase = await createClient();

  const now = getNowInTimezone();
  const startOfToday = getStartOfDayInTimezone().toISOString();
  const startOfMonth = getStartOfMonthInTimezone().toISOString();

  const [clientsRes, todaySessionsRes, monthPaymentsRes] = await Promise.all([
    supabase.from("clients").select("id, status, membership_end"),
    supabase
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .gte("started_at", startOfToday),
    supabase
      .from("payments")
      .select("amount, paid_at")
      .gte("paid_at", startOfMonth),
  ]);

  const clients = clientsRes.data ?? [];
  const activeClientsCount = clients.filter(
    (c) => c.status === "active",
  ).length;
  const expiredClientsCount = clients.filter(
    (c) =>
      c.status === "expired" ||
      (c.membership_end &&
        new Date(`${c.membership_end}T23:59:59`) < now),
  ).length;
  const todaySessionsCount = todaySessionsRes.count ?? 0;
  const monthlyRevenue = (monthPaymentsRes.data ?? []).reduce(
    (sum, p) => (p.paid_at ? sum + (Number(p.amount) || 0) : sum),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Bienvenido al Panel
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestiona el acceso de atletas, registra pagos y mantén el control
          operativo de la comunidad RU Coach.
        </p>
      </div>

      {/* Stats - mobile: 2 cols, desktop: 4 cols */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
        <Card className="py-0 gap-0 rounded-2xl overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="px-3.5 sm:px-5 py-3 border-b border-border/50 bg-muted/30">
            <CardTitle className="text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground min-w-0">
              <Users className="size-3.5 text-primary shrink-0" />
              <span className="truncate">Atletas Hoy</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 sm:px-5 py-4 space-y-1">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight">
              {todaySessionsCount}
            </p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Sesiones iniciadas hoy
            </p>
          </CardContent>
        </Card>

        <Card className="py-0 gap-0 rounded-2xl overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="px-3.5 sm:px-5 py-3 border-b border-border/50 bg-muted/30">
            <CardTitle className="text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground min-w-0">
              <Calendar className="size-3.5 text-primary shrink-0" />
              <span className="truncate">Atletas Activos</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 sm:px-5 py-4 space-y-1">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight">
              {activeClientsCount}
            </p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Membresías vigentes
            </p>
          </CardContent>
        </Card>

        <Card className="py-0 gap-0 rounded-2xl overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="px-3.5 sm:px-5 py-3 border-b border-border/50 bg-muted/30">
            <CardTitle className="text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground min-w-0">
              <CreditCard className="size-3.5 text-primary shrink-0" />
              <span className="truncate">Recaudación</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 sm:px-5 py-4 space-y-1">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight">
              ${monthlyRevenue.toLocaleString("es-MX")}
            </p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Ingresos del mes
            </p>
          </CardContent>
        </Card>

        <Card className="py-0 gap-0 rounded-2xl overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="px-3.5 sm:px-5 py-3 border-b border-border/50 bg-muted/30">
            <CardTitle className="text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground min-w-0">
              <CheckCircle className="size-3.5 text-destructive shrink-0" />
              <span className="truncate">Expirados</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3.5 sm:px-5 py-4 space-y-1">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-destructive/80">
              {expiredClientsCount}
            </p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Planes por renovar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation to Features */}
      <Card className="border-border/50 shadow-sm bg-muted/20">
        <CardHeader>
          <CardTitle className="text-lg font-black uppercase tracking-tight">
            Operaciones Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Button
              asChild
              variant="outline"
              className="w-full h-auto py-8 flex-col gap-4 transition-all duration-300 border-border/50 bg-background hover:bg-primary/5 hover:border-primary/20 group"
            >
              <Link href="/receptionist/check-in">
                <CheckCircle className="size-8 text-primary/60 group-hover:text-primary transition-colors" />
                <div className="flex flex-col items-center">
                  <span className="font-black uppercase tracking-tighter text-base">
                    Check-In Atletas
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Registrar Entrada
                  </span>
                </div>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full h-auto py-8 flex-col gap-4 transition-all duration-300 border-border/50 bg-background hover:bg-primary/5 hover:border-primary/20 group"
            >
              <Link href="/receptionist/payments">
                <CreditCard className="size-8 text-primary/60 group-hover:text-primary transition-colors" />
                <div className="flex flex-col items-center">
                  <span className="font-black uppercase tracking-tighter text-base">
                    Registrar Pago
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Membresías y Más
                  </span>
                </div>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full h-auto py-8 flex-col gap-4 transition-all duration-300 border-border/50 bg-background hover:bg-primary/5 hover:border-primary/20 group"
            >
              <Link href="/receptionist/clients">
                <Users className="size-8 text-primary/60 group-hover:text-primary transition-colors" />
                <div className="flex flex-col items-center">
                  <span className="font-black uppercase tracking-tighter text-base">
                    Directorio Atletas
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Búsqueda y Perfiles
                  </span>
                </div>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
