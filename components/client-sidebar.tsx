'use client'

import { useMemo, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import Link from 'next/link'
import { useLayoutBasePath } from '@/hooks/use-layout-base-path'
import {
  LayoutDashboard,
  Dumbbell,
  Award,
  Activity,
  TrendingUp,
  Ruler,
  CalendarDays,
  ImageIcon,
  MessageCircle,
  User,
  LogOut,
  Moon,
  Sun,
  Download,
} from 'lucide-react'
import { isRunningStandalone, openPWAInstallPrompt } from '@/components/pwa-install-cta'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

const menuGroups = [
  {
    title: 'Entrenamiento',
    items: [
      { label: 'Dashboard', href: '/client/dashboard', icon: LayoutDashboard },
      { label: 'Mis Rutinas', href: '/client/routines', icon: Dumbbell },
      { label: 'Calendario', href: '/client/calendar', icon: CalendarDays },
      { label: 'Historial', href: '/client/workouts', icon: Activity },
    ],
  },
  {
    title: 'Evolución',
    items: [
      { label: 'Progreso', href: '/client/progress', icon: TrendingUp },
      { label: 'Medidas', href: '/client/measurements', icon: Ruler },
      { label: 'Fotos', href: '/client/photos', icon: ImageIcon },
      { label: 'Hitos', href: '/client/achievements', icon: Award },
    ],
  },
  {
    title: 'Cuenta',
    items: [
      { label: 'Mensajes', href: '/client/messages', icon: MessageCircle },
      { label: 'Perfil', href: '/client/profile', icon: User },
    ],
  },
]

const menuItems = menuGroups.flatMap((group) => group.items)

function activeMenuHref(path: string): string | null {
  if (!path) return null
  const ordered = [...menuItems].sort((a, b) => b.href.length - a.href.length)
  for (const item of ordered) {
    if (path === item.href) return item.href
    if (item.href === '/client/dashboard') continue
    if (path.startsWith(`${item.href}/`)) return item.href
  }
  return null
}

export function ClientSidebar() {
  const path = useLayoutBasePath('/client')
  const { theme, setTheme } = useTheme()
  const { isMobile, setOpenMobile } = useSidebar()
  const activeHref = useMemo(() => activeMenuHref(path), [path])
  const [mounted, setMounted] = useState(false)
  const [standalone, setStandalone] = useState(true)

  useEffect(() => {
    setMounted(true)
    setStandalone(isRunningStandalone())
    const onInstalled = () => setStandalone(true)
    window.addEventListener('rucoach:pwa-installed', onInstalled)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('rucoach:pwa-installed', onInstalled)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar side="left" collapsible="icon">
      <div
        aria-hidden="true"
        className="ios-status-bar-cap h-[env(safe-area-inset-top,0px)] w-full shrink-0 bg-sidebar/95"
      />
      <SidebarHeader className="border-b border-sidebar-border/50 flex flex-row items-center px-4 py-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center shrink-0 bg-sidebar/95 backdrop-blur-xl">
        <div className="flex items-center justify-between w-full gap-3 group-data-[collapsible=icon]:justify-center min-h-[54px] sm:min-h-[96px] py-2 sm:py-0">
          <Link
            href="/client/dashboard"
            onClick={handleNavClick}
            className="flex items-center gap-3 transition-opacity duration-300 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:hidden h-full min-w-0"
          >
            <div className="size-9 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-primary/25 shadow-xs bg-black">
              <Image
                src="/android-chrome-192x192.png"
                alt="RU Coach"
                width={36}
                height={36}
                className="size-full object-contain"
              />
            </div>
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <span className="font-bold text-base tracking-tight leading-none text-foreground truncate">
                RU Coach
              </span>
              <p className="text-[10px] text-muted-foreground/80 truncate mt-1.5 font-bold uppercase tracking-widest leading-none">
                Rodrigo Urbina
              </p>
            </div>
          </Link>
          <SidebarTrigger className="shrink-0 size-11 md:size-9 rounded-xl transition-transform hover:scale-105 active:scale-95" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1 py-2 gap-1">
        {menuGroups.map((group) => (
          <SidebarGroup key={group.title} className="py-1.5 px-2">
            <SidebarGroupLabel className="h-6 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = activeHref === item.href
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <Link
                          href={item.href}
                          prefetch={true}
                          onClick={handleNavClick}
                          className={cn(
                            'relative',
                            isActive && 'bg-primary/12 text-primary hover:bg-primary/18 hover:text-primary font-bold shadow-xs'
                          )}
                        >
                          <Icon
                            className={cn(
                              'size-4 shrink-0 transition-transform',
                              isActive ? 'text-primary scale-105' : 'text-muted-foreground'
                            )}
                          />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 shrink-0 bg-sidebar/50 backdrop-blur-xl px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] flex flex-col justify-center">
        <SidebarMenu>
          {mounted && !standalone && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  handleNavClick()
                  openPWAInstallPrompt()
                }}
                tooltip="Instalar App"
                className="text-primary font-semibold"
              >
                <Download className="size-4 shrink-0 text-primary transition-all group-data-[collapsible=icon]:scale-110" />
                <span>Instalar App</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              tooltip="Cambiar tema"
            >
              {!mounted ? (
                <Moon className="size-4 text-transparent transition-all group-data-[collapsible=icon]:scale-110" />
              ) : theme === 'dark' ? (
                <Sun className="size-4 text-primary transition-all group-data-[collapsible=icon]:scale-110" />
              ) : (
                <Moon className="size-4 text-muted-foreground transition-all group-data-[collapsible=icon]:scale-110" />
              )}
              <span>Tema {!mounted ? '' : theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Cerrar sesión"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Link href="/auth/logout" prefetch={false} onClick={handleNavClick}>
                <LogOut className="size-4 shrink-0 transition-all group-data-[collapsible=icon]:scale-110" />
                <span>Cerrar sesión</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
