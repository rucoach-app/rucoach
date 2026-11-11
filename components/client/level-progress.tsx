'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CircularProgress } from '@/components/ui/circular-progress'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Activity } from 'lucide-react'
import type { LevelInfo } from '@/lib/types'
import { getLevelName } from '@/lib/types'

interface LevelProgressProps {
  levelInfo: LevelInfo
  username?: string
  avatarUrl?: string
}

export function LevelProgress({ levelInfo, username, avatarUrl }: LevelProgressProps) {
  const xpRemaining = levelInfo.xpForNextLevel - levelInfo.currentXP
  const levelName = getLevelName(levelInfo.level)

  return (
    <Card className="@container/level py-0 gap-0 overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm transition-all hover:bg-card">
      <CardContent className="p-4 sm:p-6 @md/level:p-8">
        <div className="flex flex-col items-center gap-3.5 sm:gap-5 @md/level:flex-row @md/level:items-start @md/level:gap-8">
          <div className="relative group shrink-0">
            <div className="absolute inset-x-0 bottom-0 top-0 bg-primary/20 blur-2xl rounded-full scale-0 group-hover:scale-125 transition-transform duration-500" />
            <CircularProgress
              value={levelInfo.progress}
              size={110}
              strokeWidth={6}
              showValue={false}
              className="text-primary relative z-10"
            >
              <div className="relative size-[90px] overflow-hidden rounded-full border-4 border-background shadow-xl">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={username ? `Foto de ${username}` : 'Foto de perfil'}
                    width={90}
                    height={90}
                    className="size-full object-cover transition-transform group-hover:scale-110 duration-500"
                    sizes="90px"
                  />
                ) : (
                  <div
                    className="flex size-full items-center justify-center bg-primary text-3xl font-black text-primary-foreground"
                    aria-hidden
                  >
                    {username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
            </CircularProgress>

            <div className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full border-3 border-background bg-primary text-xs font-black text-primary-foreground shadow-lg z-20">
              {levelInfo.level}
            </div>
          </div>

          <div className="flex w-full min-w-0 flex-1 flex-col gap-3 sm:gap-5 text-center @md/level:text-left">
            <div className="flex flex-col items-center gap-2 @md/level:flex-row @md/level:items-center @md/level:justify-between">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Atleta de Élite</span>
                <h3 className="text-2xl font-black tracking-tight text-foreground truncate">{username || 'Tu progreso'}</h3>
              </div>
              <Badge className="w-fit shrink-0 font-black text-[10px] uppercase tracking-widest px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full">
                {levelName}
              </Badge>
            </div>

            <div className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground/60">
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="size-3.5 text-primary shrink-0" aria-hidden />
                  Experiencia
                </span>
                <span className="tabular-nums text-foreground">
                  {levelInfo.currentXP.toLocaleString()} <span className="text-muted-foreground/40 font-bold mx-0.5">/</span> {levelInfo.xpForNextLevel.toLocaleString()} XP
                </span>
              </div>
              <div className="relative h-2.5 w-full bg-muted rounded-full overflow-hidden">
                <Progress value={levelInfo.progress} className="size-full" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] animate-shimmer" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className="text-xs font-medium text-muted-foreground italic">
                  Próximo objetivo: <span className="text-foreground font-black tabular-nums">{xpRemaining.toLocaleString()} XP</span>
                </p>
                <Button variant="ghost" size="sm" asChild className="h-8 px-3 rounded-full font-black text-[10px] uppercase tracking-wider hover:bg-primary/5 hover:text-primary transition-all">
                  <Link href="/client/achievements" className="flex items-center gap-1.5">
                    Ver mis hitos
                    <ChevronRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
