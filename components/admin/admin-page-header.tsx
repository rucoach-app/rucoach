import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const ADMIN_DATA_PAGE_SHELL = 'w-full min-w-0 px-4 sm:px-6 md:px-8 py-6 sm:py-8'
export const ADMIN_FORM_PAGE_SHELL = 'w-full min-w-0 max-w-2xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8'

type AdminPageHeaderProps = {
  kicker?: React.ReactNode
  title: string
  description?: string | React.ReactNode
  backHref?: string
  backLabel?: string
  actions?: React.ReactNode
  sticky?: boolean
  className?: string
}

export function AdminPageHeader({
  kicker,
  title,
  description,
  backHref,
  backLabel = 'Volver',
  actions,
  sticky = true,
  className,
}: AdminPageHeaderProps) {
  return (
    <header
      className={cn(
        'border-b border-border/50 bg-background/85 backdrop-blur-xl safe-area-header-pt safe-area-x flex items-center',
        sticky && 'sticky top-0 z-50',
        className,
      )}
    >
      {/* Usamos px-4 sm:px-6 md:px-8 en lugar de container para alineación perfecta con el Sidebar */}
      <div className="w-full flex min-h-[68px] flex-col justify-center gap-3 py-3 md:min-h-[104px] md:flex-row md:items-center md:justify-between md:gap-4 md:py-0 px-4 sm:px-6 md:px-8">
        <div className="flex min-w-0 items-center gap-4 h-full">
          {/* Leading icon: back arrow or logo */}
          <div className="shrink-0 flex items-center h-full">
            {backHref ? (
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="-ml-3 size-10 sm:size-11 rounded-full hover:bg-primary/10 hover:text-primary transition-all duration-300 md:ml-0"
              >
                <Link href={backHref} aria-label={backLabel}>
                  <ChevronLeft className="size-6 sm:size-7" strokeWidth={2.5} />
                </Link>
              </Button>
            ) : (
              <div className="flex items-center md:hidden">
                <div className="size-10 sm:size-11 rounded-full overflow-hidden border border-primary/20 shadow-xs shrink-0 bg-primary/10 flex items-center justify-center p-1.5">
                  <Image
                    src="/android-chrome-192x192.png"
                    alt="Logo RU Coach"
                    width={36}
                    height={36}
                    className="size-full object-contain p-0.5"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Title block */}
          <div className="min-w-0 flex flex-col justify-center py-1 sm:h-full">
            {kicker ? (
              <div className="mb-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary sm:text-[11px] leading-none">
                {kicker}
              </div>
            ) : null}
            <h1 className="text-xl font-black tracking-tight text-pretty sm:text-2xl md:text-3xl lg:text-4xl text-foreground leading-[1.1]">
              {title}
            </h1>
            {description ? (
              typeof description === 'string' ? (
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/90 sm:text-sm font-medium sm:mt-1.5">
                  {description}
                </p>
              ) : (
                <div className="mt-1 text-xs text-muted-foreground/90 sm:text-sm font-medium sm:mt-1.5">{description}</div>
              )
            ) : null}
          </div>
        </div>

        {/* Actions section */}
        {actions ? (
          <div className="flex w-full flex-wrap gap-3 md:w-auto md:flex-row md:items-center md:justify-end shrink-0 md:h-full">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}
