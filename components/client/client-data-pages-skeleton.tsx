import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CLIENT_DATA_PAGE_SHELL } from '@/components/client/client-app-page-parts'
import { cn } from '@/lib/utils'

interface ClientStackPageHeaderSkeletonProps {
  withBackButton?: boolean
  withKicker?: boolean
  actions?: React.ReactNode
}

/**
 * Mirrors `ClientStackPageHeader` 1:1 on Mobile (375px) and Desktop (1440px).
 * - When `withBackButton` is false (default), the leading icon is the mobile logo (`size-9 sm:size-10 rounded-xl md:hidden`),
 *   preventing any horizontal title shift on desktop when loading completes.
 * - When `withBackButton` is true, the back button circle (`size-11 rounded-full`) is shown on all breakpoints.
 */
export function ClientStackPageHeaderSkeleton({
  withBackButton = false,
  withKicker = false,
  actions,
}: ClientStackPageHeaderSkeletonProps = {}) {
  return (
    <header
      className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-xl safe-area-x flex items-center"
      aria-hidden
    >
      <div className="container flex min-h-[54px] flex-col justify-center gap-2 py-2 sm:min-h-[96px] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4 h-full">
          <div className={cn('shrink-0 flex items-center h-full', !withBackButton && 'md:hidden')}>
            {withBackButton ? (
              <Skeleton className="-ml-2.5 size-11 rounded-full md:ml-0" />
            ) : (
              <Skeleton className="size-9 sm:size-10 rounded-xl" />
            )}
          </div>
          <div className="min-w-0 flex flex-col justify-center sm:h-full gap-1.5">
            {withKicker && (
              <Skeleton className="h-2.5 w-24 rounded-md opacity-40" />
            )}
            <Skeleton className="h-6 sm:h-9 w-48 sm:w-64 rounded-xl" />
            <Skeleton className="h-3.5 sm:h-4 w-40 sm:w-64 max-w-full rounded-lg opacity-60" />
          </div>
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:justify-end shrink-0 sm:h-full">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}

/** Historial: lista principal primero en móvil; rail acciones a la izq. en lg (order como en página). */
export function ClientWorkoutsPageSkeleton() {
  return (
    <>
      <ClientStackPageHeaderSkeleton />
      <div
        className={`${CLIENT_DATA_PAGE_SHELL} flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start`}
        aria-busy="true"
        aria-label="Cargando historial"
      >
        <section className="order-1 flex min-w-0 flex-col gap-6 lg:order-2 lg:col-span-8">
          <Card className="overflow-hidden border-border/80 shadow-sm ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-col gap-3 pb-5 pt-6 px-5 sm:px-8 border-b bg-muted/5">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-9 shrink-0 rounded-xl" />
                <Skeleton className="h-6 w-48 max-w-full rounded-lg" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-5 sm:p-8">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/50 p-4 sm:p-5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-2 min-w-0">
                      <Skeleton className="h-5 w-40 max-w-full rounded-md" />
                      <Skeleton className="h-3.5 w-28 rounded-md opacity-60" />
                    </div>
                    <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <aside className="order-2 lg:order-1 lg:col-span-4 lg:sticky lg:top-[calc(96px+1.5rem)] lg:self-start">
          <Card className="overflow-hidden border-border/80 shadow-sm ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-4 pt-6 px-5 sm:px-6">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-9 shrink-0 rounded-xl" />
                <div className="space-y-1.5 min-w-0">
                  <Skeleton className="h-5 w-32 rounded-md" />
                  <Skeleton className="h-3 w-44 max-w-full rounded-md opacity-60" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-5 sm:px-6 pb-6 pt-2">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  )
}

/** Progreso: gráficos primero en móvil; insights sticky rail en lg. */
export function ClientProgressPageSkeleton() {
  return (
    <>
      <ClientStackPageHeaderSkeleton />
      <div
        className={`${CLIENT_DATA_PAGE_SHELL} grid gap-6 lg:grid-cols-12 lg:items-start`}
        aria-busy="true"
        aria-label="Cargando progreso"
      >
        <aside className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-4 lg:sticky lg:top-[calc(96px+1.5rem)] lg:self-start">
          <Card className="overflow-hidden rounded-3xl border-border/80 shadow-sm ring-1 ring-primary/5 bg-card/60">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-36 rounded-md" />
              <Skeleton className="h-3.5 w-full max-w-xs rounded-md opacity-60" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </CardContent>
          </Card>
        </aside>

        <section className="order-1 flex min-w-0 flex-col gap-6 lg:order-2 lg:col-span-8">
          <div className="grid gap-6">
            <Card className="overflow-hidden border-border/80 shadow-sm ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-4 pt-6 px-5 sm:px-8">
                <Skeleton className="h-5 w-36 rounded-md" />
              </CardHeader>
              <CardContent className="px-5 sm:px-8 pb-6">
                <Skeleton className="h-[220px] w-full rounded-2xl" />
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-border/80 shadow-sm ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-4 pt-6 px-5 sm:px-8">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-3.5 w-64 max-w-full rounded-md opacity-60 mt-1.5" />
              </CardHeader>
              <CardContent className="px-5 sm:px-8 pb-6">
                <Skeleton className="h-[260px] w-full rounded-2xl" />
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </>
  )
}

/** Medidas: resumen + CTA en aside; evolución y tabla en main. */
export function ClientMeasurementsPageSkeleton() {
  return (
    <>
      <ClientStackPageHeaderSkeleton />
      <div
        className={`${CLIENT_DATA_PAGE_SHELL} grid gap-6 lg:grid-cols-12 lg:items-start`}
        aria-busy="true"
        aria-label="Cargando medidas"
      >
        <aside className="flex flex-col gap-6 lg:col-span-4 lg:sticky lg:top-[calc(96px+1.5rem)] lg:self-start">
          <Card className="overflow-hidden border-border/80 shadow-sm ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-col gap-4 pb-5 pt-6 px-5 sm:px-6">
              <div className="flex items-start gap-3.5">
                <Skeleton className="size-10 shrink-0 rounded-2xl" />
                <div className="flex flex-1 flex-col gap-2 min-w-0">
                  <Skeleton className="h-5 w-32 rounded-lg" />
                  <Skeleton className="h-3.5 w-44 max-w-full rounded-md opacity-60" />
                </div>
              </div>
              <Skeleton className="h-11 w-full rounded-xl" />
            </CardHeader>
            <CardContent className="flex flex-col gap-5 border-t border-border/40 pt-6 px-5 sm:px-6 pb-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-20 rounded-md opacity-40" />
                  <Skeleton className="h-8 w-28 rounded-lg" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 flex flex-col gap-6 lg:col-span-8">
          <Card className="overflow-hidden border-border/80 shadow-sm ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-4 pt-6 px-5 sm:px-8 border-b bg-muted/5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-xl" />
                <div className="space-y-1.5 min-w-0">
                  <Skeleton className="h-5 w-36 rounded-md" />
                  <Skeleton className="h-3.5 w-52 max-w-full rounded-md opacity-60" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-8">
              <Skeleton className="h-[260px] w-full rounded-2xl" />
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/80 shadow-sm ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-4 pt-6 px-5 sm:px-8 border-b bg-muted/5">
              <Skeleton className="h-5 w-44 rounded-md" />
            </CardHeader>
            <CardContent className="p-5 sm:p-8 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  )
}

/** Calendario: KPIs del mes + cuadrícula de 7 días alineada con `WorkoutCalendar`. */
export function ClientCalendarPageSkeleton() {
  return (
    <>
      <ClientStackPageHeaderSkeleton />
      <div
        className={`${CLIENT_DATA_PAGE_SHELL} flex flex-col gap-6`}
        aria-busy="true"
        aria-label="Cargando calendario"
      >
        {/* 4 Month KPI Stat Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card
              key={i}
              className="rounded-3xl border-border/80 bg-card/60 shadow-sm ring-1 ring-primary/5 p-4 sm:p-5"
            >
              <div className="flex flex-col gap-2">
                <Skeleton className="size-8 rounded-xl" />
                <Skeleton className="h-7 sm:h-8 w-16 rounded-lg mt-1" />
                <Skeleton className="h-3 w-24 max-w-full rounded-md opacity-60" />
              </div>
            </Card>
          ))}
        </div>

        {/* Calendar Card */}
        <Card className="overflow-hidden rounded-3xl border-border/80 bg-card/60 shadow-sm ring-1 ring-primary/5">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/40 bg-muted/5 px-4 py-4 sm:px-6 sm:py-5">
            <Skeleton className="size-9 sm:size-10 rounded-xl shrink-0" />
            <Skeleton className="h-6 w-40 sm:w-48 rounded-lg" />
            <Skeleton className="size-9 sm:size-10 rounded-xl shrink-0" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full rounded-md opacity-40" />
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="aspect-square sm:h-20 sm:aspect-auto w-full rounded-xl sm:rounded-2xl"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

/** Fotos de Progreso: Estudio Visual en aside (4 cols) + Tabs/Contenido en main (8 cols). */
export function ClientPhotosPageSkeleton() {
  return (
    <>
      <ClientStackPageHeaderSkeleton />
      <div
        className={`${CLIENT_DATA_PAGE_SHELL} grid gap-6 lg:grid-cols-12 lg:items-start`}
        aria-busy="true"
        aria-label="Cargando fotos de progreso"
      >
        <aside className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-4 lg:sticky lg:top-[calc(96px+1.5rem)] lg:self-start">
          <Card className="overflow-hidden rounded-3xl border-border/80 bg-card/60 shadow-sm ring-1 ring-primary/5">
            <CardHeader className="space-y-4 pb-5">
              <div className="flex items-center gap-4">
                <Skeleton className="size-11 shrink-0 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32 rounded-md" />
                  <Skeleton className="h-3.5 w-44 max-w-full rounded-md opacity-60" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-36 w-full rounded-2xl" />
            </CardContent>
          </Card>
        </aside>

        <section className="order-1 min-w-0 lg:order-2 lg:col-span-8">
          <Card className="overflow-hidden rounded-3xl border-border/80 bg-card/60 shadow-sm ring-1 ring-primary/5">
            <CardHeader className="border-b bg-muted/5 px-5 pt-5 pb-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex h-auto w-full sm:w-fit items-center justify-start gap-1 rounded-2xl border border-border/40 bg-muted/50 p-1">
                  <Skeleton className="h-9 flex-1 sm:flex-none sm:w-28 rounded-xl" />
                  <Skeleton className="h-9 flex-1 sm:flex-none sm:w-28 rounded-xl" />
                  <Skeleton className="h-9 flex-1 sm:flex-none sm:w-24 rounded-xl" />
                </div>
                <Skeleton className="h-7 w-36 rounded-xl" />
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-5">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-11 w-full rounded-xl" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
              <Skeleton className="h-12 w-full rounded-xl" />
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  )
}

/** Mi Perfil: aside 4 cols (Avatar + Estadísticas) · main 8 cols (Membresía, Datos personales, Fitness, Seguridad). */
export function ClientProfilePageSkeleton() {
  return (
    <>
      <ClientStackPageHeaderSkeleton />
      <div
        className={CLIENT_DATA_PAGE_SHELL}
        aria-busy="true"
        aria-label="Cargando perfil"
      >
        <div className="grid gap-6 lg:grid-cols-12">
          <aside className="flex flex-col gap-6 lg:col-span-4 lg:sticky lg:top-[calc(96px+1.5rem)] lg:self-start">
            {/* Avatar Card */}
            <Card className="rounded-3xl border-border/80 bg-card/60 shadow-sm ring-1 ring-primary/5">
              <CardHeader>
                <Skeleton className="h-5 w-32 rounded-md" />
                <Skeleton className="h-3.5 w-full max-w-xs rounded-md opacity-60" />
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <Skeleton className="size-28 rounded-full" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="rounded-3xl border-border/80 bg-card/60 shadow-sm ring-1 ring-primary/5">
              <CardHeader>
                <Skeleton className="h-5 w-28 rounded-md" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="flex flex-col gap-6 lg:col-span-8">
            {/* Membership & Payments Card */}
            <Card className="rounded-3xl border-border/80 bg-card/60 shadow-sm ring-1 ring-primary/5">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-5 w-44 rounded-md" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-64 max-w-full rounded-md opacity-60" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-20 w-full rounded-2xl" />
                </div>
              </CardContent>
            </Card>

            {/* Personal Info Card */}
            <Card className="rounded-3xl border-border/80 bg-card/60 shadow-sm ring-1 ring-primary/5">
              <CardHeader>
                <Skeleton className="h-5 w-44 rounded-md" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20 rounded-md" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24 rounded-md" />
                    <Skeleton className="h-11 w-full rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-11 w-full rounded-xl" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24 rounded-md" />
                    <Skeleton className="h-11 w-full rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36 rounded-md" />
                    <Skeleton className="h-11 w-full rounded-xl" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security & Notifications Card */}
            <Card className="rounded-3xl border-border/80 bg-card/60 shadow-sm ring-1 ring-primary/5">
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-52 rounded-md" />
                <Skeleton className="h-3.5 w-full max-w-md rounded-md opacity-60" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </>
  )
}

