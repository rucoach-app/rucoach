import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Misma envolvente que Mis rutinas / logros: móvil primero, ancho hasta 7xl en desktop. */
export const CLIENT_DATA_PAGE_SHELL =
  'container min-w-0 py-8 pb-24'

/** Cabecera al estilo admin: volver al panel + título + subtítulo (sin duplicar el título en la barra sticky). */
export function ClientStackPageHeader({
  title,
  subtitle,
  kicker,
  backHref = null,
  backLabel = 'Volver',
  backIcon,
  onBackClick,
  actions,
  sticky = true,
  className,
}: {
  title: string
  subtitle?: string | React.ReactNode
  kicker?: string | React.ReactNode
  backHref?: string | null
  backLabel?: string
  backIcon?: React.ReactNode
  onBackClick?: () => void
  actions?: React.ReactNode
  sticky?: boolean
  className?: string
}) {
  return (
    <header
      className={cn(
        'border-b border-border/50 bg-background/80 backdrop-blur-xl safe-area-header-pt min-h-[76px] sm:min-h-[112px] flex items-center',
        // El contenedor de scroll ya reserva la zona segura (notch); el margen negativo hace que el
        // header sticky nazca pegado arriba, sin salto ni doble espacio al empezar a hacer scroll.
        sticky && 'sticky top-0 z-50 -mt-[env(safe-area-inset-top)]',
        className,
      )}
    >
      <div className="container flex min-h-[76px] flex-col justify-center gap-3 py-3 sm:min-h-[112px] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0">
        {/* Leading icon + title always on the same row */}
        <div className="flex min-w-0 items-center gap-4 h-full">
          {/* Back arrow or App logo */}
          <div className="shrink-0 flex items-center h-full">
            {backHref ? (
              onBackClick ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="-ml-3 size-10 sm:size-11 rounded-full hover:bg-primary/10 hover:text-primary transition-all duration-300 md:ml-0"
                  aria-label={backLabel}
                  onClick={onBackClick}
                >
                  {backIcon ?? <ChevronLeft className="size-6 sm:size-7" aria-hidden strokeWidth={2.5} />}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="-ml-3 size-10 sm:size-11 rounded-full hover:bg-primary/10 hover:text-primary transition-all duration-300 md:ml-0"
                  aria-label={backLabel}
                >
                  <Link href={backHref}>
                    {backIcon ?? <ChevronLeft className="size-6 sm:size-7" aria-hidden strokeWidth={2.5} />}
                  </Link>
                </Button>
              )
            ) : (
              <div className="flex items-center md:hidden">
                <div className="size-10 sm:size-11 rounded-full overflow-hidden border border-primary/20 shadow-xs shrink-0 bg-primary/10 flex items-center justify-center p-1.5">
                  <Image src="/android-chrome-192x192.png" alt="Logo RU Coach" width={36} height={36} className="size-full object-contain p-0.5" />
                </div>
              </div>
            )}
          </div>

          {/* Title + subtitle */}
          <div className="min-w-0 flex flex-col justify-center py-1 sm:h-full">
            {kicker ? (
              <div className="mb-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary sm:text-[11px] leading-none">
                {kicker}
              </div>
            ) : null}
            <h1 className="text-xl font-black tracking-tight text-pretty sm:text-2xl md:text-3xl lg:text-4xl text-foreground leading-[1.1]">
              {title}
            </h1>
            {subtitle ? (
              typeof subtitle === 'string' ? (
                <p className="mt-1 line-clamp-2 sm:line-clamp-1 text-xs text-muted-foreground/90 sm:text-sm font-medium sm:mt-1.5">
                  {subtitle}
                </p>
              ) : (
                <div className="mt-1 text-xs text-muted-foreground/90 sm:text-sm font-medium sm:mt-1.5">{subtitle}</div>
              )
            ) : null}
          </div>
        </div>

        {/* Actions */}
        {actions ? (
          <div className="flex w-full flex-wrap gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end shrink-0 sm:h-full">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export function ClientIncompleteProfileCard() {
  return (
    <Card className="overflow-hidden rounded-3xl border-border/80 shadow-sm ring-1 ring-primary/5">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Perfil incompleto</CardTitle>
        <CardDescription>
          Tu perfil de cliente aún no ha sido configurado. Contacta a tu entrenador.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
