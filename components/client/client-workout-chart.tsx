'use client'

import * as React from 'react'
import { areaY, crosshair, defineChart, lineY } from '@tanstack/charts'
import { Chart } from '@tanstack/charts/react'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { tooltip } from '@tanstack/charts/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import {
  createAreaGradient,
  monotoneXCurve,
  ruCoachChartTheme,
} from '@/components/charts/tanstack-chart-utils'

export type ChartDataPoint = { date: string; sessions: number }

function formatShortDateEs(dateStr: string): string {
  const parsed = new Date(`${dateStr}T12:00:00`)
  const d = Number.isNaN(parsed.getTime()) ? new Date(dateStr) : parsed
  if (Number.isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleDateString('es-ES', {
    month: 'short',
    day: 'numeric',
  })
}

export function ClientWorkoutChart({ data }: { data: ChartDataPoint[] }) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState('90d')
  const chartIdPrefix = React.useId().replace(/:/g, '')

  React.useEffect(() => {
    if (isMobile) setTimeRange('7d')
  }, [isMobile])

  const filteredData = React.useMemo(() => {
    if (!data.length) return []
    const ref = data[data.length - 1]?.date
    if (!ref) return data
    const referenceDate = new Date(`${ref}T12:00:00`)
    let daysToSubtract = 90
    if (timeRange === '30d') daysToSubtract = 30
    else if (timeRange === '7d') daysToSubtract = 7
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - (daysToSubtract - 1))
    return data.filter((item) => new Date(`${item.date}T12:00:00`) >= startDate)
  }, [data, timeRange])

  const sessionsInRange = React.useMemo(
    () => filteredData.reduce((acc, d) => acc + d.sessions, 0),
    [filteredData],
  )

  const definition = React.useMemo(() => {
    const maxSessions = Math.max(2, ...filteredData.map((d) => d.sessions))
    return defineChart({
      marks: [
        areaY(filteredData, {
          x: 'date',
          y: 'sessions',
          y1: 0,
          curve: monotoneXCurve,
          fill: 'url(#client-sessions-grad)',
          fillOpacity: 1,
        }),
        lineY(filteredData, {
          x: 'date',
          y: 'sessions',
          curve: monotoneXCurve,
          stroke: 'var(--primary)',
          strokeWidth: 2.5,
          points: filteredData.length <= 14,
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
          scale: () => scalePoint<string>().padding(0.2),
          axis: {
            line: false,
            ticks: {
              line: false,
              padding: 8,
              format: (val) => formatShortDateEs(String(val)),
            },
            tickLabels: {
              fontSize: 11,
              thin: { minGap: 28 },
            },
          },
        },
        y: {
          scale: scaleLinear().domain([0, maxSessions]),
          nice: true,
          grid: {
            strokeDasharray: '3 3',
            strokeOpacity: 0.45,
          },
          axis: false,
        },
      },
      gradients: [
        createAreaGradient('client-sessions-grad', 'var(--primary)', 0.38, 0.02),
      ],
      margin: { top: 12, right: 12, bottom: 28, left: 12 },
      theme: ruCoachChartTheme,
      focus: 'nearest-x',
      maxFocusDistance: Number.POSITIVE_INFINITY,
      svgAnimation: true,
      tooltip: {
        use: tooltip,
        content: (points) => {
          const pt = points[0]
          const count = pt?.datum?.sessions ?? 0
          return {
            title: pt ? formatShortDateEs(pt.datum.date) : '',
            rows: [
              {
                label: 'Actividad',
                value: count === 1 ? '1 sesión' : `${count} sesiones`,
                color: 'var(--primary)',
                active: true,
              },
            ],
          }
        },
      },
    })
  }, [filteredData])

  return (
    <Card className="@container/card overflow-hidden rounded-3xl border-border/60 shadow-md ring-1 ring-border/40">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Tus sesiones completadas</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:inline">
            Cada día cuenta las sesiones que terminaste. En este período:{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {sessionsInRange}
            </span>{' '}
            {sessionsInRange === 1 ? 'sesión' : 'sesiones'}.
          </span>
          <span className="@[540px]/card:hidden">
            Período:{' '}
            <span className="font-semibold tabular-nums">{sessionsInRange}</span>{' '}
            {sessionsInRange === 1 ? 'sesión' : 'sesiones'}
          </span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(val) => val && setTimeRange(val)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Últimos 3 meses</ToggleGroupItem>
            <ToggleGroupItem value="30d">Últimos 30 días</ToggleGroupItem>
            <ToggleGroupItem value="7d">Últimos 7 días</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-auto min-w-[136px] sm:min-w-[146px] **:data-[slot=select-value]:block @[767px]/card:hidden"
              size="sm"
              aria-label="Seleccionar período"
            >
              <SelectValue placeholder="Últimos 3 meses" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Últimos 3 meses
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Últimos 30 días
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Últimos 7 días
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <Chart
          definition={definition}
          height={250}
          idPrefix={`client-sessions-${chartIdPrefix}`}
          ariaLabel="Gráfica de sesiones completadas por día"
          className="w-full"
        />
      </CardContent>
    </Card>
  )
}
