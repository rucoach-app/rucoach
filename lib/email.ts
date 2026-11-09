import { Resend } from 'resend'
import { render } from '@react-email/components'
import * as React from 'react'
import { InvitationEmail } from '@/emails/InvitationEmail'
import { WelcomeEmail } from '@/emails/WelcomeEmail'
import { NewRoutineEmail } from '@/emails/NewRoutineEmail'
import { PaymentConfirmationEmail } from '@/emails/PaymentConfirmationEmail'

let resendInstance: Resend | null = null

function getResend() {
  if (resendInstance) return resendInstance
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  resendInstance = new Resend(key)
  return resendInstance
}

const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  process.env.RESEND_FROM_EMAIL ||
  'RU Coach <noreply@rucoach.app>'

function getAppUrl(): string {
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

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

/**
 * Envía el código de invitación al asesorado cuando el admin lo da de alta.
 */
export async function sendClientInvitationEmail(params: {
  to: string
  clientName: string
  code: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { success: false, error: 'Email no configurado' }

  const signUpUrl = `${getAppUrl()}/auth/sign-up?code=${params.code}`
  
  try {
    const html = await render(
      React.createElement(InvitationEmail, {
        clientName: params.clientName,
        code: params.code,
        signUpUrl
      })
    )

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [params.to],
      subject: `💪 Tu código de acceso a RU Coach`,
      html,
    })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    console.error('Error rendering/sending invitation email:', err)
    return { success: false, error: 'Error interno al enviar email' }
  }
}

/**
 * Envía un correo de bienvenida cuando el usuario completa su registro.
 */
export async function sendWelcomeEmail(params: {
  to: string
  clientName: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { success: false, error: 'Email no configurado' }

  try {
    const html = await render(
      React.createElement(WelcomeEmail, {
        clientName: params.clientName
      })
    )

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [params.to],
      subject: `🚀 ¡Bienvenido a RU Coach!`,
      html,
    })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch {
    return { success: false, error: 'Error al enviar bienvenida' }
  }
}

/**
 * Notifica al cliente que se le ha asignado una nueva rutina.
 */
export async function sendNewRoutineNotification(params: {
  to: string
  clientName: string
  routineName: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { success: false, error: 'Email no configurado' }

  try {
    const html = await render(
      React.createElement(NewRoutineEmail, {
        clientName: params.clientName,
        routineName: params.routineName
      })
    )

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [params.to],
      subject: `🏋️ Nueva rutina asignada: ${params.routineName}`,
      html,
    })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch {
    return { success: false, error: 'Error al enviar notificación de rutina' }
  }
}

/**
 * Envía confirmación de pago recibido.
 */
export async function sendPaymentConfirmation(params: {
  to: string
  clientName: string
  amount: string
  planName: string
  expiryDate: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { success: false, error: 'Email no configurado' }

  try {
    const html = await render(
      React.createElement(PaymentConfirmationEmail, {
        clientName: params.clientName,
        amount: params.amount,
        planName: params.planName,
        expiryDate: params.expiryDate
      })
    )

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [params.to],
      subject: `✅ Pago confirmado - RU Coach`,
      html,
    })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch {
    return { success: false, error: 'Error al enviar confirmación de pago' }
  }
}

/**
 * Invitación manual (solo código).
 */
export async function sendManualInvitationEmail(params: {
  to: string
  code: string
  forRole?: 'admin' | 'client'
}): Promise<{ success: boolean; error?: string }> {
  return sendClientInvitationEmail({
    to: params.to,
    clientName: params.forRole === 'admin' ? 'Coach' : 'Atleta',
    code: params.code
  })
}
