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
    <SidebarProvider defaultOpen={true} className="flex-1 min-h-0">
      <RealtimeNotifications role="client" />
      <ClientSidebar />
      <SidebarInset className={isMessagesRoute ? 'min-h-0 flex-1' : ''}>
        <div
          id="main-content"
          tabIndex={-1}
          className={
            isMessagesRoute
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(60px+env(safe-area-inset-bottom,0px))] md:pb-0'
              : isActiveWorkoutRoute
                ? 'flex-1 overflow-auto pb-[env(safe-area-inset-bottom,0px)] md:pb-0'
                : 'flex-1 overflow-auto pb-[calc(60px+env(safe-area-inset-bottom,0px))] md:pb-0'
          }
        >
          {children}
        </div>
        {!isActiveWorkoutRoute && <MobileBottomNav type="client" />}
      </SidebarInset>
    </SidebarProvider>
  )
}
