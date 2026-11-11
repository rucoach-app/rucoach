"use client";

import React, { useEffect, useRef, useState } from "react";
import { formatDateKeyInTimezone, toZonedWallClockDate } from "@/lib/calendar-date";

export interface HeatmapSessionEntry {
  started_at: string;
  total_volume_kg?: number | null;
  duration_minutes?: number | null;
  duration_seconds?: number | null;
}

export interface ActivityHeatmapProps {
  sessions: HeatmapSessionEntry[];
  defaultMetric?: "vol" | "time";
  onDay?: (isoDate: string) => void;
}

const MONTHS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLong(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    return date.toLocaleDateString("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ActivityHeatmap({
  sessions,
  defaultMetric = "vol",
  onDay,
}: ActivityHeatmapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [metric, setMetric] = useState<"vol" | "time">(defaultMetric);
  const [activeDay, setActiveDay] = useState<{
    key: string;
    n: number;
    vol: number;
    min: number;
  } | null>(null);

  const prevWidthRef = useRef<number>(0);

  // Auto-scroll to the end (today) on mount, tab reveal (hidden -> visible), or data change
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const scrollToLatest = () => {
      if (el.clientWidth > 0) {
        el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      }
    };

    const rafId = requestAnimationFrame(scrollToLatest);
    prevWidthRef.current = el.clientWidth;

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect?.width ?? el.clientWidth;
            const prev = prevWidthRef.current;
            prevWidthRef.current = w;
            if (prev === 0 && w > 0) {
              requestAnimationFrame(scrollToLatest);
            }
          })
        : null;
    ro?.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
    };
  }, [sessions?.length]);

  const agg: Record<string, { n: number; vol: number; min: number }> = {};
  for (const s of sessions || []) {
    if (!s.started_at) continue;
    const d = new Date(s.started_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = formatDateKeyInTimezone(d);
    const entry = (agg[key] = agg[key] || { n: 0, vol: 0, min: 0 });
    entry.n += 1;
    const rawVol = Number(s.total_volume_kg);
    entry.vol += Number.isFinite(rawVol) && rawVol > 0 ? rawVol : 0;
    const rawMin = Number(s.duration_minutes);
    const rawSec = Number(s.duration_seconds);
    const durMin =
      Number.isFinite(rawMin) && rawMin > 0
        ? Math.max(1, Math.round(rawMin))
        : Number.isFinite(rawSec) && rawSec > 0
          ? Math.max(1, Math.round(rawSec / 60))
          : 45;
    entry.min += durMin;
  }

  const metricKey = metric === "vol" ? "vol" : "min";
  const values = Object.values(agg)
    .map((a) => a[metricKey])
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  const q = (p: number) =>
    values.length
      ? values[Math.min(values.length - 1, Math.floor(p * values.length))]
      : 0;
  const t1 = q(0.25);
  const t2 = q(0.5);
  const t3 = q(0.75);

  const level = (a?: { n: number; vol: number; min: number }) =>
    !a
      ? 0
      : !a[metricKey]
        ? 1
        : a[metricKey] >= t3
          ? 4
          : a[metricKey] >= t2
            ? 3
            : a[metricKey] >= t1
              ? 2
              : 1;

  const today = toZonedWallClockDate(new Date());
  today.setHours(12, 0, 0, 0);
  const todayKey = isoOf(today);

  // Start week on Monday (1)
  const dayOfWeek = today.getDay();
  const offsetFromMon = (dayOfWeek + 6) % 7;
  const end = new Date(today);
  end.setDate(today.getDate() - offsetFromMon);
  const start = new Date(end);
  start.setDate(end.getDate() - 52 * 7);

  const dayLabels = ["Lun", "", "Mié", "", "Vie", "", ""];

  const months: React.ReactNode[] = [];
  const cols: React.ReactNode[] = [];
  let lastMonth = -1;

  for (let wk = 0; wk <= 52; wk++) {
    const colStart = new Date(start);
    colStart.setDate(start.getDate() + wk * 7);
    const mo = colStart.getMonth();
    const showM = mo !== lastMonth && colStart.getDate() <= 7 && wk <= 51;
    months.push(
      <span
        key={wk}
        className="flex-none w-[14px] min-w-[14px] text-[11px] text-muted-foreground whitespace-nowrap overflow-visible inline-block select-none"
      >
        {showM ? MONTHS_ES[mo] : ""}
      </span>,
    );
    if (colStart.getDate() <= 7) lastMonth = mo;

    const cells: React.ReactNode[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(colStart);
      day.setDate(colStart.getDate() + d);
      const key = isoOf(day);
      const a = agg[key];
      const isFuture = key > todayKey;
      const isToday = key === todayKey;
      const isSelected = activeDay?.key === key;

      const title = a
        ? `${key} · ${a.n} ${a.n === 1 ? "sesión" : "sesiones"} · ${a.min} min · ${Math.round(a.vol).toLocaleString("es-MX")} kg`
        : isFuture
          ? `${key} · Próximo`
          : `${key} · Sin entrenamientos`;

      const selectCell = () => {
        setActiveDay({
          key,
          n: a?.n ?? 0,
          vol: a?.vol ?? 0,
          min: a?.min ?? 0,
        });
        onDay?.(key);
      };

      cells.push(
        <div
          key={d}
          role="button"
          tabIndex={0}
          aria-label={title}
          className={`hm-c l${level(a)}${isToday ? " today" : ""}${isFuture ? " future" : ""}${isSelected ? " selected" : ""} w-[11px] h-[11px] min-w-[11px] min-h-[11px] rounded-[3px] flex-none cursor-pointer transition-transform hover:scale-125`}
          title={title}
          onClick={selectCell}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              selectCell();
            }
          }}
          onMouseEnter={() => {
            if (a) {
              setActiveDay({ key, n: a.n, vol: a.vol, min: a.min });
            }
          }}
        />,
      );
    }
    cols.push(
      <div key={wk} className="hm-col flex flex-col gap-[3px] flex-none">
        {cells}
      </div>,
    );
  }

  const totalTrainedDays = Object.keys(agg).length;

  return (
    <div className="space-y-3.5">
      {/* Top Header: Total Days + Segmented Metric Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">
            {totalTrainedDays}{" "}
            <span className="font-medium text-muted-foreground">
              {totalTrainedDays === 1 ? "día entrenado" : "días entrenados"} en el último año
            </span>
          </span>
        </div>

        {/* Authentic Segmented pill slider */}
        <div className="inline-flex rounded-xl border border-border/70 bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setMetric("vol")}
            className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
              metric === "vol"
                ? "bg-card text-primary shadow-sm ring-1 ring-primary/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Volumen (kg)
          </button>
          <button
            type="button"
            onClick={() => setMetric("time")}
            className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
              metric === "time"
                ? "bg-card text-primary shadow-sm ring-1 ring-primary/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tiempo (min)
          </button>
        </div>
      </div>

      {/* Heatmap Grid Wrapper (Scrollable on small screens, full width on desktop) */}
      <div
        className="hm-wrap overflow-x-auto pb-1"
        ref={wrapRef}
        style={{ scrollbarWidth: "none" }}
      >
        <div
          className="hm-months flex mb-1.5 select-none"
          style={{ marginInlineStart: 28 }}
        >
          {months}
        </div>
        <div className="hm-body flex items-start">
          <div className="hm-days flex flex-col gap-[3px] flex-none w-[28px] select-none">
            {dayLabels.map((lbl, i) => (
              <span
                key={i}
                className="h-[11px] leading-[11px] text-[10px] text-muted-foreground block flex-none"
              >
                {lbl || "\u00A0"}
              </span>
            ))}
          </div>
          <div className="hm-grid flex gap-[3px] flex-none">{cols}</div>
        </div>
      </div>

      {/* Bottom Bar: Active day inspection info & Color Ramp Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
        <div className="min-h-[20px] text-[11px] text-muted-foreground">
          {activeDay ? (
            <span>
              <strong className="text-foreground font-semibold">
                {formatDateLong(activeDay.key)}:
              </strong>{" "}
              {activeDay.n > 0 ? (
                <>
                  <span className="text-primary font-bold">
                    {activeDay.n} {activeDay.n === 1 ? "sesión" : "sesiones"}
                  </span>
                  {" · "}
                  <span>{activeDay.min} min</span>
                  {" · "}
                  <span>{Math.round(activeDay.vol).toLocaleString("es-MX")} kg</span>
                </>
              ) : (
                <span className="opacity-70">Sin entrenamientos</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground/70">
              Pasa el cursor o toca un cuadro para ver el detalle del día
            </span>
          )}
        </div>

        {/* Legend */}
        <div className="hm-legend flex items-center gap-1.5 text-[11px] text-muted-foreground select-none">
          <span>{metric === "vol" ? "Menos" : "Menos"}</span>
          <div className="hm-c l0" title="0" />
          <div className="hm-c l1" title="Nivel 1" />
          <div className="hm-c l2" title="Nivel 2" />
          <div className="hm-c l3" title="Nivel 3" />
          <div className="hm-c l4" title="Nivel 4" />
          <span>{metric === "vol" ? "Más" : "Más"}</span>
        </div>
      </div>
    </div>
  );
}
