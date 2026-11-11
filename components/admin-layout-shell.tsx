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
    <SidebarProvider defaultOpen={true} className="flex-1 min-h-0">
      <RealtimeNotifications role="admin" />
      <AdminSidebar />
      <SidebarInset className={cn(isMessages && 'flex-1 min-h-0')}>
        <div
          id="main-content"
          tabIndex={-1}
          className={cn(
            'flex-1 pb-[calc(60px+env(safe-area-inset-bottom,0px))] md:pb-0',
            isMessages ? 'flex min-h-0 flex-col overflow-hidden' : 'overflow-auto',
          )}
        >
          {children}
        </div>
        <MobileBottomNav type="admin" />
      </SidebarInset>
    </SidebarProvider>
  )
}
