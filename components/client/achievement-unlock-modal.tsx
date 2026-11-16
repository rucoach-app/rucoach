'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AchievementBadge } from './achievement-badge'
import type { Achievement } from '@/lib/types'
import { Sparkles, Trophy, Share2 } from 'lucide-react'
import { toast } from 'sonner'

interface AchievementUnlockModalProps {
  achievements: Achievement[]
  onClose: () => void
}

export function AchievementUnlockModal({
  achievements,
  onClose,
}: AchievementUnlockModalProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const current = achievements[currentIndex]
  const isLast = currentIndex === achievements.length - 1

  if (!current) return null

  const handleShare = async () => {
    const shareText = [
      `🏆 *Nuevo logro desbloqueado en RU Coach*`,
      ``,
      `• *Logro:* ${current.name}`,
      `• *Recompensa:* +${current.xp_reward} XP`,
      current.description ? `• *Meta:* ${current.description}` : null,
      ``,
      `Seguimos sumando resultados con disciplina. 💪`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n')

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Logro desbloqueado: ${current.name} | RU Coach`,
          text: shareText,
          url: window.location.origin,
        })
        return
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${window.location.origin}`)
      toast.success('¡Mensaje copiado al portapapeles!')
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  return (
    <Dialog open={achievements.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl border border-border/80 bg-card text-card-foreground shadow-2xl shadow-primary/20 overflow-hidden overscroll-contain">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_115%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_65%)] pointer-events-none" />
        
        <DialogHeader className="relative z-10 pt-6">
          <div className="mx-auto size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-bounce">
            <Trophy className="size-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl font-bold tracking-tight">
            ¡Logro Desbloqueado!
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground text-base">
            Tu constancia y esfuerzo están dando frutos.
          </DialogDescription>
        </DialogHeader>

        <div className="relative z-10 flex flex-col items-center py-8">
          <div className="relative group">
             <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
             <AchievementBadge
               achievement={current}
               unlocked={true}
               size="xl"
               showDetails={false}
             />
          </div>
          
          <div className="mt-8 text-center space-y-2">
            <h4 className="text-xl font-bold text-foreground">{current.name}</h4>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {current.description}
            </p>
          </div>

          <div className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="size-4 text-primary" />
            <span className="text-sm font-bold text-primary">+{current.xp_reward} XP Recompensa</span>
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-3 pt-4 pb-2">
          {isLast ? (
            <Button 
              size="lg" 
              className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20"
              onClick={onClose}
            >
              ¡Genial, gracias!
            </Button>
          ) : (
            <Button 
              size="lg" 
              className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20"
              onClick={() => setCurrentIndex(prev => prev + 1)}
            >
              Ver siguiente ({currentIndex + 1}/{achievements.length})
            </Button>
          )}
          
          <Button 
            type="button"
            variant="outline" 
            size="lg" 
            className="w-full h-12 rounded-xl border-border/40 hover:bg-muted"
            onClick={handleShare}
          >
            <Share2 className="mr-2 size-4" />
            Compartir progreso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
