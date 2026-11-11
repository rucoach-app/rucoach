'use client'

import { usePathname } from 'next/navigation'
import { AdminSidebar } from '@/components/admin-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { RealtimeNotifications } from '@/components/realtime-notifications'
import { cn } from '@/lib/utils'
import { useScrollResetOnNavigate } from '@/hooks/use-scroll-reset-on-navigate'

export function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  useScrollResetOnNavigate()
  const isMessages = pathname.includes('/messages')

  return (
    <SidebarProvider defaultOpen={true} className="flex-1 h-full min-h-0! overflow-hidden">
      <RealtimeNotifications role="admin" />
      <AdminSidebar />
      <SidebarInset className="min-h-0 flex-1 overflow-hidden">
        <div
          aria-hidden="true"
          className="ios-status-bar-cap h-[env(safe-area-inset-top,0px)] w-full shrink-0 bg-background"
        />
        <div
          id="main-content"
          tabIndex={-1}
          className={cn(
            'min-h-0 flex-1 pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pb-0',
            isMessages
              ? 'flex flex-col overflow-hidden'
              : 'overflow-auto overscroll-y-contain scroll-pt-[4.5rem] sm:scroll-pt-[calc(6rem+1rem)]',
          )}
        >
          {children}
        </div>
        <MobileBottomNav type="admin" />
      </SidebarInset>
    </SidebarProvider>
  )
}
