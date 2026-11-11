'use client'

import { TrendingUp, Flame, Dumbbell, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export type ClientDashboardMetrics = {
  streakDays: number
  totalWorkouts: number
  totalVolume: number
  prsThisMonth: number
}

export function ClientDashboardCards({
  streakDays,
  totalWorkouts,
  totalVolume,
  prsThisMonth,
}: ClientDashboardMetrics) {
  const volumeTons = (totalVolume / 1000).toFixed(1)

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2">
      <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm transition-all hover:bg-card">
        <CardHeader className="p-3.5 pb-1.5 sm:p-5 sm:pb-2">
          <div className="flex items-center justify-between">
            <div className="size-9 sm:size-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Flame className="size-4 sm:size-5 text-primary" strokeWidth={2.2} />
            </div>
            {streakDays >= 7 && (
              <Badge className="h-5 font-black text-[9px] uppercase tracking-widest px-2.5 bg-primary text-primary-foreground border-none rounded-full">
                HOT
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3.5 pt-1 sm:p-5 sm:pt-2">
          <p className="text-2xl sm:text-4xl font-black tracking-tighter tabular-nums text-foreground">{streakDays}d</p>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">Racha Actual</p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm transition-all hover:bg-card">
        <CardHeader className="p-3.5 pb-1.5 sm:p-5 sm:pb-2">
          <div className="size-9 sm:size-11 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Dumbbell className="size-4 sm:size-5 text-indigo-500" strokeWidth={2.2} />
          </div>
        </CardHeader>
        <CardContent className="p-3.5 pt-1 sm:p-5 sm:pt-2">
          <p className="text-2xl sm:text-4xl font-black tracking-tighter tabular-nums text-foreground">{totalWorkouts}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">Sesiones</p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm transition-all hover:bg-card">
        <CardHeader className="p-3.5 pb-1.5 sm:p-5 sm:pb-2">
          <div className="size-9 sm:size-11 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <TrendingUp className="size-4 sm:size-5 text-emerald-500" strokeWidth={2.2} />
          </div>
        </CardHeader>
        <CardContent className="p-3.5 pt-1 sm:p-5 sm:pt-2">
          <p className="text-2xl sm:text-4xl font-black tracking-tighter tabular-nums text-foreground">{volumeTons}t</p>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">Volumen Total</p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm transition-all hover:bg-card">
        <CardHeader className="p-3.5 pb-1.5 sm:p-5 sm:pb-2">
          <div className="flex items-center justify-between">
            <div className="size-9 sm:size-11 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Trophy className="size-4 sm:size-5 text-amber-500" strokeWidth={2.2} />
            </div>
            {prsThisMonth > 0 && (
              <Badge className="h-5 font-black text-[9px] uppercase tracking-widest px-2.5 bg-amber-500 text-amber-950 border-none rounded-full">
                PR
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3.5 pt-1 sm:p-5 sm:pt-2">
          <p className="text-2xl sm:text-4xl font-black tracking-tighter tabular-nums text-foreground">{prsThisMonth}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">Marcas Personales</p>
        </CardContent>
      </Card>
    </div>
  )
}
