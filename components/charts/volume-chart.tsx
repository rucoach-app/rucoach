'use client'

import * as React from 'react'
import { areaY, crosshair, defineChart, dot, lineY } from '@tanstack/charts'
import { Chart } from '@tanstack/charts/react'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { tooltip } from '@tanstack/charts/tooltip'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart2 } from 'lucide-react'
import {
  createAreaGradient,
  monotoneXCurve,
  ruCoachChartTheme,
} from '@/components/charts/tanstack-chart-utils'
import { toZonedWallClockDate } from '@/lib/calendar-date'

export type SessionRow = {
  started_at: string
  total_volume_kg: number | null
}

type VolumeDatum = {
  slot: string
  label: string
  volumeKg: number
  fullDate: string
}

export function VolumeChart({ sessions }: { sessions: SessionRow[] }) {
  const chartIdPrefix = React.useId().replace(/:/g, '')

  const chartData = React.useMemo<VolumeDatum[]>(() => {
    return [...(sessions || [])]
      .map((s) => {
        const raw = s.total_volume_kg
        const n = typeof raw === 'number' ? raw : Number(raw)
        return {
          started_at: s.started_at,
          volumeKg: Number.isFinite(n) ? n : NaN,
        }
      })
      .filter(
        (s) => s.started_at && Number.isFinite(s.volumeKg) && s.volumeKg > 0,
      )
      .sort(
        (a, b) =>
          new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
      )
      .map((s, idx) => {
        const d = toZonedWallClockDate(s.started_at)
        return {
          slot: `vol-${idx}`,
          label: format(d, 'dd MMM', { locale: es }),
          volumeKg: Math.round(s.volumeKg),
          fullDate: format(d, "EEEE d 'de' MMMM yyyy", { locale: es }),
        }
      })
  }, [sessions])

  const labelBySlot = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const row of chartData) map.set(row.slot, row.label)
    return map
  }, [chartData])

  const definition = React.useMemo(() => {
    const maxVol = Math.max(100, ...chartData.map((d) => d.volumeKg))
    return defineChart({
      marks: [
        areaY(chartData, {
          x: 'slot',
          y: 'volumeKg',
          y1: 0,
          key: 'slot',
          curve: monotoneXCurve,
          fill: 'url(#session-vol-grad)',
          fillOpacity: 1,
        }),
        lineY(chartData, {
          x: 'slot',
          y: 'volumeKg',
          key: 'slot',
          curve: monotoneXCurve,
          stroke: 'var(--primary)',
          strokeWidth: 2.5,
        }),
        dot(chartData, {
          x: 'slot',
          y: 'volumeKg',
          key: 'slot',
          r: 4,
          fill: 'var(--primary)',
          stroke: 'var(--background)',
          strokeWidth: 1.5,
        }),
        crosshair({
          x: true,
          y: false,
          stroke: 'var(--primary)',
          strokeOpacity: 0.35,
          strokeDasharray: '4 4',
        }),
      ],
      scales: {
        x: {
          scale: () => scalePoint<string>().padding(0.25),
          axis: {
            line: false,
            ticks: {
              line: false,
              padding: 8,
              format: (val) => labelBySlot.get(String(val)) ?? String(val),
            },
            tickLabels: {
              fontSize: 11,
              thin: { minGap: 28 },
            },
          },
        },
        y: {
          scale: scaleLinear().domain([0, maxVol]),
          nice: true,
          grid: {
            strokeDasharray: '3 3',
            strokeOpacity: 0.45,
          },
          axis: {
            line: false,
            ticks: {
              line: false,
              count: 4,
              format: (v) =>
                Number(v) >= 1000
                  ? `${(Number(v) / 1000).toFixed(1)}k`
                  : `${Math.round(Number(v))}`,
            },
            tickLabels: { fontSize: 11 },
          },
        },
      },
      gradients: [
        createAreaGradient('session-vol-grad', 'var(--primary)', 0.38, 0.02),
      ],
      margin: { top: 12, right: 14, bottom: 28, left: 38 },
      theme: ruCoachChartTheme,
      focus: 'nearest-x',
      maxFocusDistance: Number.POSITIVE_INFINITY,
      svgAnimation: true,
      tooltip: {
        use: tooltip,
        content: (points) => {
          const pt = points[0]
          const d = pt?.datum
          return {
            title: d?.fullDate ?? d?.label ?? '',
            rows: [
              {
                label: 'Volumen total',
                value: `${(d?.volumeKg ?? 0).toLocaleString('es-MX')} kg`,
                color: 'var(--primary)',
                active: true,
              },
            ],
          }
        },
      },
    })
  }, [chartData, labelBySlot])

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border/40">
          <BarChart2 className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Sin datos de volumen aún
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Completa entrenamientos con peso registrado para ver esta gráfica.
        </p>
      </div>
    )
  }

  return (
    <Chart
      definition={definition}
      height={260}
      idPrefix={`vol-chart-${chartIdPrefix}`}
      ariaLabel="Gráfica de volumen levantado por sesión"
      className="w-full"
    />
  )
}
