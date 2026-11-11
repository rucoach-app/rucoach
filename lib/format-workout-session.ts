/** Etiquetas de sesión para admin/cliente (es-ES). */

import { DEFAULT_TIMEZONE, parseRecordedDate } from '@/lib/calendar-date'

/** Fecha de medición: soporta ISO o solo `YYYY-MM-DD` sin bug UTC. */
export function formatBodyMeasurementDate(recordedAt?: string | null): string {
  if (!recordedAt?.trim()) return '—'
  const d = parseRecordedDate(recordedAt.trim())
  const raw = d.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function sessionInstantLabel(
  iso?: string | null,
  timeZone: string = DEFAULT_TIMEZONE,
): {
  dateLine: string
  timeLine: string | null
} {
  if (!iso) return { dateLine: 'Sin fecha', timeLine: null }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { dateLine: 'Sin fecha', timeLine: null }
  const raw = d.toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  })
  const dateLine = raw.charAt(0).toUpperCase() + raw.slice(1)
  const timeLine = d.toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
  return { dateLine, timeLine }
}

export function workoutStatusLabelEs(status: string): string {
  const s = status.toLowerCase()
  if (s === 'completed') return 'Completada'
  if (s === 'in_progress' || s === 'active') return 'En curso'
  if (s === 'abandoned' || s === 'cancelled' || s === 'canceled') return 'Abandonada'
  return status.replace(/_/g, ' ')
}

export function workoutStatusBadgeClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'completed')
    return 'border-success/35 bg-success/15 text-success hover:bg-success/20'
  if (s === 'in_progress' || s === 'active')
    return 'border-primary/40 bg-primary/10 text-primary'
  if (s === 'abandoned' || s === 'cancelled' || s === 'canceled')
    return 'border-muted-foreground/30 bg-muted text-muted-foreground'
  return 'border-border bg-muted/50 text-foreground'
}
