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
        <Skeleton className="h-8 w-16 sm:h-9 sm:w-20 rounded-lg" />
        <Skeleton className="h-3.5 w-28 max-w-full rounded-md opacity-50" />
        <Skeleton className="h-3 w-24 max-w-full rounded-md opacity-40" />
      </CardContent>
    </Card>
  )
}

export function AdminDashboardSkeleton() {
  return (
    <div className="min-h-full bg-background" aria-busy="true" aria-label="Cargando panel de control">
      <AdminPageHeaderSkeleton
        hasKicker
        actions={
          <>
            <Skeleton className="h-10 flex-1 sm:flex-none sm:w-28 rounded-xl" />
            <Skeleton className="h-10 flex-1 sm:flex-none sm:w-36 rounded-xl" />
          </>
        }
      />

      <div className={ADMIN_DATA_PAGE_SHELL}>
        <div className="flex flex-1 flex-col gap-8 lg:gap-10">
          <section className="flex flex-col gap-6" aria-hidden>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <KpiTileSkeleton key={i} />
              ))}
            </div>

            <Card className="border-border/50 shadow-sm ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
              <CardHeader className="space-y-3 p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-6 w-48 rounded-lg" />
                    <Skeleton className="h-3.5 w-72 max-w-full rounded-md opacity-50" />
                  </div>
                  <Skeleton className="h-9 w-36 rounded-xl" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
                <Skeleton className="h-[240px] sm:h-[280px] w-full rounded-2xl" />
              </CardContent>
            </Card>
          </section>

          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-2 rounded-full bg-primary animate-pulse" />
                <Skeleton className="h-6 w-48 rounded-lg" />
              </div>
              <Skeleton className="h-4 w-full max-w-xl rounded-md opacity-60" />
            </div>

            <Card className="border-border/50 shadow-sm ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
              <CardHeader className="flex flex-col gap-4 p-5 sm:p-6 sm:flex-row sm:items-start sm:justify-between border-b bg-muted/5">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-36 rounded-md" />
                  <Skeleton className="h-3.5 w-full max-w-md rounded-md opacity-50" />
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-9 flex-1 sm:flex-none sm:w-24 rounded-xl" />
                  ))}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Skeleton className="h-11 w-full rounded-xl" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card
                  key={i}
                  className="overflow-hidden border-border/50 shadow-sm ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm"
                >
                  <CardHeader className="p-5 border-b bg-muted/5">
                    <div className="flex items-center gap-3.5">
                      <Skeleton className="size-12 shrink-0 rounded-2xl" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-5 w-32 max-w-full rounded-md" />
                        <Skeleton className="h-3.5 w-24 rounded-md opacity-60" />
                      </div>
                      <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3.5 p-5">
                    {[1, 2, 3].map((row) => (
                      <div key={row} className="flex items-center justify-between gap-4">
                        <Skeleton className="h-3.5 w-24 rounded-md opacity-60" />
                        <Skeleton className="h-4 w-20 rounded-md" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

