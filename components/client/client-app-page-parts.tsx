import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Misma envolvente que Mis rutinas / logros: móvil primero, ancho hasta 7xl en desktop. */
export const CLIENT_DATA_PAGE_SHELL =
  'container min-w-0 pt-4 pb-6 sm:py-8'

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
        'border-b border-border/50 bg-background/95 backdrop-blur-xl safe-area-header-pt safe-area-x flex items-center',
        sticky && 'sticky top-0 z-50',
        className,
      )}
    >
      <div className="container flex min-h-[54px] flex-col justify-center gap-2 py-2 sm:min-h-[96px] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0">
        {/* Leading icon + title always on the same row */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4 h-full">
          {/* Back arrow or App logo */}
          <div className="shrink-0 flex items-center h-full">
            {backHref ? (
              onBackClick ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="-ml-2.5 size-11 rounded-full hover:bg-primary/10 hover:text-primary transition-all duration-300 md:ml-0"
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
                  className="-ml-2.5 size-11 rounded-full hover:bg-primary/10 hover:text-primary transition-all duration-300 md:ml-0"
                  aria-label={backLabel}
                >
                  <Link href={backHref}>
                    {backIcon ?? <ChevronLeft className="size-6 sm:size-7" aria-hidden strokeWidth={2.5} />}
                  </Link>
                </Button>
              )
            ) : (
              <div className="flex items-center md:hidden">
                <div className="size-9 sm:size-10 rounded-xl overflow-hidden border border-primary/25 shadow-xs shrink-0 bg-black flex items-center justify-center">
                  <Image src="/android-chrome-192x192.png" alt="Logo RU Coach" width={40} height={40} className="size-full object-contain" />
                </div>
              </div>
            )}
          </div>

          {/* Title + subtitle */}
          <div className="min-w-0 flex flex-col justify-center sm:h-full">
            {kicker ? (
              <div className="mb-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary sm:text-[11px] leading-none">
                {kicker}
              </div>
            ) : null}
            <h1 className="text-lg font-black tracking-tight text-pretty sm:text-2xl md:text-3xl lg:text-4xl text-foreground leading-[1.15]">
              {title}
            </h1>
            {subtitle ? (
              typeof subtitle === 'string' ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/90 sm:text-sm font-medium sm:mt-1">
                  {subtitle}
                </p>
              ) : (
                <div className="mt-0.5 text-xs text-muted-foreground/90 sm:text-sm font-medium sm:mt-1">{subtitle}</div>
              )
            ) : null}
          </div>
        </div>

        {/* Actions */}
        {actions ? (
          <div className="flex w-full flex-wrap gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:justify-end shrink-0 sm:h-full">
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
