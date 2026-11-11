'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import {
  Upload,
  Loader2,
  X,
  Camera,
  CheckCircle2,
  Sparkles,
  Calendar,
  Scale,
  User,
  Eye,
} from 'lucide-react'
import { getR2PresignedUrl } from '@/app/actions/r2-storage'
import { R2_PUBLIC_URL } from '@/lib/constants'
import type { ProgressPhoto } from './photo-card'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const PHOTO_VIEW_TYPES = [
  { value: 'front', label: 'Frente', hint: 'Vista frontal' },
  { value: 'side', label: 'Perfil', hint: 'Vista lateral' },
  { value: 'back', label: 'Espalda', hint: 'Vista posterior' },
  { value: 'other', label: 'Otra', hint: 'Pose libre' },
] as const

const QUICK_NOTE_CHIPS = [
  'En ayunas',
  'Post-entreno (Pump)',
  'Luz natural',
  'Check-in semanal',
] as const

const MAX_INPUT_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
const MAX_FALLBACK_RAW_SIZE = 10 * 1024 * 1024 // 10 MB
const COMPRESS_THRESHOLD_BYTES = 1.2 * 1024 * 1024 // 1.2 MB
const MAX_IMAGE_DIMENSION = 1800

function getLocalToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function loadImageSource(file: File): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  cleanup: () => void
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      }
    } catch {
      // Fallback to HTMLImageElement if createImageBitmap fails on specific mobile formats
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('No se pudo decodificar la imagen en el navegador'))
    }
    img.src = objectUrl
  })
}

export async function compressImageForUpload(file: File): Promise<File> {
  try {
    const { source, width, height, cleanup } = await loadImageSource(file)
    try {
      const longestSide = Math.max(width, height)
      const isWebReadyMime = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)

      if (
        longestSide <= MAX_IMAGE_DIMENSION &&
        file.size <= COMPRESS_THRESHOLD_BYTES &&
        isWebReadyMime
      ) {
        return file
      }

      const scale = longestSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longestSide : 1
      const targetWidth = Math.max(1, Math.round(width * scale))
      const targetHeight = Math.max(1, Math.round(height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Contexto 2D no disponible')
      }

      ctx.drawImage(source, 0, 0, targetWidth, targetHeight)

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.85)
      })

      if (!blob) {
        throw new Error('No se pudo generar la imagen comprimida')
      }

      const baseName = file.name.replace(/\.[^.]+$/, '') || 'progress-photo'
      return new File([blob], `${baseName}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })
    } finally {
      cleanup()
    }
  } catch {
    if (file.size < MAX_FALLBACK_RAW_SIZE) {
      return file
    }
    throw new Error(
      'No se pudo optimizar este formato de imagen automáticamente y supera los 10 MB. Intenta con JPG o PNG.'
    )
  }
}

export function PhotoUpload({
  clientId,
  onSuccess,
  latestWeightKg = null,
  selectedViewType,
  onViewTypeChange,
}: {
  clientId: string
  onSuccess: (photo: ProgressPhoto) => void
  latestWeightKg?: number | null
  selectedViewType?: string
  onViewTypeChange?: (viewType: string) => void
}) {
  const [internalViewType, setInternalViewType] = React.useState<string>('front')
  const viewType = selectedViewType ?? internalViewType
  const setViewType = React.useCallback(
    (next: string) => {
      setInternalViewType(next)
      onViewTypeChange?.(next)
    },
    [onViewTypeChange]
  )

  const [takenAt, setTakenAt] = React.useState<string>(() => getLocalToday())
  const [weightKg, setWeightKg] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [file, setFile] = React.useState<File | null>(null)
  const [originalSize, setOriginalSize] = React.useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [isCompressing, setIsCompressing] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [dragActive, setDragActive] = React.useState(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (f: File) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ]
    const isImageFile =
      f.type.startsWith('image/') ||
      allowedMimeTypes.includes(f.type) ||
      /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)

    if (!isImageFile) {
      setError('Formato no válido. Usa una imagen (JPG, PNG, WebP o HEIC).')
      return
    }
    if (f.size > MAX_INPUT_FILE_SIZE) {
      setError('El archivo es demasiado grande (máx 25 MB).')
      return
    }

    setError(null)
    setIsCompressing(true)
    setOriginalSize(f.size)

    try {
      const optimizedFile = await compressImageForUpload(f)
      setFile(optimizedFile)

      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(optimizedFile)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'No se pudo procesar la foto seleccionada.'
      setError(message)
      setFile(null)
      setPreviewUrl(null)
    } finally {
      setIsCompressing(false)
    }
  }

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFile(e.dataTransfer.files[0])
    }
  }

  const toggleNoteChip = (chip: string) => {
    setNotes((prev) => {
      const trimmed = prev.trim()
      if (!trimmed) return chip
      const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean)
      if (parts.includes(chip)) {
        return parts.filter((p) => p !== chip).join(', ')
      }
      return `${trimmed}, ${chip}`
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setIsUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `${crypto.randomUUID()}.${ext}`
      const path = `progress/clients/${clientId}/${fileName}`
      const contentType = file.type || 'image/jpeg'

      const signedUrl = await getR2PresignedUrl(path, contentType)

      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': contentType,
        },
      })

      if (!uploadRes.ok) throw new Error('Error al subir a R2')

      const publicUrl = `${R2_PUBLIC_URL}/${path}`
      const selectedDate = takenAt || getLocalToday()

      const { data: row, error: insertError } = await supabase
        .from('progress_photos')
        .insert({
          client_id: clientId,
          photo_url: publicUrl,
          view_type: viewType,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          notes: notes.trim() || null,
          taken_at: `${selectedDate.slice(0, 10)}T12:00:00Z`,
        })
        .select()
        .single()

      if (insertError) throw insertError

      onSuccess(row as ProgressPhoto)
      setFile(null)
      setOriginalSize(null)
      setPreviewUrl(null)
      setWeightKg('')
      setNotes('')
      setTakenAt(getLocalToday())
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al subir la imagen'
      setError(message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.heic,.heif"
        onChange={(e) => {
          const selected = e.target.files?.[0]
          if (selected) void handleFile(selected)
          e.target.value = ''
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const selected = e.target.files?.[0]
          if (selected) void handleFile(selected)
          e.target.value = ''
        }}
      />

      {/* Dropzone or Compact Preview */}
      {isCompressing ? (
        <div className="flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Loader2 className="size-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">Optimizando foto...</p>
            <p className="text-xs text-muted-foreground">
              Ajustando resolución para una subida instantánea sin perder nitidez
            </p>
          </div>
        </div>
      ) : previewUrl && file ? (
        <div className="grid gap-4 rounded-2xl border border-primary/25 bg-muted/20 p-4 sm:grid-cols-[150px_1fr] sm:items-center">
          <div className="relative mx-auto aspect-[3/4] w-36 overflow-hidden rounded-xl border border-border/60 bg-black/40 sm:w-full">
            <Image
              src={previewUrl}
              alt="Vista previa de progreso"
              fill
              className="object-contain"
            />
          </div>
          <div className="flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="size-3.5 shrink-0" />
                <span>Lista para subir ({formatFileSize(file.size)})</span>
              </div>
              {originalSize && originalSize > file.size && (
                <p className="text-xs text-muted-foreground">
                  Peso original: {formatFileSize(originalSize)} · Optimización automática aplicada
                </p>
              )}
              <p className="text-xs font-medium text-muted-foreground">
                Verifica el ángulo, la fecha y el peso antes de guardar tu registro.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 rounded-xl text-xs font-semibold"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="mr-1.5 size-3.5" />
                Cambiar foto
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  setFile(null)
                  setOriginalSize(null)
                  setPreviewUrl(null)
                }}
              >
                <X className="mr-1.5 size-3.5" />
                Quitar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'group relative flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-6 text-center transition-all',
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-border/70 bg-muted/15 hover:border-primary/50 hover:bg-muted/30'
          )}
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDragOver={onDrag}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
            <Upload className="size-6" />
          </div>
          <p className="text-base font-bold tracking-tight text-foreground">
            Suelta tu foto aquí o selecciónala
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Compatible con galería o cámara directa en móvil y escritorio
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 rounded-xl px-3.5 text-xs font-semibold shadow-sm"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              <Upload className="mr-1.5 size-3.5" />
              Explorar galería
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl px-3.5 text-xs font-semibold sm:hidden"
              onClick={(e) => {
                e.stopPropagation()
                cameraInputRef.current?.click()
              }}
            >
              <Camera className="mr-1.5 size-3.5" />
              Tomar foto
            </Button>
          </div>
          <p className="mt-3 text-[11px] font-medium text-muted-foreground/80">
            JPG, PNG, WebP, HEIC • Compresión inteligente automática (hasta 25 MB)
          </p>
        </div>
      )}

      {/* Visual Angle Selector */}
      <FieldGroup className="space-y-4">
        <Field>
          <FieldLabel className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Eye className="size-3.5 text-primary" />
            <span>Ángulo / Perfil de la foto</span>
          </FieldLabel>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {PHOTO_VIEW_TYPES.map((v) => {
              const isSelected = viewType === v.value
              return (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setViewType(v.value)}
                  className={cn(
                    'flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/30 shadow-sm'
                      : 'border-border/60 bg-muted/15 text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground'
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <span className="text-xs font-bold text-foreground">{v.label}</span>
                    <User
                      className={cn(
                        'size-3.5 shrink-0',
                        isSelected ? 'text-primary' : 'text-muted-foreground/50'
                      )}
                    />
                  </div>
                  <span className="mt-0.5 text-[11px] text-muted-foreground">
                    {v.hint}
                  </span>
                </button>
              )
            })}
          </div>
        </Field>

        {/* Date & Weight Row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel
              htmlFor="taken-at"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              <Calendar className="size-3.5 text-primary" />
              <span>Fecha de captura</span>
            </FieldLabel>
            <Input
              id="taken-at"
              type="date"
              max={getLocalToday()}
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
              className="h-11 rounded-xl"
              required
            />
          </Field>

          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel
                htmlFor="weight"
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                <Scale className="size-3.5 text-primary" />
                <span>Peso corporal (opcional)</span>
              </FieldLabel>
              {latestWeightKg != null && (
                <button
                  type="button"
                  onClick={() => setWeightKg(String(latestWeightKg))}
                  className="rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20"
                >
                  Usar {latestWeightKg} kg
                </button>
              )}
            </div>
            <Input
              id="weight"
              type="number"
              step="0.1"
              placeholder={
                latestWeightKg != null
                  ? `Último registrado: ${latestWeightKg} kg`
                  : 'Ej: 75.0 kg'
              }
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
        </div>

        {/* Notes + Quick Chips */}
        <Field>
          <FieldLabel
            htmlFor="notes"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            Condición / Notas (opcional)
          </FieldLabel>
          <Input
            id="notes"
            placeholder="Ej: En ayunas, post-entreno, semana 4 de definición..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-11 rounded-xl"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
            {QUICK_NOTE_CHIPS.map((chip) => {
              const isSelected = notes
                .split(',')
                .map((p) => p.trim())
                .includes(chip)
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => toggleNoteChip(chip)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all',
                    isSelected
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  )}
                >
                  + {chip}
                </button>
              )
            })}
          </div>
        </Field>
      </FieldGroup>

      {error && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
        disabled={!file || isCompressing || isUploading}
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 size-5 animate-spin" />
            Subiendo progreso...
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 size-5" />
            Guardar foto de progreso
          </>
        )}
      </Button>
    </form>
  )
}
