"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Play, Dumbbell, Clock, ChevronRight, Trophy, CalendarDays } from "lucide-react"
import Link from "next/link"
import type { RoutineDay, RoutineExercise } from "@/lib/types"
import { ScheduleOverrideDialog } from "@/components/client/schedule-override-dialog"

interface NextWorkoutCardProps {
  routineDay?: RoutineDay & { routine_exercises?: RoutineExercise[] }
  routineName?: string
  /** True cuando hay rutina activa pero aún no hay `routineDay` (no confundir con “sin rutina”). */
  hasAssignedRoutine?: boolean
  isRoutineCompleted?: boolean
  currentWeek?: number | null
  durationWeeks?: number | null
  focus?: string | null
  clientRoutineId?: string | null
  trainDays?: {
    id: string
    day_number: number
    day_name?: string | null
    is_rest_day?: boolean | null
  }[]
}

export function NextWorkoutCard({
  routineDay,
  routineName,
  hasAssignedRoutine,
  isRoutineCompleted,
  currentWeek,
  durationWeeks,
  focus,
  clientRoutineId,
  trainDays,
}: NextWorkoutCardProps) {
  const router = useRouter()
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)

  if (isRoutineCompleted) {
    return (
      <Card className="overflow-hidden border-success/30 shadow-sm bg-gradient-to-br from-success/5 via-background to-background rounded-3xl">
        <CardContent className="p-8 sm:p-10 text-center flex flex-col items-center">
          <div className="size-20 rounded-full bg-success/20 ring-8 ring-success/5 flex items-center justify-center mb-8 animate-bounce">
            <Trophy className="size-10 text-success" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black mb-4 text-foreground tracking-tighter">¡LEGADO COMPLETADO!</h3>
          <p className="text-base font-medium text-muted-foreground max-w-md text-balance mb-10 leading-relaxed">
            Has masterizado este ciclo de entrenamiento. Tu coach ha sido notificado para preparar tu siguiente etapa de crecimiento.
          </p>
          <Button variant="outline" className="h-12 px-8 font-black text-[10px] uppercase tracking-widest rounded-full transition-all active:scale-95" asChild>
            <Link href="/client/routines">Ver resumen final</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!routineDay) {
    if (hasAssignedRoutine) {
      return (
        <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
          <CardContent className="p-10 text-center flex flex-col items-center">
            <div className="size-16 rounded-full bg-muted/20 mx-auto mb-6 flex items-center justify-center border border-dashed border-border/80">
              <Clock className="size-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-black tracking-tight mb-2">Bloque de Recuperación</h3>
            <p className="text-sm font-medium text-muted-foreground max-w-xs mx-auto leading-relaxed mb-6">
              Tu ciclo actual no tiene sesiones programadas para hoy. Aprovecha para optimizar tu descanso.
            </p>
            <Button variant="outline" className="h-11 px-6 font-black text-[10px] uppercase tracking-widest rounded-full" asChild>
              <Link href="/client/routines">Ver rutina / Cambiar día</Link>
            </Button>
          </CardContent>
        </Card>
      )
    }
    return (
      <Card className="overflow-hidden border-dashed border-border/60 bg-muted/5 rounded-3xl">
        <CardContent className="p-10 text-center">
          <div className="size-16 rounded-full bg-muted/20 mx-auto mb-6 flex items-center justify-center border border-dashed border-border/60">
            <Dumbbell className="size-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-black tracking-tight mb-2">Esperando Programación</h3>
          <p className="text-sm font-medium text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Tu coach está diseñando tu próximo plan de batalla. Recibirás una notificación cuando esté listo.
          </p>
        </CardContent>
      </Card>
    )
  }

  const exerciseCount = routineDay.routine_exercises?.length || 0
  const estimatedTime = exerciseCount * 10
  const dayFocus = focus ?? routineDay.focus

  return (
    <>
      <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm transition-all hover:bg-card">
        <CardHeader className="pb-5 pt-7 px-5 sm:px-8">
          <div className="flex flex-col gap-4">
            {/* Top row: Status kicker + Routine & Week badges */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                  Próxima sesión en tu rotación
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {currentWeek != null && currentWeek > 0 && (
                  <Badge
                    variant="outline"
                    className="w-fit font-bold text-[11px] tracking-wide px-3 py-1 bg-primary/10 text-primary border-primary/25 rounded-full"
                  >
                    Semana {currentWeek}
                    {durationWeeks ? ` de ${durationWeeks}` : ""}
                  </Badge>
                )}
                {routineName && (
                  <Badge className="w-fit font-bold text-[11px] tracking-wide px-3 py-1 bg-muted/40 text-muted-foreground border-border/40 rounded-full">
                    {routineName}
                  </Badge>
                )}
              </div>
            </div>

            {/* Title & Focus info */}
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline gap-2.5">
                <CardTitle className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Día {routineDay.day_number}
                </CardTitle>
                {routineDay.day_name && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/30 border border-border/50 px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                    <CalendarDays className="size-3 text-primary" />
                    Plantilla: {routineDay.day_name}
                  </span>
                )}
              </div>
              {dayFocus && (
                <p className="text-sm sm:text-base font-bold text-foreground/90 leading-snug">
                  <span className="text-muted-foreground font-medium">Enfoque: </span>
                  {dayFocus}
                </p>
              )}
              <p className="text-[11px] font-medium text-muted-foreground/75 leading-relaxed">
                Tu plan avanza sesión por sesión para asegurar el estímulo muscular completo.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 sm:px-8 pb-7 flex flex-col gap-6">
          {/* Quick stats grid with balanced circular icons */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-3.5 p-3 sm:p-4 rounded-2xl bg-muted/15 border border-border/50 transition-colors hover:border-primary/30">
              <div className="size-9 sm:size-11 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
                <Dumbbell className="size-4.5 sm:size-5 text-primary" strokeWidth={2.2} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xl sm:text-2xl font-black tabular-nums leading-none tracking-tight text-foreground">
                  {exerciseCount}
                </span>
                <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground mt-1 whitespace-nowrap">
                  Ejercicios
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3.5 p-3 sm:p-4 rounded-2xl bg-muted/15 border border-border/50 transition-colors hover:border-primary/30">
              <div className="size-9 sm:size-11 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
                <Clock className="size-4.5 sm:size-5 text-primary" strokeWidth={2.2} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xl sm:text-2xl font-black tabular-nums leading-none tracking-tight text-foreground">
                  {estimatedTime}
                </span>
                <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground mt-1 whitespace-nowrap">
                  Min aprox.
                </span>
              </div>
            </div>
          </div>

          {/* Exercise preview with 2-line wraps and clean circular numbers */}
          {routineDay.routine_exercises && routineDay.routine_exercises.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">
                Contenido de la sesión
              </span>
              <div className="flex flex-col gap-2.5">
                {routineDay.routine_exercises.slice(0, 3).map((ex, i) => (
                  <div
                    key={ex.id}
                    className="group flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border border-border/50 bg-background/50 transition-all hover:bg-background hover:border-primary/25 hover:shadow-xs"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-3.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/60 text-xs font-black text-foreground/80 border border-border/50 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                        {i + 1}
                      </span>
                      <span className="line-clamp-2 text-xs sm:text-sm font-bold tracking-tight text-foreground leading-snug group-hover:text-primary transition-colors">
                        {ex.exercises?.name_es || ex.exercises?.name || "Ejercicio"}
                      </span>
                    </div>
                    <div className="shrink-0 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-bold tabular-nums text-muted-foreground group-hover:border-primary/25 group-hover:text-foreground transition-colors whitespace-nowrap">
                      {ex.sets} <span className="text-[10px] text-muted-foreground/70">series</span> × <span className="whitespace-nowrap">{ex.reps || "var"}</span>
                    </div>
                  </div>
                ))}
                {exerciseCount > 3 && (
                  <div className="flex items-center justify-center pt-1">
                    <Link
                      href="/client/routines"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors py-1 px-3 rounded-full hover:bg-primary/5"
                    >
                      <span>+{exerciseCount - 3} ejercicios más en esta sesión</span>
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Button
              asChild
              className="h-14 flex-1 text-sm sm:text-base font-black uppercase tracking-[0.12em] rounded-2xl shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:translate-y-[-1px] active:translate-y-[0] active:scale-[0.98] group"
            >
              <Link href="/client/workout/start">
                <Play className="size-5 mr-2.5 fill-current shrink-0 group-hover:scale-110 transition-transform duration-200" />
                Comenzar Entrenamiento
                <ChevronRight className="size-5 ml-auto opacity-50 group-hover:opacity-100 transition-all" />
              </Link>
            </Button>

            {clientRoutineId && trainDays && trainDays.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setScheduleDialogOpen(true)}
                className="h-14 sm:w-auto px-5 text-xs font-black uppercase tracking-wider rounded-2xl border-border/60 bg-background/50 hover:bg-background hover:border-primary/30 transition-all gap-2"
              >
                <CalendarDays className="size-4 text-primary" />
                Cambiar día
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                className="h-14 sm:w-auto px-5 text-xs font-black uppercase tracking-wider rounded-2xl border-border/60 bg-background/50 hover:bg-background hover:border-primary/30 transition-all"
              >
                <Link href="/client/routines">
                  Ver rutina completa
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule Override Dialog */}
      {clientRoutineId && trainDays && (
        <ScheduleOverrideDialog
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          clientRoutineId={clientRoutineId}
          trainDays={trainDays}
          onOverrideSet={() => {
            router.refresh()
          }}
        />
      )}
    </>
  )
}
