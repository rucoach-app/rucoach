import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ADMIN_DATA_PAGE_SHELL, ADMIN_FORM_PAGE_SHELL } from '@/components/admin/admin-page-header'
import { cn } from '@/lib/utils'

interface AdminPageHeaderSkeletonProps {
  hasBackButton?: boolean
  hasKicker?: boolean
  actions?: React.ReactNode
  className?: string
}

/**
 * Mirrors `AdminPageHeader` 1:1 on both Mobile (375px) and Desktop (1440px).
 * - When `hasBackButton` is false, the leading icon is the mobile logo (`size-9 sm:size-10 rounded-xl md:hidden`),
 *   preventing any horizontal title jump on desktop when loading completes.
 * - When `hasBackButton` is true, the back button circle (`size-11 rounded-full`) is shown on all breakpoints.
 */
export function AdminPageHeaderSkeleton({
  hasBackButton = false,
  hasKicker = false,
  actions,
  className,
}: AdminPageHeaderSkeletonProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-xl safe-area-x flex items-center',
        className,
      )}
      aria-hidden
    >
      <div className="w-full flex min-h-[54px] flex-col justify-center gap-2 py-2 md:min-h-[96px] md:flex-row md:items-center md:justify-between md:gap-4 md:py-0 px-4 sm:px-6 md:px-8">
        <div className="flex min-w-0 items-center gap-3 md:gap-4 h-full">
          <div className={cn('shrink-0 flex items-center h-full', !hasBackButton && 'md:hidden')}>
            {hasBackButton ? (
              <Skeleton className="-ml-2.5 size-11 rounded-full md:ml-0" />
            ) : (
              <Skeleton className="size-9 sm:size-10 rounded-xl" />
            )}
          </div>
          <div className="min-w-0 flex flex-col justify-center sm:h-full gap-1.5">
            {hasKicker && (
              <Skeleton className="h-2.5 w-24 rounded-md opacity-40" />
            )}
            <Skeleton className="h-6 sm:h-9 w-48 sm:w-64 rounded-xl" />
            <Skeleton className="h-3.5 w-44 sm:w-72 max-w-full rounded-md opacity-60" />
          </div>
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap gap-2.5 md:w-auto md:flex-row md:items-center md:justify-end shrink-0 md:h-full">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}

/**
 * Generic admin route placeholder.
 */
export function AdminPageSkeleton() {
  return (
    <div className="min-h-full bg-background" aria-busy="true" aria-label="Cargando">
      <AdminPageHeaderSkeleton />

      <div className={ADMIN_DATA_PAGE_SHELL}>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-12 w-full max-w-xl rounded-2xl" />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="min-h-56 rounded-3xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 sm:p-8 shadow-sm">
              <Skeleton className="h-6 w-36 rounded-md mb-4" />
              <Skeleton className="h-4 w-full rounded-md opacity-40 mb-2" />
              <Skeleton className="h-4 w-3/4 rounded-md opacity-40" />
            </div>
            <div className="min-h-56 rounded-3xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 sm:p-8 shadow-sm">
              <Skeleton className="h-6 w-36 rounded-md mb-4" />
              <Skeleton className="h-4 w-full rounded-md opacity-40 mb-2" />
              <Skeleton className="h-4 w-3/4 rounded-md opacity-40" />
            </div>
          </div>
          <div className="h-48 rounded-3xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 sm:p-8 shadow-sm">
            <Skeleton className="h-6 w-36 rounded-md mb-4" />
            <Skeleton className="h-4 w-full rounded-md opacity-40" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Centered form skeleton for `/admin/clients/new`, `/admin/clients/[id]/edit`,
 * `/admin/payments/new`, `/admin/payments/[id]/edit`, `/admin/exercises/new`, etc.
 */
export function AdminFormPageSkeleton() {
  return (
    <div className="min-h-full bg-background" aria-busy="true" aria-label="Cargando formulario">
      <AdminPageHeaderSkeleton hasBackButton />

      <div className={ADMIN_FORM_PAGE_SHELL}>
        <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardHeader className="space-y-2 border-b border-border/40 bg-muted/5 px-6 py-6 sm:px-8">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-4 w-full max-w-md rounded-md opacity-60" />
          </CardHeader>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            </div>
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
            <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
              <Skeleton className="h-11 w-full sm:w-28 rounded-xl" />
              <Skeleton className="h-11 w-full sm:w-40 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * Full-screen onboarding skeleton for `/onboarding` and `/admin/onboarding`.
 */
export function OnboardingFlowSkeleton({ steps = 4 }: { steps?: number }) {
  return (
    <div className="min-h-dvh bg-background flex flex-col" aria-busy="true" aria-label="Cargando configuración inicial">
      <header className="safe-area-header-pt safe-area-x border-b border-border/50 bg-background/85 backdrop-blur-md sticky top-0 z-50">
        <div className="container max-w-4xl mx-auto h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-9 rounded-lg shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-2.5 w-20 rounded-md opacity-60" />
            </div>
          </div>
          <Skeleton className="size-9 rounded-xl" />
        </div>
      </header>

      <div className="flex-1 container max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 sm:gap-8">
        <div className="flex items-center justify-between max-w-md mx-auto w-full gap-2">
          {Array.from({ length: steps }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
              <Skeleton className="size-9 sm:size-10 rounded-full" />
              <Skeleton className="h-2.5 w-12 rounded-md opacity-50" />
            </div>
          ))}
        </div>

        <Card className="rounded-3xl border-border/60 bg-card/80 backdrop-blur-xl shadow-lg overflow-hidden">
          <CardHeader className="space-y-2 p-5 sm:p-8 pb-2">
            <Skeleton className="h-7 w-56 max-w-full rounded-xl" />
            <Skeleton className="h-4 w-full max-w-md rounded-md opacity-60" />
          </CardHeader>
          <CardContent className="space-y-5 p-5 sm:p-8">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-11 sm:h-12 w-full rounded-xl" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-11 sm:h-12 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-11 sm:h-12 w-full rounded-xl" />
              </div>
            </div>
            <div className="pt-4 flex justify-end">
              <Skeleton className="h-11 sm:h-12 w-full sm:w-44 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

