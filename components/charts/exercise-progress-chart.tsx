'use client'

import * as React from 'react'
import { areaY, crosshair, defineChart, dot, lineY } from '@tanstack/charts'
import { Chart } from '@tanstack/charts/react'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { tooltip } from '@tanstack/charts/tooltip'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Dumbbell } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  createAreaGradient,
  monotoneXCurve,
  ruCoachChartTheme,
} from '@/components/charts/tanstack-chart-utils'
import { toZonedWallClockDate } from '@/lib/calendar-date'

export type ExercisePoint = {
  achieved_at: string
  weight_kg: number
  reps?: number | null
}

export type ExerciseLogPoint = ExercisePoint

export type ExerciseOption = {
  id: string
  name: string
  muscle_group?: string | null
}

type MetricMode = 'weight' | 'est1rm'

type ExerciseChartDatum = {
  slot: string
  label: string
  weight_kg: number
  reps: number | null
  est1rm: number
  fullDate: string
}

function computeEpley1Rm(weightKg: number, reps?: number | null): number {
  if (reps == null || reps <= 1) return weightKg
  return Math.round(weightKg * (1 + Math.min(reps, 30) / 30) * 10) / 10
}

export function ExerciseProgressChart({
  exercises,
  pointsByExerciseId,
  defaultExerciseId,
}: {
  exercises: ExerciseOption[]
  pointsByExerciseId: Record<string, ExercisePoint[]>
  defaultExerciseId?: string | null
}) {
  const chartIdPrefix = React.useId().replace(/:/g, '')
  const [selectedId, setSelectedId] = React.useState<string | null>(
    defaultExerciseId || exercises[0]?.id || null,
  )
  const [metricMode, setMetricMode] = React.useState<MetricMode>('weight')

  React.useEffect(() => {
    if (
      selectedId &&
      !exercises.some((e) => e.id === selectedId) &&
      exercises[0]?.id
    ) {
      setSelectedId(exercises[0].id)
    }
  }, [exercises, selectedId])

  const chartData = React.useMemo<ExerciseChartDatum[]>(() => {
    if (!selectedId) return []
    const pts = pointsByExerciseId[selectedId] || []
    return [...pts]
      .sort(
        (a, b) =>
          new Date(a.achieved_at).getTime() - new Date(b.achieved_at).getTime(),
      )
      .map((p, idx) => {
        const d = toZonedWallClockDate(p.achieved_at)
        const reps = p.reps ?? null
        return {
          slot: `ex-${idx}`,
          label: format(d, 'dd MMM', { locale: es }),
          weight_kg: p.weight_kg,
          reps,
          est1rm: computeEpley1Rm(p.weight_kg, reps),
          fullDate: format(d, "d 'de' MMMM yyyy", { locale: es }),
        }
      })
  }, [pointsByExerciseId, selectedId])

  const kpis = React.useMemo(() => {
    if (chartData.length === 0) return null
    const firstPoint = chartData[0]
    let bestWeightPoint = chartData[0]
    let maxEst1Rm = chartData[0].est1rm

    for (const pt of chartData) {
      if (
        pt.weight_kg > bestWeightPoint.weight_kg ||
        (pt.weight_kg === bestWeightPoint.weight_kg &&
          (pt.reps ?? 0) >= (bestWeightPoint.reps ?? 0))
      ) {
        bestWeightPoint = pt
      }
      if (pt.est1rm > maxEst1Rm) {
        maxEst1Rm = pt.est1rm
      }
    }

    const gainKg =
      Math.round((bestWeightPoint.weight_kg - firstPoint.weight_kg) * 10) / 10
    const gainPct =
      firstPoint.weight_kg > 0
        ? Math.round(
            ((bestWeightPoint.weight_kg - firstPoint.weight_kg) /
              firstPoint.weight_kg) *
              1000,
          ) / 10
        : 0

    return {
      firstPoint,
      maxWeight: bestWeightPoint.weight_kg,
      maxWeightReps: bestWeightPoint.reps,
      maxWeightLabel: bestWeightPoint.label,
      maxEst1Rm,
      gainKg,
      gainPct,
    }
  }, [chartData])

  const selectedName =
    exercises.find((e) => e.id === selectedId)?.name || 'Ejercicio'

  const labelBySlot = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const row of chartData) map.set(row.slot, row.label)
    return map
  }, [chartData])

  const definition = React.useMemo(() => {
    const yKey = metricMode === 'est1rm' ? 'est1rm' : 'weight_kg'
    const values = chartData.map((d) =>
      metricMode === 'est1rm' ? d.est1rm : d.weight_kg,
    )
    const minW = values.length > 0 ? Math.min(...values) : 0
    const maxW = values.length > 0 ? Math.max(...values) : 50
    const lowerBound = Math.max(0, Math.floor(minW * 0.85))
    const upperBound = Math.max(lowerBound + 10, Math.ceil(maxW * 1.08))
    const activeColor =
      metricMode === 'est1rm' ? 'var(--primary)' : 'var(--chart-2)'

    return defineChart({
      marks: [
        areaY(chartData, {
          x: 'slot',
          y2: yKey,
          y1: lowerBound,
          key: 'slot',
          curve: monotoneXCurve,
          fill: 'url(#exercise-prog-grad)',
          fillOpacity: 1,
        }),
        lineY(chartData, {
          x: 'slot',
          y: yKey,
          key: 'slot',
          curve: monotoneXCurve,
          stroke: activeColor,
          strokeWidth: 2.5,
        }),
        dot(chartData, {
          x: 'slot',
          y: yKey,
          key: 'slot',
          r: 4,
          fill: activeColor,
          stroke: 'var(--background)',
          strokeWidth: 1.5,
        }),
        crosshair({
          x: true,
          y: false,
          stroke: activeColor,
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
          scale: scaleLinear().domain([lowerBound, upperBound]),
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
              format: (v) => `${Math.round(Number(v))}kg`,
            },
            tickLabels: { fontSize: 11 },
          },
        },
      },
      gradients: [
        createAreaGradient('exercise-prog-grad', activeColor, 0.38, 0.02),
      ],
      margin: { top: 12, right: 14, bottom: 28, left: 42 },
      theme: ruCoachChartTheme,
      focus: 'nearest-x',
      maxFocusDistance: Number.POSITIVE_INFINITY,
      svgAnimation: true,
      tooltip: {
        use: tooltip,
        content: (pts) => {
          const pt = pts[0]
          const d = pt?.datum
          const rows = [
            {
              label: 'Peso máx.',
              value: `${d?.weight_kg ?? 0} kg`,
              color: 'var(--chart-2)',
              active: metricMode === 'weight',
            },
          ]
          if (d?.reps != null) {
            rows.push({
              label: 'Repeticiones',
              value: `${d.reps} reps`,
              color: 'var(--muted-foreground)',
              active: false,
            })
          }
          rows.push({
            label: '1RM Estimado',
            value: `${d?.est1rm ?? 0} kg`,
            color: 'var(--primary)',
            active: metricMode === 'est1rm',
          })
          return {
            title: d?.fullDate ?? d?.label ?? '',
            rows,
          }
        },
      },
    })
  }, [chartData, labelBySlot, metricMode])

  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border/40">
          <Dumbbell className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Sin datos de ejercicios aún
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Registra peso en tus entrenamientos para ver tu progresión por
          ejercicio.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">
            Ejercicio:{' '}
            <span className="font-bold text-foreground">{selectedName}</span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Tabs
            value={metricMode}
            onValueChange={(v) => setMetricMode(v as MetricMode)}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid min-h-9 w-full grid-cols-2 rounded-xl p-1 sm:w-auto">
              <TabsTrigger
                value="weight"
                className="rounded-lg px-2.5 py-1 text-xs font-semibold"
              >
                Peso Máx (kg)
              </TabsTrigger>
              <TabsTrigger
                value="est1rm"
                className="rounded-lg px-2.5 py-1 text-xs font-semibold"
              >
                1RM Est. (kg)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Select
            value={selectedId || undefined}
            onValueChange={(v) => setSelectedId(v)}
          >
            <SelectTrigger
              className="w-full rounded-xl sm:w-[220px]"
              aria-label="Seleccionar ejercicio"
            >
              <SelectValue placeholder="Selecciona un ejercicio" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectGroup>
                {exercises.map((ex) => (
                  <SelectItem key={ex.id} value={ex.id} className="rounded-lg">
                    {ex.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {kpis && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Inicio
            </p>
            <p className="mt-1 text-lg font-black tabular-nums tracking-tight text-foreground">
              {kpis.firstPoint.weight_kg}{' '}
              <span className="text-xs font-semibold text-muted-foreground">
                kg
              </span>
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
              {kpis.firstPoint.label}
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Mejor Peso (PR)
            </p>
            <p className="mt-1 text-lg font-black tabular-nums tracking-tight text-foreground">
              {kpis.maxWeight}{' '}
              <span className="text-xs font-semibold text-muted-foreground">
                kg
              </span>
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
              {kpis.maxWeightReps != null
                ? `× ${kpis.maxWeightReps} reps`
                : kpis.maxWeightLabel}
            </p>
          </div>

          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Mejor 1RM Est.
            </p>
            <p className="mt-1 text-lg font-black tabular-nums tracking-tight text-primary">
              {kpis.maxEst1Rm}{' '}
              <span className="text-xs font-semibold text-primary/80">kg</span>
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
              Fórmula Epley
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Ganancia Total
            </p>
            <p
              className={`mt-1 text-lg font-black tabular-nums tracking-tight ${
                kpis.gainKg > 0
                  ? 'text-emerald-500'
                  : 'text-foreground'
              }`}
            >
              {kpis.gainKg > 0 ? `+${kpis.gainKg.toFixed(1)}` : kpis.gainKg.toFixed(1)}{' '}
              <span className="text-xs font-semibold opacity-80">kg</span>
            </p>
            <p
              className={`mt-0.5 text-[11px] font-semibold tabular-nums ${
                kpis.gainPct > 0
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              {kpis.gainPct > 0
                ? `+${kpis.gainPct.toFixed(1)}% vs inicio`
                : `${kpis.gainPct.toFixed(1)}% vs inicio`}
            </p>
          </div>
        </div>
      )}

      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
          Sin registros para este ejercicio.
        </div>
      ) : (
        <Chart
          definition={definition}
          height={250}
          idPrefix={`ex-prog-${chartIdPrefix}`}
          ariaLabel={`Gráfica de progreso de fuerza para ${selectedName}`}
          className="w-full"
        />
      )}
    </div>
  )
}
