'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AchievementBadge } from '@/components/client/achievement-badge'
import type { Achievement, UserAchievement } from '@/lib/types'
import {
  DIFFICULTY_TIERS,
  type DifficultyTierId,
  achievementActionMeta,
  achievementCategoryLabel,
  achievementDifficultyMeta,
  achievementLucideIcon,
  achievementRarityColor,
  formatAchievementProgress,
  sortAchievementsForDisplay,
} from '@/lib/achievements-ui'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Trophy,
  Flame,
  Zap,
  TrendingUp,
  Award,
  LayoutGrid,
  Sparkles,
  Share2,
  ArrowRight,
  CheckCircle2,
  Lock,
  Shield,
} from 'lucide-react'

const TAB_DEFS: {
  id: 'all' | Achievement['category']
  label: string
  icon: typeof LayoutGrid
}[] = [
  { id: 'all', label: 'Todos', icon: LayoutGrid },
  { id: 'milestone', label: achievementCategoryLabel('milestone'), icon: Trophy },
  { id: 'consistency', label: achievementCategoryLabel('consistency'), icon: Flame },
  { id: 'strength', label: achievementCategoryLabel('strength'), icon: TrendingUp },
  { id: 'volume', label: achievementCategoryLabel('volume'), icon: Zap },
  { id: 'special', label: achievementCategoryLabel('special'), icon: Award },
]

const DIFFICULTY_FILTERS: {
  id: 'all' | DifficultyTierId
  label: string
}[] = [
  { id: 'all', label: 'Todos los niveles' },
  { id: 'common', label: DIFFICULTY_TIERS.common.shortLabel },
  { id: 'rare', label: DIFFICULTY_TIERS.rare.shortLabel },
  { id: 'epic', label: DIFFICULTY_TIERS.epic.shortLabel },
  { id: 'legendary', label: DIFFICULTY_TIERS.legendary.shortLabel },
]

type ProgressRecord = Record<string, number>
type StatusFilter = 'all' | 'unlocked' | 'locked'

export function AchievementsCatalog({
  achievements,
  userAchievements,
  progressById,
}: {
  achievements: Achievement[]
  userAchievements: UserAchievement[]
  progressById: ProgressRecord
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | DifficultyTierId>('all')
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null)

  const unlockedMap = useMemo(() => {
    const map = new Map<string, UserAchievement>()
    for (const ua of userAchievements) {
      map.set(ua.achievement_id, ua)
    }
    return map
  }, [userAchievements])

  const unlockedIds = useMemo(() => new Set(unlockedMap.keys()), [unlockedMap])
  const sorted = useMemo(
    () => sortAchievementsForDisplay(achievements, unlockedIds),
    [achievements, unlockedIds],
  )

  const handleShare = async (achievement: Achievement) => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://rucoach.app'
    const shareText = [
      `🏅 *Hito alcanzado en RU Coach*`,
      ``,
      `• *Logro:* ${achievement.name}`,
      `• *Recompensa:* +${achievement.xp_reward} XP`,
      achievement.description ? `• *Meta:* ${achievement.description}` : null,
      ``,
      `Entrenamiento personalizado y progreso medible. 💪`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n')

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `Hito desbloqueado: ${achievement.name} | RU Coach`,
          text: shareText,
          url: origin,
        })
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText}\n${origin}`)
        toast.success('¡Mensaje copiado al portapapeles para compartir!')
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        toast.error('No se pudo compartir el logro.')
      }
    }
  }

  const selectedUnlocked = selectedAchievement ? unlockedIds.has(selectedAchievement.id) : false
  const selectedUserAchievement = selectedAchievement
    ? unlockedMap.get(selectedAchievement.id)
    : undefined
  const selectedProgress = selectedAchievement
    ? formatAchievementProgress(
        selectedAchievement,
        progressById[selectedAchievement.id] ?? 0,
        selectedUnlocked,
      )
    : { line: '', percent: 0 }
  const selectedAction = selectedAchievement ? achievementActionMeta(selectedAchievement) : null
  const selectedDifficulty = selectedAchievement
    ? achievementDifficultyMeta(selectedAchievement.rarity)
    : null

  return (
    <>
      <Tabs defaultValue="all" className="flex w-full min-w-0 flex-col gap-5 p-2 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full min-w-0 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
              <TabsList className="inline-flex sm:flex sm:flex-wrap h-auto min-h-11 w-max sm:w-full items-center justify-start gap-1.5 bg-muted/25 p-1.5 rounded-2xl border border-border/50">
                {TAB_DEFS.map((tab) => {
                  const categoryItems =
                    tab.id === 'all'
                      ? achievements
                      : achievements.filter((a) => a.category === tab.id)
                  const unlockedInCat = categoryItems.filter((a) => unlockedIds.has(a.id)).length
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="rounded-xl px-3.5 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all gap-2 text-xs font-black uppercase tracking-wider active:scale-95 shrink-0"
                    >
                      <tab.icon className="size-3.5 shrink-0" />
                      <span>{tab.label}</span>
                      <span className="rounded-md bg-background/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums opacity-85">
                        {unlockedInCat}/{categoryItems.length}
                      </span>
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </div>

            <div
              role="group"
              aria-label="Filtrar por estado de desbloqueo"
              className="inline-flex shrink-0 self-start rounded-xl border border-border/50 bg-muted/20 p-1"
            >
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'unlocked', label: 'Completados' },
                  { id: 'locked', label: 'Por lograr' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all',
                    statusFilter === f.id
                      ? 'bg-card text-foreground shadow-sm ring-1 ring-border/60'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro por Nivel de Dificultad (Bronce, Plata, Oro, Élite) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="mr-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Shield className="size-3 text-primary" />
              Dificultad:
            </span>
            {DIFFICULTY_FILTERS.map((df) => {
              const tierItems =
                df.id === 'all'
                  ? achievements
                  : achievements.filter((a) => (a.rarity ?? 'common') === df.id)
              const unlockedInTier = tierItems.filter((a) => unlockedIds.has(a.id)).length
              const isSelected = difficultyFilter === df.id
              const tierMeta = df.id !== 'all' ? DIFFICULTY_TIERS[df.id] : null

              return (
                <button
                  key={df.id}
                  type="button"
                  onClick={() => setDifficultyFilter(df.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold transition-all',
                    isSelected
                      ? tierMeta
                        ? cn(tierMeta.badgeClass, 'ring-1 ring-current/30 shadow-xs')
                        : 'border-primary/40 bg-primary/15 text-primary shadow-xs'
                      : 'border-border/50 bg-muted/15 text-muted-foreground hover:bg-muted/35 hover:text-foreground',
                  )}
                >
                  <span>{df.label}</span>
                  <span className="rounded-md bg-background/40 px-1.5 py-0.2 text-[10px] font-black tabular-nums opacity-85">
                    {unlockedInTier}/{tierItems.length}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {TAB_DEFS.map((tab) => {
          const items = sorted.filter((a) => {
            if (tab.id !== 'all' && a.category !== tab.id) return false
            if (difficultyFilter !== 'all' && (a.rarity ?? 'common') !== difficultyFilter) {
              return false
            }
            const isUnlocked = unlockedIds.has(a.id)
            if (statusFilter === 'unlocked') return isUnlocked
            if (statusFilter === 'locked') return !isUnlocked
            return true
          })

          return (
            <TabsContent key={tab.id} value={tab.id} className="mt-0 outline-none">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 py-14 px-4 text-center">
                  <Trophy className="mb-3 size-8 text-muted-foreground/40" />
                  <p className="text-sm font-bold text-foreground">
                    No hay hitos en este filtro
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                    Cambia el nivel de dificultad, el estado o explora otra categoría para ver más desafíos.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((achievement) => {
                    const unlocked = unlockedIds.has(achievement.id)
                    const current = progressById[achievement.id] ?? 0
                    const { line, percent } = formatAchievementProgress(
                      achievement,
                      current,
                      unlocked,
                    )
                    const CategoryIcon = achievementLucideIcon(achievement)
                    const rarityColor = achievementRarityColor(achievement.rarity)
                    const difficultyMeta = achievementDifficultyMeta(achievement.rarity)
                    const isAlmostThere = !unlocked && percent >= 65

                    return (
                      <Card
                        key={achievement.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedAchievement(achievement)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedAchievement(achievement)
                          }
                        }}
                        className={cn(
                          'group relative cursor-pointer overflow-hidden rounded-2xl border-border/70 bg-card/70 shadow-none transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          unlocked &&
                            'border-primary/30 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-sm',
                          isAlmostThere && 'border-primary/25 ring-1 ring-primary/15',
                        )}
                      >
                        {unlocked && (
                          <div
                            className={cn(
                              'pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-40',
                              rarityColor,
                            )}
                            aria-hidden
                          />
                        )}

                        <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
                          <AchievementBadge
                            achievement={achievement}
                            unlocked={unlocked}
                            size="md"
                            showProgress={false}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-bold uppercase tracking-wider"
                              >
                                {achievementCategoryLabel(achievement.category)}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] font-bold',
                                  difficultyMeta.badgeClass,
                                )}
                              >
                                {difficultyMeta.fullLabel}
                              </Badge>
                              {unlocked ? (
                                <Badge
                                  className={cn(
                                    'text-[10px] font-black text-white border-none bg-gradient-to-r shadow-sm',
                                    rarityColor,
                                  )}
                                >
                                  Completado
                                </Badge>
                              ) : isAlmostThere ? (
                                <Badge className="text-[10px] font-black bg-primary/15 text-primary border border-primary/30">
                                  ¡Casi listo! {percent}%
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] tabular-nums text-muted-foreground"
                                >
                                  {percent}%
                                </Badge>
                              )}
                            </div>
                            <CardTitle className="text-base font-bold leading-tight group-hover:text-primary transition-colors">
                              {achievement.name}
                            </CardTitle>
                            {achievement.description ? (
                              <CardDescription className="mt-1 text-pretty text-xs leading-relaxed">
                                {achievement.description}
                              </CardDescription>
                            ) : null}
                          </div>
                        </CardHeader>

                        <CardContent className="flex flex-col gap-3 pt-0">
                          <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                            <CategoryIcon className="mt-0.5 size-4 shrink-0 text-primary/80" />
                            <p className="text-xs leading-snug text-muted-foreground">
                              <span className="font-semibold text-foreground">Meta: </span>
                              {line}
                            </p>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              <span>{unlocked ? 'Hito superado' : 'Progreso actual'}</span>
                              <span className="tabular-nums text-foreground">{percent}%</span>
                            </div>
                            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all duration-700 ease-out',
                                  unlocked
                                    ? 'bg-gradient-to-r from-primary to-amber-500'
                                    : 'bg-primary',
                                )}
                                style={{ width: `${percent}%` }}
                              >
                                {(unlocked || percent >= 50) && (
                                  <div className="size-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.35)_50%,transparent_100%)] animate-shimmer" />
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="inline-flex items-center gap-1 text-xs font-black tabular-nums text-primary">
                              <Sparkles className="size-3.5" />+{achievement.xp_reward} XP
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                              Ver detalle
                              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      <Dialog
        open={!!selectedAchievement}
        onOpenChange={(open) => !open && setSelectedAchievement(null)}
      >
        {selectedAchievement && (
          <DialogContent className="sm:max-w-md rounded-3xl border-border/80 bg-card/95 backdrop-blur-xl">
            <DialogHeader className="items-center text-center">
              <div className="my-3 animate-trophy-pop">
                <AchievementBadge
                  achievement={selectedAchievement}
                  unlocked={selectedUnlocked}
                  size="xl"
                  showMilestoneBadge
                />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mb-1">
                <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                  {achievementCategoryLabel(selectedAchievement.category)}
                </Badge>
                {selectedDifficulty && (
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] font-bold', selectedDifficulty.badgeClass)}
                  >
                    {selectedDifficulty.fullLabel}
                  </Badge>
                )}
                <Badge className="text-[10px] font-black bg-primary/15 text-primary border border-primary/30">
                  +{selectedAchievement.xp_reward} XP
                </Badge>
              </div>
              <DialogTitle className="text-xl font-black tracking-tight">
                {selectedAchievement.name}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground text-balance">
                {selectedAchievement.description}
              </DialogDescription>
              {selectedDifficulty && (
                <p className="text-[11px] font-medium text-muted-foreground/80">
                  {selectedDifficulty.description}
                </p>
              )}
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <div className="rounded-2xl border border-border/60 bg-muted/25 p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-foreground">
                    {selectedUnlocked ? (
                      <>
                        <CheckCircle2 className="size-4 text-success" />
                        Desbloqueado
                      </>
                    ) : (
                      <>
                        <Lock className="size-4 text-muted-foreground" />
                        En progreso
                      </>
                    )}
                  </span>
                  <span className="tabular-nums font-black text-primary">
                    {selectedProgress.percent}%
                  </span>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                    style={{ width: `${selectedProgress.percent}%` }}
                  >
                    <div className="size-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.35)_50%,transparent_100%)] animate-shimmer" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  {selectedProgress.line}
                </p>
                {selectedUnlocked && selectedUserAchievement?.unlocked_at && (
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 pt-1 border-t border-border/40">
                    Conseguido el{' '}
                    {new Date(selectedUserAchievement.unlocked_at).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>

              {selectedAction && (
                <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-3.5">
                  <p className="text-[11px] font-black uppercase tracking-wider text-primary mb-1">
                    Recomendación de tu Coach
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {selectedAction.tip}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                {selectedUnlocked ? (
                  <Button
                    type="button"
                    className="flex-1 font-bold gap-2"
                    onClick={() => handleShare(selectedAchievement)}
                  >
                    <Share2 className="size-4" />
                    Compartir logro
                  </Button>
                ) : (
                  selectedAction && (
                    <Button asChild className="flex-1 font-bold gap-2">
                      <Link
                        href={selectedAction.href}
                        onClick={() => setSelectedAchievement(null)}
                      >
                        {selectedAction.label}
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  )
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedAchievement(null)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}

