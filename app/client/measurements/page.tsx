import { getAuthUser, getCurrentClientRecord } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarDays, History, Ruler, Scale, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MeasurementsChartLazy } from "@/components/charts/measurements-chart-lazy";
import { MeasurementsRadarChartLazy } from "@/components/charts/measurements-radar-chart-lazy";
import { AddMeasurementForm } from "./add-measurement-form";
import { MeasurementsHistoryList } from "./measurements-history-list";
import { parseRecordedDate } from "@/lib/calendar-date";
import {
  CLIENT_DATA_PAGE_SHELL,
  ClientIncompleteProfileCard,
  ClientStackPageHeader,
} from "@/components/client/client-app-page-parts";

type MeasurementRow = {
  id: string;
  recorded_at: string;
  weight: number | null;
  waist_cm: number | null;
  body_fat_pct: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
};

type MetricKey =
  | "weight"
  | "waist_cm"
  | "body_fat_pct"
  | "hip_cm"
  | "chest_cm"
  | "arm_cm"
  | "thigh_cm";

function formatDeltaText(
  delta: number | null,
  unit: string,
  includeVsAnt = false,
): string | null {
  if (delta === null) return null;
  const sign = delta > 0 ? "+" : "";
  const unitSuffix = unit === "%" ? "%" : ` ${unit}`;
  return `${sign}${delta.toFixed(1)}${unitSuffix}${includeVsAnt ? " vs ant." : ""}`;
}

export default async function ClientMeasurementsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const [supabase, clientRecord] = await Promise.all([
    createClient(),
    getCurrentClientRecord(user.id),
  ]);

  if (!clientRecord) {
    return (
      <>
        <ClientStackPageHeader
          title="Medidas"
          subtitle="Completa tu perfil para registrar peso, cintura y composición."
        />
        <div className={CLIENT_DATA_PAGE_SHELL}>
          <ClientIncompleteProfileCard />
        </div>
      </>
    );
  }

  const measurementsRes = await supabase
    .from("body_measurements")
    .select(
      "id, recorded_at, weight, waist_cm, body_fat_pct, hip_cm, chest_cm, arm_cm, thigh_cm",
    )
    .eq("client_id", clientRecord.id)
    .order("recorded_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(120);

  const measurements = [
    ...((measurementsRes.data || []) as MeasurementRow[]),
  ].sort(
    (a, b) =>
      parseRecordedDate(a.recorded_at).getTime() -
      parseRecordedDate(b.recorded_at).getTime(),
  );
  const latest =
    measurements.length > 0 ? measurements[measurements.length - 1] : null;

  const findMetricStats = (key: MetricKey) => {
    const entries: { value: number; recorded_at: string }[] = [];
    for (const row of measurements) {
      const val = row[key];
      if (val !== null && val !== undefined) {
        entries.push({ value: Number(val), recorded_at: row.recorded_at });
      }
    }

    if (entries.length === 0) {
      return {
        latest: null,
        previous: null,
        first: null,
        deltaPrev: null,
        deltaTotal: null,
      };
    }

    const latestEntry = entries[entries.length - 1];
    const previousEntry =
      entries.length >= 2 ? entries[entries.length - 2] : null;
    const firstEntry = entries[0];

    const deltaPrev =
      previousEntry !== null
        ? Math.round((latestEntry.value - previousEntry.value) * 10) / 10
        : null;
    const deltaTotal =
      entries.length >= 2
        ? Math.round((latestEntry.value - firstEntry.value) * 10) / 10
        : null;

    return {
      latest: latestEntry,
      previous: previousEntry?.value ?? null,
      first: firstEntry.value,
      deltaPrev,
      deltaTotal,
    };
  };

  const weightStats = findMetricStats("weight");
  const waistStats = findMetricStats("waist_cm");
  const fatStats = findMetricStats("body_fat_pct");
  const hipStats = findMetricStats("hip_cm");
  const chestStats = findMetricStats("chest_cm");
  const armStats = findMetricStats("arm_cm");
  const thighStats = findMetricStats("thigh_cm");

  const latestWeight = weightStats.latest;
  const latestWaist = waistStats.latest;
  const latestFat = fatStats.latest;
  const latestHip = hipStats.latest;
  const latestChest = chestStats.latest;
  const latestArm = armStats.latest;
  const latestThigh = thighStats.latest;

  const hasPerimeters =
    latestChest !== null ||
    latestHip !== null ||
    latestArm !== null ||
    latestThigh !== null;

  const n = measurements.length;
  const measurementsSubtitle =
    n === 0
      ? "Sin registros · añade la primera medida para ver la evolución."
      : `${n} ${n === 1 ? "registro" : "registros"} · peso, cintura y composición.`;

  return (
    <>
      <ClientStackPageHeader title="Medidas" subtitle={measurementsSubtitle} />

      <div
        className={`${CLIENT_DATA_PAGE_SHELL} grid gap-6 lg:grid-cols-12 lg:items-start`}
      >
        <aside className="flex flex-col gap-6 lg:col-span-4 lg:sticky lg:top-[calc(96px+1.5rem)] lg:self-start">
          <Card className="overflow-hidden rounded-3xl border-border/80 shadow-md ring-1 ring-primary/5 transition-all hover:shadow-lg">
            <CardHeader className="space-y-4 pb-6">
              <div className="flex items-center gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary transition-transform hover:scale-105">
                  <Scale className="size-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg font-bold tracking-tight sm:text-xl">
                    Mis Medidas
                  </CardTitle>
                  <CardDescription className="text-sm font-medium leading-relaxed">
                    Registra y consulta tus datos antropométricos
                  </CardDescription>
                </div>
              </div>
              <AddMeasurementForm
                latestValues={{
                  weight: latestWeight?.value ?? null,
                  body_fat_pct: latestFat?.value ?? null,
                  waist_cm: latestWaist?.value ?? null,
                  hip_cm: latestHip?.value ?? null,
                  chest_cm: latestChest?.value ?? null,
                  arm_cm: latestArm?.value ?? null,
                  thigh_cm: latestThigh?.value ?? null,
                }}
              />
            </CardHeader>
            <CardContent className="space-y-6">
              {!latest ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-6 py-10 text-center">
                  <p className="text-base font-bold text-foreground">
                    Sin registros todavía
                  </p>
                  <p className="mt-2 text-sm font-medium text-muted-foreground text-pretty">
                    Anímate a registrar tu primera medida para comenzar a visualizar tu progreso.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 pt-2">
                  <div className="group relative overflow-hidden rounded-2xl border bg-muted/20 p-5 transition-all hover:bg-muted/30">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                        Peso Corporal
                      </p>
                      <Scale className="size-4 text-muted-foreground/40 group-hover:text-primary/40" />
                    </div>
                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-4xl font-black tabular-nums tracking-tighter text-foreground">
                        {latestWeight?.value ?? "—"}
                        <span className="text-lg font-bold text-muted-foreground ml-1">
                          kg
                        </span>
                      </p>
                      {weightStats.deltaPrev !== null && (
                        <Badge
                          variant="secondary"
                          className="rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary bg-primary/10"
                        >
                          {formatDeltaText(weightStats.deltaPrev, "kg", true)}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground/80">
                      <CalendarDays className="size-3.5 text-primary shrink-0" aria-hidden />
                      <span>
                        Actualizado el{" "}
                        {parseRecordedDate(
                          latestWeight?.recorded_at ?? latest.recorded_at,
                        ).toLocaleDateString("es", {
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="group rounded-2xl border bg-muted/20 p-5 transition-all hover:bg-muted/30">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                        Cintura
                      </p>
                      <p className="mt-2 text-2xl font-black tabular-nums tracking-tight text-foreground">
                        {latestWaist?.value ?? "—"}
                        <span className="text-sm font-bold text-muted-foreground ml-1">
                          cm
                        </span>
                      </p>
                      {waistStats.deltaPrev !== null && (
                        <p className="mt-1 text-[11px] font-bold tabular-nums text-primary">
                          {formatDeltaText(waistStats.deltaPrev, "cm", true)}
                        </p>
                      )}
                    </div>
                    <div className="group rounded-2xl border bg-muted/20 p-5 transition-all hover:bg-muted/30">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                        Grasa %
                      </p>
                      <p className="mt-2 text-2xl font-black tabular-nums tracking-tight text-foreground">
                        {latestFat?.value != null
                          ? `${latestFat.value}%`
                          : "—"}
                      </p>
                      {fatStats.deltaPrev !== null && (
                        <p className="mt-1 text-[11px] font-bold tabular-nums text-primary">
                          {formatDeltaText(fatStats.deltaPrev, "%", true)}
                        </p>
                      )}
                    </div>
                  </div>

                  {hasPerimeters && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="group rounded-2xl border bg-muted/15 p-4 transition-all hover:bg-muted/25">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                          Pecho
                        </p>
                        <p className="mt-1.5 text-xl font-black tabular-nums tracking-tight text-foreground">
                          {latestChest?.value ?? "—"}
                          <span className="text-xs font-bold text-muted-foreground ml-1">
                            cm
                          </span>
                        </p>
                        {chestStats.deltaPrev !== null && (
                          <p className="mt-1 text-[10px] font-bold tabular-nums text-primary">
                            {formatDeltaText(chestStats.deltaPrev, "cm")}
                          </p>
                        )}
                      </div>
                      <div className="group rounded-2xl border bg-muted/15 p-4 transition-all hover:bg-muted/25">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                          Cadera
                        </p>
                        <p className="mt-1.5 text-xl font-black tabular-nums tracking-tight text-foreground">
                          {latestHip?.value ?? "—"}
                          <span className="text-xs font-bold text-muted-foreground ml-1">
                            cm
                          </span>
                        </p>
                        {hipStats.deltaPrev !== null && (
                          <p className="mt-1 text-[10px] font-bold tabular-nums text-primary">
                            {formatDeltaText(hipStats.deltaPrev, "cm")}
                          </p>
                        )}
                      </div>
                      <div className="group rounded-2xl border bg-muted/15 p-4 transition-all hover:bg-muted/25">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                          Brazo
                        </p>
                        <p className="mt-1.5 text-xl font-black tabular-nums tracking-tight text-foreground">
                          {latestArm?.value ?? "—"}
                          <span className="text-xs font-bold text-muted-foreground ml-1">
                            cm
                          </span>
                        </p>
                        {armStats.deltaPrev !== null && (
                          <p className="mt-1 text-[10px] font-bold tabular-nums text-primary">
                            {formatDeltaText(armStats.deltaPrev, "cm")}
                          </p>
                        )}
                      </div>
                      <div className="group rounded-2xl border bg-muted/15 p-4 transition-all hover:bg-muted/25">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                          Muslo
                        </p>
                        <p className="mt-1.5 text-xl font-black tabular-nums tracking-tight text-foreground">
                          {latestThigh?.value ?? "—"}
                          <span className="text-xs font-bold text-muted-foreground ml-1">
                            cm
                          </span>
                        </p>
                        {thighStats.deltaPrev !== null && (
                          <p className="mt-1 text-[10px] font-bold tabular-nums text-primary">
                            {formatDeltaText(thighStats.deltaPrev, "cm")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 lg:col-span-8 space-y-6">
          <div className="grid gap-6">
            <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl transition-all hover:shadow-lg">
              <CardHeader className="pb-4 pt-6 px-6 border-b bg-muted/5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <Ruler className="size-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight">Evolución</CardTitle>
                    <CardDescription className="text-xs font-medium">Tendencia de tus medidas en el tiempo</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <MeasurementsChartLazy
                  measurements={measurements.map((m) => ({
                    recorded_at: m.recorded_at,
                    weight: m.weight,
                    waist_cm: m.waist_cm,
                    body_fat_pct: m.body_fat_pct,
                    hip_cm: m.hip_cm,
                    chest_cm: m.chest_cm,
                    arm_cm: m.arm_cm,
                    thigh_cm: m.thigh_cm,
                  }))}
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl transition-all hover:shadow-lg">
              <CardHeader className="pb-4 pt-6 px-6 border-b bg-muted/5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <Sparkles className="size-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight">Composición Radar</CardTitle>
                    <CardDescription className="text-xs font-medium">Balance actual de tus KPIs físicos</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 flex items-center justify-center min-h-[300px]">
                <MeasurementsRadarChartLazy
                  measurements={measurements.map((m) => ({
                    recorded_at: m.recorded_at,
                    weight: m.weight,
                    waist_cm: m.waist_cm,
                    body_fat_pct: m.body_fat_pct,
                    hip_cm: m.hip_cm,
                    chest_cm: m.chest_cm,
                    arm_cm: m.arm_cm,
                    thigh_cm: m.thigh_cm,
                  }))}
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl transition-all hover:shadow-lg">
              <CardHeader className="pb-4 pt-6 px-6 border-b bg-muted/5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <History className="size-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight">
                      Historial de Registros
                    </CardTitle>
                    <CardDescription className="text-xs font-medium">
                      Consulta tus mediciones anteriores o elimina un registro erróneo
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <MeasurementsHistoryList measurements={measurements} />
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}
