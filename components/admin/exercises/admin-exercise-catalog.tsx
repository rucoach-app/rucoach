'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Exercise } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Library, Search as SearchIcon, Eye, Pencil, ListOrdered, SlidersHorizontal, ChevronLeft, ChevronRight, Loader2, X, Dumbbell, Trash2, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { exName, exEquipment, exTargetMuscles, exInstructions } from '@/lib/exercise-i18n'
import { ExerciseDetailDrawer } from '@/components/client/exercise-detail-drawer'
import { deleteAdminExercise } from '@/app/actions/exercises'
import { toast } from 'sonner'
import { BodyMap } from '@/components/anatomy/body-map'
import { MUSCLES, MUSCLE_LABELS, type MuscleSlug } from '@/lib/anatomy/muscles'

const EQUIPMENT_FILTERS = [
  { value: 'barra', label: 'Barra' },
  { value: 'mancuerna', label: 'Mancuerna' },
  { value: 'máquina', label: 'Máquina' },
  { value: 'polea', label: 'Polea' },
  { value: 'peso corporal', label: 'Peso corporal' },
  { value: 'pesa rusa', label: 'Pesa rusa' },
  { value: 'bandas', label: 'Bandas' },
] as const

const MUSCLE_LABELS_ES: Record<string, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  quadriceps: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos',
  calves: 'Pantorrillas',
  abs: 'Abdomen',
  cardio: 'Cardio',
  full_body: 'Cuerpo completo',
  pectorals: 'Pectorales',
  lats: 'Dorsales',
  delts: 'Deltoides',
  quads: 'Cuádriceps',
  traps: 'Trapecios',
  spine: 'Espalda baja',
}

const EXERCISE_TYPE_LABELS_ES: Record<string, string> = {
  strength: 'Fuerza',
  cardio: 'Cardio',
  mobility: 'Movilidad',
  hiit: 'HIIT',
  stretching: 'Estiramiento',
}

function translateMuscleLabel(val?: string | null): string {
  if (!val) return ''
  const key = val.trim().toLowerCase()
  return MUSCLE_LABELS_ES[key] ?? val
}

function getPrimaryMuscleLabel(ex: Exercise): string | null {
  const targets = exTargetMuscles(ex)
  if (targets.length > 0) {
    return translateMuscleLabel(targets[0])
  }
  if (ex.primary_muscle) {
    return translateMuscleLabel(ex.primary_muscle)
  }
  return null
}

function getSecondaryMuscleLabel(ex: Exercise): string | null {
  if (ex.secondary_muscles_es?.length) {
    return translateMuscleLabel(ex.secondary_muscles_es[0])
  }
  if (ex.secondary_muscle) {
    return translateMuscleLabel(ex.secondary_muscle)
  }
  return null
}

interface AdminExerciseCatalogProps {
  exercises: Exercise[]
  totalCount: number
  totalPages: number
  currentPage: number
  allBodyParts: string[]
  initialFilters: {
    search: string
    bodyPart: string | null
    equipment?: string | null
    muscle?: MuscleSlug | null
  }
}

export function AdminExerciseCatalog({ 
  exercises, 
  totalCount, 
  totalPages, 
  currentPage,
  allBodyParts,
  initialFilters
}: AdminExerciseCatalogProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [search, setSearch] = useState(initialFilters.search)
  const [isPending, setIsPending] = useState(false)
  const [showMuscleMap, setShowMuscleMap] = useState(Boolean(initialFilters.muscle))
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Sync internal state with URL if it changes externally (e.g. back button)
  useEffect(() => {
    setSearch(searchParams.get('search') || '')
  }, [searchParams])

  const createQueryString = useCallback(
    (params: Record<string, string | null>) => {
      const newParams = new URLSearchParams(searchParams.toString())
      
      Object.entries(params).forEach(([name, value]) => {
        if (value === null) {
          newParams.delete(name)
        } else {
          newParams.set(name, value)
        }
      })
      
      return newParams.toString()
    },
    [searchParams]
  )

  const handleSearch = (value: string) => {
    setSearch(value)
  }

  // Debounced search update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (searchParams.get('search') || '')) {
        setIsPending(true)
        router.push(`?${createQueryString({ search: search || null, page: '1' })}`)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [search, router, createQueryString, searchParams])

  // Body part selection updates immediately
  const handleBodyPartChange = (bp: string | null) => {
    setIsPending(true)
    router.push(`?${createQueryString({ bodyPart: bp, page: '1' })}`)
  }

  const handleMuscleChange = (m: MuscleSlug | null) => {
    setIsPending(true)
    router.push(`?${createQueryString({ muscle: m, page: '1' })}`)
  }

  const handleEquipmentChange = (eq: string | null) => {
    setIsPending(true)
    router.push(`?${createQueryString({ equipment: eq, page: '1' })}`)
  }

  const handlePageChange = (page: number) => {
    setIsPending(true)
    router.push(`?${createQueryString({ page: page.toString() })}`)
  }

  useEffect(() => {
    setIsPending(false)
  }, [exercises])

  const openDetail = (ex: Exercise) => {
    const primaryLabel = getPrimaryMuscleLabel(ex)
    const secondaryLabel = getSecondaryMuscleLabel(ex)
    setDetailExercise({
      ...ex,
      target_muscles_es: ex.target_muscles_es?.length
        ? ex.target_muscles_es.map(translateMuscleLabel)
        : primaryLabel
          ? [primaryLabel]
          : undefined,
      secondary_muscles_es: ex.secondary_muscles_es?.length
        ? ex.secondary_muscles_es.map(translateMuscleLabel)
        : secondaryLabel
          ? [secondaryLabel]
          : undefined,
    })
    setDetailOpen(true)
  }

  const clearFilters = () => {
    setSearch('')
    setIsPending(true)
    router.push('?')
  }

  const handleConfirmDelete = async () => {
    if (!exerciseToDelete) return
    setIsDeleting(true)
    try {
      const res = await deleteAdminExercise(exerciseToDelete.id)
      if (!res.success) {
        toast.error(res.error || 'No se pudo eliminar el ejercicio')
        return
      }
      toast.success(`"${exName(exerciseToDelete)}" eliminado del catálogo`)
      if (detailExercise?.id === exerciseToDelete.id) {
        setDetailOpen(false)
        setDetailExercise(null)
      }
      setExerciseToDelete(null)
      router.refresh()
    } catch {
      toast.error('Error inesperado al eliminar el ejercicio')
    } finally {
      setIsDeleting(false)
    }
  }

  const activeBodyPart = searchParams.get('bodyPart')
  const activeEquipment = searchParams.get('equipment')
  const rawMuscleParam = searchParams.get('muscle')
  const activeMuscle =
    rawMuscleParam && MUSCLES.includes(rawMuscleParam as MuscleSlug)
      ? (rawMuscleParam as MuscleSlug)
      : null
  const hasActiveFilters = Boolean(search.trim() || activeBodyPart || activeEquipment || activeMuscle)

  const getEditHref = (exerciseId: string) => {
    const qs = searchParams.toString()
    const returnTo = qs ? `/admin/exercises?${qs}` : '/admin/exercises'
    return `/admin/exercises/${encodeURIComponent(exerciseId)}/edit?returnTo=${encodeURIComponent(returnTo)}`
  }

  return (
    <>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(96px+1.5rem)] lg:col-span-4 lg:self-start xl:col-span-3 pb-4">
          <div className="relative overflow-hidden rounded-[1.25rem] border border-border/60 bg-gradient-to-b from-card to-card/50 shadow-sm backdrop-blur-xl transition-all duration-300 hover:shadow-md">
            <div
              className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-3xl transition-opacity duration-500"
              aria-hidden
            />
            <div className="relative flex flex-col gap-6 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-inner border border-primary/10">
                    <Library className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold tracking-tight text-foreground">Biblioteca</p>
                      {isPending && <Loader2 className="size-3.5 animate-spin text-primary" />}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mt-0.5">Filtra sin perder contexto</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={showMuscleMap || activeMuscle ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 rounded-xl px-2.5 text-xs font-bold"
                  onClick={() => setShowMuscleMap((v) => !v)}
                >
                  <Activity className="size-3.5" />
                  <span>Mapa</span>
                </Button>
              </div>

              {(showMuscleMap || activeMuscle) && (
                <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Explorador Anatómico
                    </span>
                    {activeMuscle && (
                      <button
                        type="button"
                        onClick={() => handleMuscleChange(null)}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary"
                      >
                        {MUSCLE_LABELS[activeMuscle]}
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                  <BodyMap
                    bare
                    mode="volume"
                    load={activeMuscle ? { [activeMuscle]: 1 } : {}}
                    selected={activeMuscle}
                    onSelect={(m) => handleMuscleChange(m === activeMuscle ? null : m)}
                  />
                  <div className="mchips mt-2.5">
                    {MUSCLES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleMuscleChange(m === activeMuscle ? null : m)}
                        className={`mchip ${activeMuscle === m ? 'sel' : ''}`}
                      >
                        {MUSCLE_LABELS[m]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative group">
                <SearchIcon
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground/80 transition-colors group-focus-within:text-primary"
                  aria-hidden
                />
                <Input
                  placeholder="Buscar por nombre…"
                  className="h-12 w-full rounded-xl border-border/70 bg-background/50 pl-11 pr-9 shadow-sm transition-all focus-visible:border-primary/50 focus-visible:bg-background focus-visible:ring-4 focus-visible:ring-primary/10 text-sm"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  aria-label="Buscar ejercicios"
                />
                {search && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Limpiar búsqueda"
                    className="absolute right-1.5 top-1/2 size-8 -translate-y-1/2 rounded-full hover:bg-transparent"
                    onClick={() => handleSearch('')}
                  >
                    <X className="size-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <SlidersHorizontal className="size-3.5" aria-hidden />
                  Zona muscular
                </p>
                <div className="flex max-h-[min(40vh,16rem)] flex-wrap gap-2 overflow-y-auto pr-1 pb-1 lg:max-h-[min(50vh,20rem)] scrollbar-hide">
                  <Badge
                    role="button"
                    tabIndex={0}
                    variant={!activeBodyPart ? 'default' : 'secondary'}
                    className={cn(
                      'min-h-[36px] items-center justify-center shrink-0 cursor-pointer rounded-full px-4 text-[13px] font-medium transition-all active:scale-95 border-transparent',
                      !activeBodyPart 
                        ? 'shadow-md shadow-primary/20 bg-primary leading-none text-primary-foreground hover:bg-primary/95 hover:shadow-lg' 
                        : 'bg-muted/60 text-muted-foreground hover:bg-secondary hover:text-secondary-foreground',
                    )}
                    onClick={() => handleBodyPartChange(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleBodyPartChange(null)
                      }
                    }}
                  >
                    Todas
                  </Badge>
                  {allBodyParts.map((bp) => {
                    const isActive = activeBodyPart === bp;
                    return (
                      <Badge
                        key={bp}
                        role="button"
                        tabIndex={0}
                        variant={isActive ? 'default' : 'outline'}
                        className={cn(
                          "min-h-[36px] items-center justify-center shrink-0 cursor-pointer rounded-full px-4 text-[13px] font-medium capitalize transition-all active:scale-95",
                          isActive 
                            ? 'shadow-md shadow-primary/20 bg-primary leading-none text-primary-foreground hover:bg-primary/95 hover:shadow-lg border-transparent'
                            : 'bg-background/50 hover:bg-secondary/60 text-muted-foreground hover:text-foreground border-border/60 hover:border-border'
                        )}
                        onClick={() => handleBodyPartChange(isActive ? null : bp)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleBodyPartChange(isActive ? null : bp)
                          }
                        }}
                      >
                        {bp}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Dumbbell className="size-3.5" aria-hidden />
                  Equipamiento
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    role="button"
                    tabIndex={0}
                    variant={!activeEquipment ? 'default' : 'secondary'}
                    className={cn(
                      'min-h-[36px] items-center justify-center shrink-0 cursor-pointer rounded-full px-4 text-[13px] font-medium transition-all active:scale-95 border-transparent',
                      !activeEquipment
                        ? 'shadow-md shadow-primary/20 bg-primary leading-none text-primary-foreground hover:bg-primary/95 hover:shadow-lg'
                        : 'bg-muted/60 text-muted-foreground hover:bg-secondary hover:text-secondary-foreground',
                    )}
                    onClick={() => handleEquipmentChange(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleEquipmentChange(null)
                      }
                    }}
                  >
                    Todos
                  </Badge>
                  {EQUIPMENT_FILTERS.map((eq) => {
                    const isActive = activeEquipment === eq.value
                    return (
                      <Badge
                        key={eq.value}
                        role="button"
                        tabIndex={0}
                        variant={isActive ? 'default' : 'outline'}
                        className={cn(
                          'min-h-[36px] items-center justify-center shrink-0 cursor-pointer rounded-full px-4 text-[13px] font-medium transition-all active:scale-95',
                          isActive
                            ? 'shadow-md shadow-primary/20 bg-primary leading-none text-primary-foreground hover:bg-primary/95 hover:shadow-lg border-transparent'
                            : 'bg-background/50 hover:bg-secondary/60 text-muted-foreground hover:text-foreground border-border/60 hover:border-border',
                        )}
                        onClick={() => handleEquipmentChange(isActive ? null : eq.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleEquipmentChange(isActive ? null : eq.value)
                          }
                        }}
                      >
                        {eq.label}
                      </Badge>
                    )
                  })}
                </div>
              </div>

              {hasActiveFilters ? (
                <div className="pt-2 border-t border-border/50">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-10 w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors font-medium rounded-xl"
                    onClick={clearFilters}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <p className="hidden text-xs leading-relaxed text-muted-foreground lg:block text-pretty">
            Vista muestra hasta tres columnas en pantallas anchas. Usa la ficha para GIF, técnica y notas.
          </p>
        </aside>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8 xl:col-span-9">
          <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border/50 bg-card/20 p-4 sm:flex-row sm:items-center sm:justify-between px-5 shadow-sm">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Mostrando <span className="tabular-nums font-semibold text-foreground">{exercises.length}</span>
                <span className="mx-1.5 text-border/80">/</span>
                <span className="tabular-nums font-semibold text-foreground">{totalCount}</span>
                <span className="ml-1.5">ejercicios</span>
              </p>
              {(activeBodyPart || activeEquipment) ? (
                <div className="flex flex-wrap items-center gap-3 mt-0.5">
                  {activeBodyPart ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                      Zona muscular: <span className="font-semibold text-foreground capitalize">{activeBodyPart}</span>
                    </p>
                  ) : null}
                  {activeEquipment ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                      Equipamiento: <span className="font-semibold text-foreground capitalize">{activeEquipment}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 rounded-[0.875rem] border border-border/60 bg-background/60 p-1 shadow-sm backdrop-blur-sm self-start sm:self-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  disabled={currentPage <= 1 || isPending}
                  onClick={() => handlePageChange(currentPage - 1)}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="flex h-8 items-center px-3 text-xs font-semibold tabular-nums text-foreground">
                  <span className="text-muted-foreground mr-1">Pág.</span> {currentPage} 
                  <span className="text-muted-foreground font-normal mx-1">de</span> {totalPages}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  disabled={currentPage >= totalPages || isPending}
                  onClick={() => handlePageChange(currentPage + 1)}
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {exercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/10 px-4 py-16 text-center ring-1 ring-primary/5">
              <p className="font-medium text-foreground">Sin resultados</p>
              <p className="max-w-sm text-sm text-muted-foreground text-pretty">
                Prueba otra búsqueda o quita filtros de zona o equipamiento.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 transition-opacity duration-200",
                  isPending ? "opacity-50 pointer-events-none" : "opacity-100"
                )}
                role="list"
              >
                {exercises.map((ex) => (
                  <article
                    key={ex.id}
                    role="listitem"
                    className={cn(
                      'group flex flex-col overflow-hidden rounded-[1.25rem] border border-border/60 bg-card shadow-sm',
                      'ring-1 ring-primary/0 transition-all duration-300 ease-out',
                      'hover:border-primary/25 hover:ring-primary/10 hover:shadow-md hover:-translate-y-0.5',
                    )}
                  >
                    <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-muted/20 border-b border-border/40">
                      {ex.gif_url ? (
                         
                        <img
                          src={ex.gif_url}
                          alt=""
                          className="size-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                          loading="lazy"
                        />
                      ) : ex.image_url ? (
                         
                        <img
                          src={ex.image_url}
                          alt=""
                          className="size-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-muted/30 text-xs font-medium text-muted-foreground/60">
                          Sin preview
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-4">
                      <h3 className="line-clamp-2 font-bold capitalize leading-snug text-foreground tracking-tight">
                        {exName(ex)}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                        {getPrimaryMuscleLabel(ex) ? (
                          <Badge variant="secondary" className="text-[10px] font-semibold capitalize bg-secondary/60 text-secondary-foreground px-2 py-0 border-transparent">
                            {getPrimaryMuscleLabel(ex)}
                          </Badge>
                        ) : null}
                        {getSecondaryMuscleLabel(ex) ? (
                          <Badge variant="outline" className="text-[10px] capitalize px-2 py-0 font-medium text-muted-foreground border-border/60 bg-background/50">
                            {getSecondaryMuscleLabel(ex)}
                          </Badge>
                        ) : null}
                        {ex.exercise_type ? (
                          <Badge variant="outline" className="text-[10px] capitalize px-2 py-0 font-medium text-muted-foreground border-border/60 bg-background/50">
                            {EXERCISE_TYPE_LABELS_ES[ex.exercise_type.toLowerCase()] ?? ex.exercise_type}
                          </Badge>
                        ) : null}
                        {exInstructions(ex).length > 0 ? (
                          <Badge variant="outline" className="text-[10px] px-2 py-0 font-semibold text-primary border-primary/25 bg-primary/5 inline-flex items-center gap-1">
                            <ListOrdered className="size-2.5" aria-hidden />
                            {exInstructions(ex).length} pasos
                          </Badge>
                        ) : null}
                      </div>
                      {exEquipment(ex) ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground font-medium mt-0.5">{exEquipment(ex)}</p>
                      ) : null}
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="min-h-[40px] flex-1 rounded-xl font-semibold bg-secondary/80 hover:bg-secondary transition-colors"
                          onClick={() => openDetail(ex)}
                        >
                          <Eye className="size-4 mr-1.5 text-muted-foreground" aria-hidden="true" />
                          Ver ficha
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="min-h-[40px] flex-1 rounded-xl font-semibold border-border/70 hover:bg-muted/60 transition-colors"
                        >
                          <Link href={getEditHref(ex.id)}>
                            <Pencil className="size-3.5 mr-1.5 text-muted-foreground" aria-hidden="true" />
                            Editar
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="min-h-[40px] size-10 shrink-0 rounded-xl border-border/70 text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive transition-colors"
                          onClick={() => setExerciseToDelete(ex)}
                          aria-label={`Eliminar ${exName(ex)}`}
                          title="Eliminar ejercicio"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl px-4 hover:bg-muted font-medium transition-colors"
                    disabled={currentPage <= 1 || isPending}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    <ChevronLeft className="mr-2 size-4 text-muted-foreground" />
                    Anterior
                  </Button>
                  
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = currentPage - 2 + i
                      if (currentPage <= 2) pageNum = i + 1
                      if (currentPage >= totalPages - 1) pageNum = totalPages - 4 + i
                      
                      if (pageNum > 0 && pageNum <= totalPages) {
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'ghost'}
                            size="sm"
                            className="size-10 rounded-xl"
                            onClick={() => handlePageChange(pageNum)}
                            disabled={isPending}
                          >
                            {pageNum}
                          </Button>
                        )
                      }
                      return null
                    })}
                  </div>

                  <Button
                    variant="outline"
                    className="h-10 rounded-xl px-4 hover:bg-muted font-medium transition-colors"
                    disabled={currentPage >= totalPages || isPending}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    Siguiente
                    <ChevronRight className="ml-2 size-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ExerciseDetailDrawer
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setDetailExercise(null)
        }}
        exercise={detailExercise}
        variant="default"
        editHref={detailExercise ? getEditHref(detailExercise.id) : undefined}
      />

      <AlertDialog
        open={Boolean(exerciseToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setExerciseToDelete(null)
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ejercicio del catálogo?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás por eliminar permanentemente{' '}
              <span className="font-semibold text-foreground capitalize">
                {exerciseToDelete ? exName(exerciseToDelete) : ''}
              </span>
              . Si está asignado a una rutina o historial de entrenamiento, no se podrá eliminar para proteger los registros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={isDeleting}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Eliminando…
                </>
              ) : (
                'Sí, eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
