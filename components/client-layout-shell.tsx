'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { RealtimeNotifications } from '@/components/realtime-notifications'
import { useScrollResetOnNavigate } from '@/hooks/use-scroll-reset-on-navigate'

const ClientSidebar = dynamic(
  () => import('@/components/client-sidebar').then((m) => m.ClientSidebar),
  { ssr: false },
)

export function ClientLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  useScrollResetOnNavigate()
  const isMessagesRoute = pathname.includes('/messages')
  const isActiveWorkoutRoute = pathname.startsWith('/client/workout/start')

  return (
    <SidebarProvider defaultOpen={true} className="flex-1 h-full min-h-0! overflow-hidden">
      <RealtimeNotifications role="client" />
      <ClientSidebar />
      <SidebarInset className="min-h-0 flex-1 overflow-hidden">
        <div
          aria-hidden="true"
          className="ios-status-bar-cap h-[env(safe-area-inset-top,0px)] w-full shrink-0 bg-background"
        />
        <div
          id="main-content"
          tabIndex={-1}
          className={
            isMessagesRoute
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pb-0'
              : isActiveWorkoutRoute
                ? 'min-h-0 flex-1 overflow-auto overscroll-y-contain scroll-pt-[4.5rem] sm:scroll-pt-[calc(6rem+1rem)] pb-[env(safe-area-inset-bottom,0px)] md:pb-0'
                : 'min-h-0 flex-1 overflow-auto overscroll-y-contain scroll-pt-[4.5rem] sm:scroll-pt-[calc(6rem+1rem)] pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pb-0'
          }
        >
          {children}
        </div>
        {!isActiveWorkoutRoute && <MobileBottomNav type="client" />}
      </SidebarInset>
    </SidebarProvider>
  )
}
