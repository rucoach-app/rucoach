'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatDateKeyLocal } from '@/lib/calendar-date'
import { cn } from '@/lib/utils'

type DayInfo = {
  dateKey: string // YYYY-MM-DD
  inMonth: boolean
}

export type MonthWorkoutStats = {
  totalVolumeKg: number
  sessionCount: number
  uniqueDays: number
  avgVolumePerSession: number
  maxDayVolumeKg: number
}

function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function initialSelectedForMonth(
  year: number,
  monthIndex: number,
  sessionsByDate: Record<string, unknown>,
) {
  const now = new Date()
  if (now.getFullYear() === year && now.getMonth() === monthIndex) {
    return toDateKey(now)
  }
  const prefix = `${year}-${pad2(monthIndex + 1)}-`
  return (
    Object.keys(sessionsByDate)
      .filter((k) => k.startsWith(prefix))
      .sort()[0] ?? ''
  )
}

export function WorkoutCalendar({
  year,
  monthIndex,
  sessionsByDate,
  monthStats,
  prevMonthHref,
  nextMonthHref,
}: {
  year: number
  monthIndex: number // 0-11
  sessionsByDate: Record<
    string,
    { count: number; totalVolumeKg: number; lastSessionAt?: string | null }
  >
  monthStats: MonthWorkoutStats
  prevMonthHref: string
  nextMonthHref: string
}) {
  const monthYmRef = useRef<string>('')
  const [selected, setSelected] = useState<string>(() =>
    initialSelectedForMonth(year, monthIndex, sessionsByDate),
  )

  useEffect(() => {
    const ym = `${year}-${monthIndex}`
    if (monthYmRef.current === ym) return
    monthYmRef.current = ym
    setSelected(initialSelectedForMonth(year, monthIndex, sessionsByDate))
  }, [year, monthIndex, sessionsByDate])

  const { days, label } = useMemo(() => {
    const first = new Date(year, monthIndex, 1)
    const firstDayOfWeek = first.getDay() // 0 Sun - 6 Sat

    // Make grid start Monday
    const mondayIndex = (firstDayOfWeek + 6) % 7
    const gridStart = new Date(year, monthIndex, 1 - mondayIndex)

    const gridDays: DayInfo[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      const dateKey = toDateKey(d)
      gridDays.push({
        dateKey,
        inMonth: d.getMonth() === monthIndex,
      })
    }

    const monthName = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    return { days: gridDays, label: monthName }
  }, [year, monthIndex])

  const selectedInfo = selected ? sessionsByDate[selected] : undefined
  const detailDateLabel = selected
    ? formatDateKeyLocal(selected, 'es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  const volumeShare =
    selectedInfo && monthStats.maxDayVolumeKg > 0
      ? Math.min(100, Math.round((selectedInfo.totalVolumeKg / monthStats.maxDayVolumeKg) * 100))
      : 0

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_minmax(280px,340px)]">
      <Card className="overflow-hidden rounded-3xl border-border/80 shadow-sm ring-1 ring-primary/5">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3 space-y-0">
          <div>
            <CardTitle className="text-base sm:text-lg">Calendario</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground capitalize">{label}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="icon" className="size-10 rounded-full" asChild>
              <Link href={prevMonthHref} aria-label="Mes anterior" prefetch>
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" size="icon" className="size-10 rounded-full" asChild>
              <Link href={nextMonthHref} aria-label="Mes siguiente" prefetch>
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-3 sm:px-6">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {days.map((day) => {
              const info = sessionsByDate[day.dateKey]
              const hasSession = Boolean(info)
              const isSelected = Boolean(selected && day.dateKey === selected)

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => setSelected(day.dateKey)}
                  className={cn(
                    'relative min-h-12 flex flex-col items-center justify-center rounded-2xl border px-1 py-1.5 transition-all duration-200 sm:min-h-[3.5rem]',
                    'touch-manipulation active:scale-[0.96]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    day.inMonth ? 'bg-card shadow-sm' : 'bg-muted/10',
                    !day.inMonth && 'opacity-40',
                    isSelected
                      ? 'z-[10] border-transparent bg-primary shadow-md scale-105 ring-4 ring-primary/20'
                      : 'border-border/60 hover:border-primary/40 hover:bg-muted/40 hover:scale-[1.02]',
                  )}
                >
                  <div
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      day.inMonth 
                        ? (isSelected ? 'text-primary-foreground' : 'text-foreground/90') 
                        : (isSelected ? 'text-primary-foreground' : 'text-muted-foreground'),
                    )}
                  >
                    {Number(day.dateKey.split('-')[2])}
                  </div>
                  {hasSession ? (
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <span className={cn('block size-1.5 shrink-0 rounded-full', isSelected ? 'bg-primary-foreground' : 'bg-primary')} aria-hidden />
                      <span className={cn("text-[10px] font-bold tabular-nums sm:text-[11px]", isSelected ? 'text-primary-foreground/90' : 'text-muted-foreground')}>
                        {info.count}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center justify-center gap-1 h-3 opacity-0">
                      <span className="block size-1.5 shrink-0 rounded-full bg-transparent" aria-hidden />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-5">
        <Card className="overflow-hidden rounded-3xl border-border/80 shadow-sm ring-1 ring-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Detalle del día</CardTitle>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Resumen de tus sesiones completadas en la fecha seleccionada.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {selected ? (
              <>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha</p>
                  <p className="mt-1 text-base font-semibold capitalize leading-snug text-foreground sm:text-lg">
                    {detailDateLabel}
                  </p>
                </div>

                {selectedInfo ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default" className="tabular-nums shadow-sm">
                        {selectedInfo.count} {selectedInfo.count === 1 ? 'sesión' : 'sesiones'}
                      </Badge>
                      {selectedInfo.lastSessionAt ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          Última:{' '}
                          {new Date(selectedInfo.lastSessionAt).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'America/Mexico_City',
                          })}
                        </span>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm ring-1 ring-primary/5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Volumen total levantado</span>
                        <span className="whitespace-nowrap text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-foreground">
                          {Math.round(selectedInfo.totalVolumeKg).toLocaleString('es-MX')}{' '}
                          <span className="text-base sm:text-lg text-muted-foreground font-semibold">kg</span>
                        </span>
                      </div>
                      {monthStats.maxDayVolumeKg > 0 ? (
                        <div className="mt-4 flex flex-col gap-2.5">
                          <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            <span>vs. día máximo del mes</span>
                            <span className="tabular-nums text-primary">{volumeShare}%</span>
                          </div>
                          <Progress value={volumeShare} className="h-2.5 rounded-full" />
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 p-5 text-sm">
                      <p className="font-bold text-foreground mb-3 text-base">Resumen del mes</p>
                      <ul className="flex flex-col gap-3 text-muted-foreground">
                        <li className="flex justify-between items-center gap-2">
                          <span className="font-medium">Promedio por sesión</span>
                          <span className="tabular-nums font-bold text-foreground text-sm bg-background px-2 py-0.5 rounded-md shadow-sm border">
                            {monthStats.sessionCount > 0
                              ? `${Math.round(monthStats.avgVolumePerSession).toLocaleString('es-MX')} kg`
                              : '—'}
                          </span>
                        </li>
                        <li className="flex justify-between items-center gap-2">
                          <span className="font-medium">Días activos</span>
                          <span className="tabular-nums font-bold text-foreground text-sm bg-background px-2 py-0.5 rounded-md shadow-sm border">
                            {monthStats.uniqueDays}
                          </span>
                        </li>
                        <li className="flex justify-between items-center gap-2">
                          <span className="font-medium">Volumen acumulado</span>
                          <span className="tabular-nums font-bold text-foreground text-sm bg-background px-2 py-0.5 rounded-md shadow-sm border">
                            {Math.round(monthStats.totalVolumeKg).toLocaleString('es-MX')} kg
                          </span>
                        </li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    No hay entrenamientos registrados en este día.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Selecciona un día en el calendario.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
