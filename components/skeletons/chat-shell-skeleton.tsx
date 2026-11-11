import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Inbox sidebar skeleton — admin only.
 * On mobile (<768px), admin starts on the inbox list (`flex`), matching `adminMobilePane = 'inbox'`.
 */
function InboxAsideSkeleton() {
  return (
    <aside
      className="flex min-h-0 w-full flex-col border-r border-border bg-muted/10 backdrop-blur-sm md:w-[min(100%,20rem)] md:shrink-0"
      aria-hidden
    >
      {/* Header — matches InboxAside header */}
      <header className="shrink-0 border-b border-border/50 bg-background/95 backdrop-blur-xl safe-area-x flex flex-col justify-center">
        <div className="flex min-h-[54px] sm:min-h-[96px] flex-col justify-center gap-2.5 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 sm:size-10 shrink-0 rounded-xl md:hidden" />
            <Skeleton className="h-6 sm:h-7 w-32 rounded-xl" />
          </div>
          {/* Search bar */}
          <Skeleton className="h-10 w-full rounded-2xl" />
        </div>
      </header>
      <ul className="flex-1 space-y-0 overflow-hidden" role="presentation">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <li
            key={i}
            className={cn(
              'flex items-center gap-3 px-4 py-3 border-l-[3px] border-l-transparent',
              i === 1 && 'bg-primary/5 border-l-primary',
            )}
          >
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-2/3 rounded-md" />
                <Skeleton className="h-3 w-10 rounded-md opacity-40 tabular-nums" />
              </div>
              <Skeleton className="h-3 w-full rounded-md opacity-60" />
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}

/**
 * Thread pane skeleton — messages area + composer.
 * For admin, hidden on mobile (<768px) since InboxAsideSkeleton is shown first.
 * For client, visible on both mobile and desktop.
 */
function ThreadPaneSkeleton({ role }: { role: 'admin' | 'client' }) {
  const isAdmin = role === 'admin'
  return (
    <section
      className={cn(
        'min-h-0 min-w-0 flex-1 flex-col',
        isAdmin ? 'hidden md:flex' : 'flex',
      )}
      aria-busy="true"
      aria-label="Cargando chat"
    >
      {/* Thread header — matches ThreadPane header */}
      <header className="shrink-0 border-b border-border/50 bg-background/95 backdrop-blur-xl safe-area-x flex items-center">
        <div className="w-full min-h-[54px] sm:min-h-[96px] flex flex-row items-center gap-3 sm:gap-4 px-4 py-2 sm:py-0 sm:px-6 md:px-8">
          {/* For client on mobile: show mobile brand logo placeholder */}
          {!isAdmin && <Skeleton className="size-9 sm:size-10 shrink-0 rounded-xl md:hidden" />}

          {/* Avatar + Peer info */}
          <div className="flex items-center gap-3 flex-1 h-full">
            <Skeleton className="size-10 sm:size-11 shrink-0 rounded-full ring-2 ring-primary/10" />
            <div className="min-w-0 flex flex-col gap-1.5 justify-center">
              <Skeleton className="h-5 w-32 sm:w-48 rounded-lg" />
              <Skeleton className="h-3 w-20 rounded-md opacity-40" />
            </div>
          </div>
        </div>
      </header>

      {/* Messages area anchored to bottom */}
      <div className="flex flex-1 flex-col justify-end bg-linear-to-b from-muted/15 to-background px-3 py-4 sm:px-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              className={cn(
                'h-14 rounded-2xl',
                i % 2 === 0 ? 'ms-auto w-[78%] sm:w-[65%]' : 'me-auto w-[72%] sm:w-[60%]',
              )}
            />
          ))}
        </div>
      </div>

      {/* Composer footer */}
      <footer className="shrink-0 border-t border-border bg-background safe-area-pb">
        <div className="container">
          <div className="mx-auto flex max-w-2xl flex-col gap-2.5 py-2.5 sm:py-3">
            <div className="flex gap-2 overflow-hidden">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-36 shrink-0 rounded-full" />
              ))}
            </div>
            <div className="flex items-end gap-2">
              <Skeleton className="h-11 min-h-11 flex-1 rounded-2xl" />
              <Skeleton className="size-11 shrink-0 rounded-2xl" />
            </div>
          </div>
        </div>
      </footer>
    </section>
  )
}

export function ChatShellSkeleton({ role }: { role: string }) {
  const isAdmin = role === 'admin'
  return (
    <div className="flex h-full w-full min-h-0 flex-1 bg-background overflow-hidden">
      {isAdmin ? <InboxAsideSkeleton /> : null}
      <ThreadPaneSkeleton role={isAdmin ? 'admin' : 'client'} />
    </div>
  )
}

