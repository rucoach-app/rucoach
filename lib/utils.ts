import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Devuelve siempre el dominio público canónico (`https://rucoach.app`) en producción,
 * evitando que pestañas abiertas en `.vercel.app` generen enlaces de invitación con el subdominio de Vercel.
 */
export function getPublicAppUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return window.location.origin
    }
    return 'https://rucoach.app'
  }
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (
    envUrl &&
    !envUrl.includes('vercel.app') &&
    !envUrl.includes('localhost')
  ) {
    return envUrl
  }
  return 'https://rucoach.app'
}

/**
 * Normaliza cualquier teléfono mexicano o internacional para enlaces de WhatsApp (12 dígitos `52` + 10 dígitos nacionales).
 */
export function formatMexicoWhatsAppNumber(rawPhone?: string | null): string {
  const digits = (rawPhone || '').replace(/\D/g, '')
  if (!digits) return ''
  // Si viene con el antiguo prefijo 521 + 10 dígitos (13 dígitos), quitar el 1 intermedio
  if (digits.length === 13 && digits.startsWith('521')) {
    return `52${digits.slice(3)}`
  }
  // Si son 10 dígitos nacionales (México), anteponer 52
  if (digits.length === 10) {
    return `52${digits}`
  }
  return digits
}

