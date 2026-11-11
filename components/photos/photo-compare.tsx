'use client'

import * as React from 'react'
import { ImageCompareSlider } from '@/components/ui/image-compare-slider'
import { type ProgressPhoto } from './photo-card'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Layers,
  Calendar,
  Weight,
  Filter,
  ArrowLeftRight,
  Clock,
  TrendingDown,
  TrendingUp,
  Eye,
  UploadCloud,
} from 'lucide-react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { parseRecordedDate } from '@/lib/calendar-date'

interface PhotoCompareProps {
  photos: ProgressPhoto[]
  onRequestUpload?: () => void
}

type ViewFilter = 'all' | 'front' | 'side' | 'back' | 'other'

const VIEW_FILTER_OPTIONS: { value: ViewFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'front', label: 'Frente' },
  { value: 'side', label: 'Perfil' },
  { value: 'back', label: 'Espalda' },
  { value: 'other', label: 'Otra' },
]

const VIEW_LABELS: Record<string, string> = {
  front: 'Frente',
  side: 'Perfil',
  back: 'Espalda',
  other: 'Otra',
}

function getViewLabel(viewType: string | null | undefined): string {
  if (!viewType) return 'Otra'
  return VIEW_LABELS[viewType] || viewType
}

function parseTakenDate(dateStr: string): Date {
  return parseRecordedDate(dateStr)
}

export function PhotoCompare({ photos, onRequestUpload }: PhotoCompareProps) {
  const [viewFilter, setViewFilter] = React.useState<ViewFilter>('all')
  const [beforeId, setBeforeId] = React.useState<string | null>(null)
  const [afterId, setAfterId] = React.useState<string | null>(null)
  const [beforeMonth, setBeforeMonth] = React.useState<string>('all')
  const [afterMonth, setAfterMonth] = React.useState<string>('all')

  const sortedPhotos = React.useMemo(() => {
    return [...photos].sort(
      (a, b) =>
        parseTakenDate(a.taken_at).getTime() -
        parseTakenDate(b.taken_at).getTime()
    )
  }, [photos])

  const viewCounts = React.useMemo(() => {
    const counts: Record<ViewFilter, number> = {
      all: sortedPhotos.length,
      front: 0,
      side: 0,
      back: 0,
      other: 0,
    }
    sortedPhotos.forEach((p) => {
      const key = (
        p.view_type && ['front', 'side', 'back', 'other'].includes(p.view_type)
          ? p.view_type
          : 'other'
      ) as Exclude<ViewFilter, 'all'>
      counts[key] += 1
    })
    return counts
  }, [sortedPhotos])

  const angleFilteredPhotos = React.useMemo(() => {
    if (viewFilter === 'all') return sortedPhotos
    return sortedPhotos.filter((p) => (p.view_type || 'other') === viewFilter)
  }, [sortedPhotos, viewFilter])

  const availableMonths = React.useMemo(() => {
    const m = new Set<string>()
    angleFilteredPhotos.forEach((p) =>
      m.add(format(parseTakenDate(p.taken_at), 'yyyy-MM'))
    )
    return Array.from(m).sort().reverse()
  }, [angleFilteredPhotos])

  const handleViewFilterChange = (nextFilter: ViewFilter) => {
    setViewFilter(nextFilter)
    setBeforeMonth('all')
    setAfterMonth('all')

    const matching =
      nextFilter === 'all'
        ? sortedPhotos
        : sortedPhotos.filter((p) => (p.view_type || 'other') === nextFilter)

    if (matching.length >= 2) {
      setBeforeId(matching[0].id)
      setAfterId(matching[matching.length - 1].id)
    } else if (matching.length === 1) {
      setBeforeId(matching[0].id)
      setAfterId(matching[0].id)
    }
  }

  const handleSwapPhotos = () => {
    if (!beforeId && !afterId) return
    setBeforeId(afterId)
    setAfterId(beforeId)
  }

  // Auto-select first and last if not set or if selected photo was deleted
  React.useEffect(() => {
    if (angleFilteredPhotos.length < 2) return
    const hasBefore =
      beforeId && angleFilteredPhotos.some((p) => p.id === beforeId)
    const hasAfter =
      afterId && angleFilteredPhotos.some((p) => p.id === afterId)
    if (!hasBefore) {
      setBeforeId(angleFilteredPhotos[0].id)
    }
    if (!hasAfter) {
      setAfterId(angleFilteredPhotos[angleFilteredPhotos.length - 1].id)
    }
  }, [angleFilteredPhotos, beforeId, afterId])

  const before = photos.find((p) => p.id === beforeId)
  const after = photos.find((p) => p.id === afterId)

  const daysDiff = React.useMemo(() => {
    if (!before || !after) return 0
    const msPerDay = 1000 * 60 * 60 * 24
    const start = parseTakenDate(before.taken_at).getTime()
    const end = parseTakenDate(after.taken_at).getTime()
    return Math.round(Math.abs(end - start) / msPerDay)
  }, [before, after])

  const weightDiff = React.useMemo(() => {
    if (
      !before ||
      !after ||
      before.weight_kg === null ||
      before.weight_kg === undefined ||
      after.weight_kg === null ||
      after.weight_kg === undefined
    ) {
      return null
    }
    return Number((after.weight_kg - before.weight_kg).toFixed(1))
  }, [before, after])

  if (photos.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center border-2 border-dashed rounded-3xl bg-muted/20">
        <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Layers className="size-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Necesitas más fotos</h3>
        <p className="text-muted-foreground max-w-xs mx-auto mb-6">
          Sube al menos dos fotos para poder comparar tu evolución visual.
        </p>
        {onRequestUpload && (
          <Button
            type="button"
            onClick={onRequestUpload}
            className="rounded-xl font-semibold shadow-md shadow-primary/20"
          >
            <UploadCloud className="mr-2 size-4" />
            Subir foto ahora
          </Button>
        )}
      </div>
    )
  }

  const renderPhotoSelector = (
    label: string,
    currentId: string | null,
    setter: (id: string) => void,
    monthFilter: string,
    setMonthFilter: (m: string) => void
  ) => {
    const filtered =
      monthFilter === 'all'
        ? angleFilteredPhotos
        : angleFilteredPhotos.filter(
            (p) => format(parseTakenDate(p.taken_at), 'yyyy-MM') === monthFilter
          )

    const currentPhoto = currentId
      ? photos.find((p) => p.id === currentId)
      : null

    return (
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex flex-col">
            <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            {currentPhoto && (
              <span className="text-xs font-semibold text-primary">
                {format(parseTakenDate(currentPhoto.taken_at), 'd MMM, yyyy', {
                  locale: es,
                })}{' '}
                • {getViewLabel(currentPhoto.view_type)}
              </span>
            )}
          </div>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <Filter className="size-3 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ver todas</SelectItem>
              {availableMonths.map((m) => {
                const [year, month] = m.split('-')
                const date = new Date(parseInt(year), parseInt(month) - 1)
                return (
                  <SelectItem key={m} value={m}>
                    {format(date, 'MMMM yyyy', { locale: es })}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
        <ScrollArea className="w-full whitespace-nowrap rounded-[1.2rem] border border-border/50 bg-card/40 p-2.5 shadow-sm">
          {filtered.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground italic">
              No hay fotos en este filtro
            </div>
          ) : (
            <div className="flex gap-2.5">
              {filtered.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setter(photo.id)}
                  className={cn(
                    'relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-[0.85rem] border-2 transition-all',
                    currentId === photo.id
                      ? 'border-primary ring-2 ring-primary/30 ring-offset-1 ring-offset-background scale-[0.98]'
                      : 'border-transparent hover:border-border/80 opacity-70 hover:opacity-100 hover:scale-100'
                  )}
                >
                  <Image
                    src={photo.photo_url}
                    alt="Miniatura"
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-4 text-[9px] font-bold text-white text-center">
                    {format(parseTakenDate(photo.taken_at), 'dd/MM/yy')}
                  </div>
                </button>
              ))}
            </div>
          )}
          <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Angle Filter Bar + Swap Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/50 p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {VIEW_FILTER_OPTIONS.map((option) => {
            const count = viewCounts[option.value]
            const isActive = viewFilter === option.value
            return (
              <Button
                key={option.value}
                type="button"
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewFilterChange(option.value)}
                className={cn(
                  'h-8 rounded-xl px-3 text-xs font-semibold shrink-0 transition-all',
                  !isActive && 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{option.label}</span>
                <span
                  className={cn(
                    'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none',
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              </Button>
            )
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSwapPhotos}
          disabled={!before || !after}
          className="h-8 rounded-xl text-xs font-semibold shrink-0"
        >
          <ArrowLeftRight className="mr-1.5 size-3.5" />
          Intercambiar Antes ↔ Después
        </Button>
      </div>

      {angleFilteredPhotos.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed rounded-3xl bg-muted/20">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            Tienes {angleFilteredPhotos.length}{' '}
            {angleFilteredPhotos.length === 1 ? 'foto' : 'fotos'} en la vista{' '}
            <span className="font-bold text-foreground">
              {VIEW_FILTER_OPTIONS.find((o) => o.value === viewFilter)?.label}
            </span>
            . Se recomiendan al menos 2 para comparar el mismo ángulo.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-xl text-xs font-semibold"
              onClick={() => handleViewFilterChange('all')}
            >
              Ver todas las vistas
            </Button>
            {onRequestUpload && (
              <Button
                type="button"
                size="sm"
                className="rounded-xl text-xs font-semibold"
                onClick={onRequestUpload}
              >
                <UploadCloud className="mr-1.5 size-3.5" />
                Subir foto ahora
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Selectors Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {renderPhotoSelector(
              'Estado Inicial (Antes)',
              beforeId,
              setBeforeId,
              beforeMonth,
              setBeforeMonth
            )}
            {renderPhotoSelector(
              'Estado Actual (Después)',
              afterId,
              setAfterId,
              afterMonth,
              setAfterMonth
            )}
          </div>

          {/* Comparison Tool */}
          {before && after && (
            <div className="space-y-6">
              {/* Transformation Summary Card */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Clock className="size-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Resumen de Transformación
                      </p>
                      <p className="text-sm font-bold text-foreground">
                        {daysDiff === 0
                          ? 'Mismo día'
                          : daysDiff === 1
                            ? '1 día de diferencia'
                            : `${daysDiff} días de diferencia`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {weightDiff !== null && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'gap-1.5 rounded-xl px-3 py-1 text-xs font-bold',
                          weightDiff < 0
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : weightDiff > 0
                              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                              : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {weightDiff < 0 ? (
                          <TrendingDown className="size-3.5" />
                        ) : weightDiff > 0 ? (
                          <TrendingUp className="size-3.5" />
                        ) : (
                          <Weight className="size-3.5" />
                        )}
                        <span>
                          {weightDiff > 0
                            ? `+${weightDiff.toFixed(1)} kg`
                            : `${weightDiff.toFixed(1)} kg`}
                        </span>
                      </Badge>
                    )}

                    <Badge
                      variant="outline"
                      className="gap-1.5 rounded-xl bg-background/80 px-3 py-1 text-xs font-semibold"
                    >
                      <Eye className="size-3.5 text-primary" />
                      <span>
                        {before.view_type === after.view_type
                          ? `Vista: ${getViewLabel(before.view_type)}`
                          : `${getViewLabel(before.view_type)} → ${getViewLabel(after.view_type)}`}
                      </span>
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border bg-card shadow-2xl max-w-md mx-auto w-full">
                <ImageCompareSlider
                  beforeImage={before.photo_url}
                  afterImage={after.photo_url}
                  className="aspect-[3/4] max-w-md mx-auto w-full"
                />
              </div>

              {/* Stats Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4" />
                      <span className="text-xs font-medium uppercase">
                        Fecha Inicio
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {getViewLabel(before.view_type)}
                    </Badge>
                  </div>
                  <p className="text-lg font-bold">
                    {format(parseTakenDate(before.taken_at), "d 'de' MMMM", {
                      locale: es,
                    })}
                  </p>
                  {before.weight_kg && (
                    <div className="flex items-center gap-1.5 text-primary font-semibold">
                      <Weight className="size-4" />
                      <span>{before.weight_kg} kg</span>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-2xl border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4" />
                      <span className="text-xs font-medium uppercase">
                        Fecha Actual
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {getViewLabel(after.view_type)}
                    </Badge>
                  </div>
                  <p className="text-lg font-bold">
                    {format(parseTakenDate(after.taken_at), "d 'de' MMMM", {
                      locale: es,
                    })}
                  </p>
                  {after.weight_kg && (
                    <div className="flex items-center gap-1.5 text-primary font-semibold">
                      <Weight className="size-4" />
                      <span>{after.weight_kg} kg</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Detailed Info */}
              {(before.notes || after.notes) && (
                <div className="grid gap-4 md:grid-cols-2">
                  {before.notes && (
                    <div className="text-sm italic text-muted-foreground bg-muted/30 p-3 rounded-xl border">
                      &quot;{before.notes}&quot;
                    </div>
                  )}
                  {after.notes && (
                    <div className="text-sm italic text-muted-foreground bg-muted/30 p-3 rounded-xl border">
                      &quot;{after.notes}&quot;
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

