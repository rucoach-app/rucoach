import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ADMIN_DATA_PAGE_SHELL } from '@/components/admin/admin-page-header'
import { AdminPageHeaderSkeleton } from './admin-page-skeleton'

function KpiTileSkeleton() {
  return (
    <Card className="min-w-0 overflow-visible border-border/50 shadow-sm ring-1 ring-primary/5 rounded-2xl bg-card/60 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start gap-3 p-4 sm:p-5 pb-2">
        <Skeleton className="size-10 shrink-0 rounded-xl" />
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 p-4 sm:p-5 pt-0">
        <Skeleton className="h-8 w-24 sm:h-9 rounded-lg" />
        <Skeleton className="h-3.5 w-28 max-w-full rounded-md opacity-50" />
        <Skeleton className="h-3 w-32 max-w-full rounded-md opacity-40" />
      </CardContent>
    </Card>
  )
}

export function AdminPaymentsSkeleton() {
  return (
    <div className="min-h-full bg-background" aria-busy="true" aria-label="Cargando pagos y membresías">
      <AdminPageHeaderSkeleton
        actions={<Skeleton className="h-10 w-full sm:w-36 rounded-xl" />}
      />

      <div className={ADMIN_DATA_PAGE_SHELL}>
        <div className="grid gap-6">
          {/* 4 KPI cards matching AdminPaymentsPage */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <KpiTileSkeleton key={i} />
            ))}
          </div>

          {/* Search & Filter tabs bar matching PaymentCardsClient */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-10 w-full sm:max-w-xs rounded-xl" />
            <div className="flex items-center gap-1.5 overflow-hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-9 w-20 shrink-0 rounded-xl" />
              ))}
            </div>
          </div>

          {/* Payment Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card
                key={i}
                className="overflow-hidden border-border/60 shadow-sm ring-1 ring-primary/5 rounded-2xl bg-card/80 backdrop-blur-sm"
              >
                <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40 bg-muted/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Skeleton className="size-10 shrink-0 rounded-full" />
                      <div className="space-y-1.5 min-w-0">
                        <Skeleton className="h-4 w-32 max-w-full rounded-md" />
                        <Skeleton className="h-3 w-40 max-w-full rounded-md opacity-60" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-14 w-full rounded-xl" />
                    <Skeleton className="h-14 w-full rounded-xl" />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-4 w-28 rounded-md opacity-60" />
                    <Skeleton className="h-8 w-24 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

