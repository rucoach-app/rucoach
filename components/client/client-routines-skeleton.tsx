import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CLIENT_DATA_PAGE_SHELL } from '@/components/client/client-app-page-parts'
import { ClientStackPageHeaderSkeleton } from '@/components/client/client-data-pages-skeleton'

/** Mis rutinas: tarjeta principal en móvil primero; rail progresión/sugerencias a la izq. en desktop. */
export function ClientRoutinesPageSkeleton() {
  return (
    <>
      <ClientStackPageHeaderSkeleton />
      <div
        className={`${CLIENT_DATA_PAGE_SHELL} flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start`}
        aria-busy="true"
        aria-label="Cargando rutinas"
      >
        <section className="order-1 flex min-w-0 flex-col gap-8 lg:order-2 lg:col-span-8">
          <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-6 pt-8 px-6 sm:px-8 border-b bg-muted/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-4 shrink-0 rounded-full" />
                    <Skeleton className="h-3 w-32 rounded-md" />
                  </div>
                  <Skeleton className="h-8 w-64 rounded-xl" />
                  <Skeleton className="h-4 w-full max-w-2xl rounded-md opacity-60" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-8 p-6 sm:p-8">
              {/* Progress Section */}
              <div className="flex flex-col gap-4 bg-muted/10 rounded-2xl p-5 border border-border/40">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-3 w-28 rounded-md" />
                    <Skeleton className="h-6 w-32 rounded-md" />
                  </div>
                  <Skeleton className="size-14 rounded-full" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-2xl border border-border/40 p-4 bg-background/50">
                    <Skeleton className="h-3 w-20 rounded-md" />
                    <Skeleton className="h-8 w-16 rounded-md" />
                  </div>
                ))}
              </div>

              {/* Next Session Area */}
              <div className="flex flex-col gap-6 pt-8 border-t border-border/40">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-2 rounded-full" />
                  <Skeleton className="h-4 w-32 rounded-md" />
                </div>
                <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10">
                   <Skeleton className="h-5 w-full rounded-md" />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4 rounded-2xl border border-border/40 bg-background/50 p-3">
                      <Skeleton className="size-14 shrink-0 rounded-xl" />
                      <div className="flex flex-col flex-1 gap-2">
                        <Skeleton className="h-4 w-32 rounded-md" />
                        <Skeleton className="h-3 w-24 rounded-md opacity-60" />
                      </div>
                    </div>
                  ))}
                </div>
                <Skeleton className="h-14 w-full rounded-2xl" />
              </div>
            </CardContent>
          </Card>
        </section>

        <aside className="order-2 lg:order-1 lg:col-span-4 lg:sticky lg:top-[calc(96px+1.5rem)] lg:self-start">
          <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-4 pt-6 px-6">
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 shrink-0 rounded-full" />
                <Skeleton className="h-6 w-32 rounded-md" />
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-2">
              <div className="flex flex-col gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-2xl border border-border/40 p-4 bg-background/50 space-y-3">
                    <div className="flex items-center justify-between">
                       <Skeleton className="h-4 w-32 rounded-md" />
                       <Skeleton className="h-5 w-12 rounded-md" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <Skeleton className="h-10 w-full rounded-lg" />
                       <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  )
}
