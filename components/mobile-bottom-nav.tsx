'use client'

import { useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, Dumbbell, Activity, MessageCircle, Menu, Users, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/ui/sidebar'
import { useLayoutBasePath } from '@/hooks/use-layout-base-path'

const clientItems = [
  { label: 'Inicio', href: '/client/dashboard', icon: LayoutDashboard },
  { label: 'Rutinas', href: '/client/routines', icon: Dumbbell },
  { label: 'Historial', href: '/client/workouts', icon: Activity },
  { label: 'Mensajes', href: '/client/messages', icon: MessageCircle },
]

const adminItems = [
  { label: 'Inicio', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Clientes', href: '/admin/clients', icon: Users },
  { label: 'Builder', href: '/admin/routines/builder', icon: Layers },
  { label: 'Mensajes', href: '/admin/messages', icon: MessageCircle },
]

function activeMenuHref(path: string | null, items: {href: string}[]): string | null {
  if (!path) return null
  const ordered = [...items].sort((a, b) => b.href.length - a.href.length)
  for (const item of ordered) {
    if (path === item.href) return item.href
    if (item.href.endsWith('/dashboard') && path !== item.href) continue
    if (path.startsWith(`${item.href}/`)) return item.href
  }
  return null
}

export function MobileBottomNav({ type }: { type: 'client' | 'admin' }) {
  const router = useRouter()
  const path = useLayoutBasePath(`/${type}`)
  const items = type === 'client' ? clientItems : adminItems
  const activeHref = useMemo(() => activeMenuHref(path, items), [path, items])
  
  const { setOpenMobile } = useSidebar()

  const handleWarmupRoute = useCallback((href: string) => {
    try {
      router.prefetch(href)
    } catch {
      // Ignore prefetch errors
    }
  }, [router])

  return (
    <nav
      data-mobile-bottom-nav="true"
      className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-card/95 backdrop-blur-xl border-t border-border/60 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.4)] safe-area-pb safe-area-x"
    >
      <ul className="flex justify-around items-center h-[60px] px-1 sm:px-2">
        {items.map((item) => {
          const isActive = activeHref === item.href
          const Icon = item.icon
          return (
            <li key={item.href} className="flex-1 flex justify-center h-full">
              <Link
                href={item.href}
                prefetch={true}
                onTouchStart={() => handleWarmupRoute(item.href)}
                onPointerEnter={() => handleWarmupRoute(item.href)}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-1 min-w-[44px] transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded-full py-1",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className={cn(
                  "flex size-8 items-center justify-center rounded-full transition-all duration-200",
                  isActive ? "bg-primary/15 text-primary scale-105 shadow-xs" : "bg-transparent text-muted-foreground scale-100"
                )}>
                  <Icon className="size-5 shrink-0" strokeWidth={isActive ? 2.4 : 2} />
                </div>
                <span className={cn(
                  "text-[10px] tracking-tight truncate px-0.5 leading-none transition-colors",
                  isActive ? "text-primary font-bold" : "text-muted-foreground font-medium"
                )}>
                  {item.label}
                </span>
              </Link>
            </li>
          )
        })}
        <li className="flex-1 flex justify-center h-full">
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className="flex flex-col items-center justify-center w-full h-full gap-1 min-w-[44px] text-muted-foreground hover:text-foreground transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded-full py-1"
            aria-label="Abrir menú"
          >
            <div className="flex size-8 items-center justify-center rounded-full transition-all duration-200 bg-transparent text-muted-foreground scale-100">
              <Menu className="size-5 shrink-0" strokeWidth={2} />
            </div>
            <span className="text-[10px] font-medium tracking-tight truncate px-0.5 leading-none text-muted-foreground">
              Menú
            </span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
