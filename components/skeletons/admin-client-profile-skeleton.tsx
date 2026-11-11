import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { ADMIN_DATA_PAGE_SHELL } from '@/components/admin/admin-page-header'
import { AdminPageHeaderSkeleton } from './admin-page-skeleton'

/** Mirrors `ClientProfileHub` + `app/admin/clients/[clientId]/page.tsx` shell. */
export function AdminClientProfileSkeleton() {
  return (
    <div className="min-h-full bg-background" aria-busy="true" aria-label="Cargando perfil del asesorado">
      <AdminPageHeaderSkeleton
        hasBackButton
        actions={
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full md:w-auto">
            <Skeleton className="h-9 w-full sm:w-28 rounded-xl" />
            <Skeleton className="h-9 w-full sm:w-32 rounded-xl" />
            <Skeleton className="col-span-2 sm:col-span-1 h-9 w-full sm:w-36 rounded-xl" />
          </div>
        }
      />

      <div className={`${ADMIN_DATA_PAGE_SHELL} flex flex-col gap-6`}>
        <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-md border-b sm:static sm:z-auto sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent sm:border-none">
          <ScrollArea className="w-full whitespace-nowrap pb-1">
            <div className="inline-flex min-w-full lg:w-auto bg-card/60 backdrop-blur-xl p-1 h-12 rounded-2xl border border-border/50 shadow-sm mb-1 gap-1">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-xl" />
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
        </div>

        <div className="flex flex-col gap-6">
          {/* Summary Grid: 4 cards */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-border/50 bg-card/60 p-4 sm:p-5 shadow-sm backdrop-blur-xl h-28"
              >
                <div className="flex items-center gap-1.5">
                  <Skeleton className="size-4 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-7 sm:h-8 w-full max-w-[120px]" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>

          {/* Main Content: 8/4 grid */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <Card className="border-border/50 bg-card/60 backdrop-blur-xl rounded-3xl shadow-sm overflow-hidden">
                <CardHeader className="pb-4">
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <Skeleton className="size-16 rounded-2xl shrink-0" />
                    <div className="flex flex-col gap-3 min-w-0 flex-1 w-full">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Skeleton className="h-7 w-48 max-w-full" />
                        <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                      </div>
                      <Skeleton className="h-4 w-full max-w-[280px]" />
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Skeleton className="h-5 w-24 rounded-full shrink-0" />
                        <Skeleton className="h-5 w-24 rounded-full shrink-0" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-4">
              <Card className="h-full border-border/50 bg-card/60 backdrop-blur-xl rounded-3xl shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/30">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="size-4" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-32" />
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

