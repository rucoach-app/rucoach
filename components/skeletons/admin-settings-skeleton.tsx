import { Skeleton } from '@/components/ui/skeleton'
import { ADMIN_DATA_PAGE_SHELL } from '@/components/admin/admin-page-header'
import { AdminPageHeaderSkeleton } from './admin-page-skeleton'

export function AdminSettingsSkeleton() {
  return (
    <div className="min-h-full bg-background" aria-busy="true" aria-label="Cargando configuración">
      <AdminPageHeaderSkeleton />

      <div className={`${ADMIN_DATA_PAGE_SHELL} space-y-8`}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          {/* 4 Tabs: Mi perfil, Planes y Tarifas, General, Biblioteca */}
          <div className="flex h-auto w-full sm:w-fit items-center justify-start gap-1 overflow-x-auto rounded-2xl border border-border/40 bg-muted/50 p-1 shadow-sm">
            <Skeleton className="h-9 w-28 shrink-0 rounded-xl" />
            <Skeleton className="h-9 w-36 shrink-0 rounded-xl" />
            <Skeleton className="h-9 w-24 shrink-0 rounded-xl" />
            <Skeleton className="h-9 w-28 shrink-0 rounded-xl" />
          </div>

          <div className="overflow-hidden border border-border/50 shadow-sm ring-1 ring-primary/5 rounded-3xl bg-card/60 backdrop-blur-sm">
            <div className="space-y-2.5 border-b border-border/40 bg-muted/5 px-5 py-6 sm:px-8">
              <Skeleton className="h-6 sm:h-7 w-56 max-w-full rounded-xl" />
              <Skeleton className="h-4 w-full max-w-lg rounded-md opacity-60" />
            </div>
            <div className="space-y-8 px-5 py-6 sm:px-8 sm:py-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <Skeleton className="size-20 shrink-0 rounded-full" />
                <div className="space-y-2.5 flex-1 w-full">
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-10 w-full sm:w-44 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2.5">
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
                <div className="space-y-2.5">
                  <Skeleton className="h-4 w-40 rounded-md" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
              </div>

              <Skeleton className="h-11 w-full sm:w-48 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

