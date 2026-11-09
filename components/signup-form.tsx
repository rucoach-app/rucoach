'use client'

import { createClient } from '@/lib/supabase/client'
import { useInvitationCode as consumeInvitationCode } from '@/app/actions/invitations'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  PasswordInput,
  getPasswordRequirements,
  isPasswordValid,
} from '@/components/ui/password-input'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import { toast } from 'sonner'
import { cn, getPublicAppUrl } from '@/lib/utils'

function SignUpFormInner({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const [invitationCode, setInvitationCode] = useState('')
  const [isCodeValid, setIsCodeValid] = useState(false)
  const [signUpRole, setSignUpRole] = useState<'admin' | 'client'>('client')
  const [isValidating, setIsValidating] = useState(false)
  const [email, setEmail] = useState('')
  const [lockedEmail, setLockedEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const codeFromUrl = searchParams.get('code')
    if (!codeFromUrl || codeFromUrl.length < 6) return

    setInvitationCode(codeFromUrl.toUpperCase())

    const validate = async () => {
      setIsValidating(true)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      try {
        const res = await fetch('/api/invitations/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeFromUrl }),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        const text = await res.text()
        let result: {
          valid?: boolean
          error?: string
          invitation?: { email?: string }
          role?: 'admin' | 'client'
        } = {}
        try {
          result = text ? JSON.parse(text) : {}
        } catch {
          throw new Error('Respuesta inválida')
        }
        if (!res.ok) {
          toast.error(
            result.error ||
              'No pudimos validar el código. Revisa que sea correcto e intenta de nuevo.'
          )
          setIsCodeValid(false)
          return
        }
        if (result.valid) {
          setIsCodeValid(true)
          if (result.role) setSignUpRole(result.role)
          toast.success(
            result.role === 'admin'
              ? '¡Código de coach válido! Serás el administrador.'
              : '¡Código de invitación válido!'
          )
          if (result.invitation?.email) {
            setEmail(result.invitation.email)
            setLockedEmail(result.invitation.email)
          } else {
            setLockedEmail(null)
          }
        } else {
          setIsCodeValid(false)
          toast.error(
            result.error || 'Código no válido. Verifica que esté bien escrito.'
          )
        }
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') {
          toast.error('La validación tardó demasiado. Revisa tu conexión.')
        } else {
          toast.error('No pudimos validar el código. Intenta de nuevo.')
        }
      } finally {
        clearTimeout(timeout)
        setIsValidating(false)
      }
    }
    validate()
  }, [searchParams])

  const handleValidateCode = async (code?: string) => {
    const codeToValidate = code || invitationCode
    if (!codeToValidate || codeToValidate.length < 6) return

    setIsValidating(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch('/api/invitations/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeToValidate }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const text = await res.text()
      let result: {
        valid?: boolean
        error?: string
        invitation?: { email?: string }
        role?: 'admin' | 'client'
      } = {}
      try {
        result = text ? JSON.parse(text) : {}
      } catch {
        throw new Error('Respuesta inválida')
      }
      if (!res.ok) {
        toast.error(
          result.error || 'No pudimos validar el código. Intenta de nuevo.'
        )
        setIsCodeValid(false)
        return
      }
      if (result.valid) {
        setIsCodeValid(true)
        if (result.role) setSignUpRole(result.role)
        toast.success(
          result.role === 'admin'
            ? '¡Código de coach válido! Serás el administrador.'
            : '¡Código de invitación válido!'
        )
        if (result.invitation?.email) {
          setEmail(result.invitation.email)
          setLockedEmail(result.invitation.email)
        } else {
          setLockedEmail(null)
        }
      } else {
        setIsCodeValid(false)
        toast.error(
          result.error || 'Código no válido. Verifica que sea correcto.'
        )
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        toast.error('La validación tardó demasiado. Revisa tu conexión.')
      } else {
        toast.error('No pudimos validar el código. Intenta de nuevo.')
      }
    } finally {
      clearTimeout(timeout)
      setIsValidating(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isCodeValid) {
      toast.error('Necesitas un código de invitación válido para continuar.')
      return
    }

    if (
      lockedEmail &&
      email.trim().toLowerCase() !== lockedEmail.trim().toLowerCase()
    ) {
      toast.error(
        'Debes registrarte con el correo al que fue enviada la invitación.'
      )
      return
    }

    const supabase = createClient()
    setIsLoading(true)

    if (password !== repeatPassword) {
      toast.error('Las contraseñas no coinciden. Escríbelas igual en ambos campos.')
      setIsLoading(false)
      return
    }

    const req = getPasswordRequirements(password)
    if (!isPasswordValid(req)) {
      toast.error('La contraseña debe cumplir todos los requisitos indicados abajo.')
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role: signUpRole },
          emailRedirectTo: `${getPublicAppUrl()}/auth/callback`,
        },
      })

      if (error) throw error

      if (data.user?.identities?.length === 0) {
        toast.error('Este correo ya está registrado. Inicia sesión o usa otro correo.')
        return
      }

      if (data.user) {
        await consumeInvitationCode(invitationCode, data.user.id, signUpRole)
      }

      if (data.session) {
        toast.success(
          signUpRole === 'admin' ? '¡Cuenta de coach creada!' : '¡Cuenta creada correctamente!'
        )
        router.push(signUpRole === 'admin' ? '/admin/onboarding' : '/onboarding')
      } else {
        toast.success('Cuenta creada. Revisa tu correo para continuar la verificación.')
        router.push(`/auth/verify-otp?email=${encodeURIComponent(email)}`)
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : ''
      console.error('[auth] signUp failed:', error)
      const isRateLimit =
        msg.toLowerCase().includes('rate limit') || msg.includes('429')
      toast.error(
        isRateLimit
          ? 'Demasiados intentos. Espera un minuto e intenta de nuevo.'
          : msg || 'No pudimos crear la cuenta. Revisa tus datos e intenta de nuevo.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      {/* Invitation Code Step */}
      {!isCodeValid && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleValidateCode()
          }}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col items-center gap-2 text-center md:items-start md:text-left">
            <h1 className="text-2xl font-bold tracking-tight">Únete a RU Coach</h1>
            <p className="text-sm text-balance text-muted-foreground">
              Ingresa tu código de invitación para comenzar tu transformación con Rodrigo Urbina.
            </p>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invitation-code" suppressHydrationWarning>
                Código de invitación
              </FieldLabel>
              <Input
                id="invitation-code"
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                spellCheck={false}
                placeholder="RUCOACH"
                value={invitationCode}
                onChange={(e) =>
                  setInvitationCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  )
                }
                disabled={isValidating}
                className="h-12 text-center text-xl font-mono tracking-[0.3em] uppercase"
                maxLength={8}
              />
              <FieldDescription>
                Tu coach te proporcionó un código único de 6-8 caracteres.
              </FieldDescription>
            </Field>
            <Field>
              <Button
                type="submit"
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold cursor-pointer transition-all duration-200"
                disabled={isValidating || invitationCode.length < 6}
              >
                {isValidating ? 'Validando…' : 'Validar código'}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      )}

      {/* Registration Form Step */}
      {isCodeValid && (
        <form onSubmit={handleSignUp} className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2 text-center md:items-start md:text-left">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Crea tu cuenta</h1>
              <div className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded-full border border-primary/20">
                Código Válido
              </div>
            </div>
            <p className="text-sm text-balance text-muted-foreground">
              Completa tus datos para empezar con tu plan personalizado.
            </p>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || !!lockedEmail}
                readOnly={!!lockedEmail}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                placeholder="Crea una contraseña segura"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                showValidation
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="repeat-password">
                Confirmar contraseña
              </FieldLabel>
              <PasswordInput
                id="repeat-password"
                autoComplete="new-password"
                placeholder="Repite tu contraseña"
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                disabled={isLoading}
              />
            </Field>
            <Field>
              <Button
                type="submit"
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold cursor-pointer transition-all duration-200"
                disabled={
                  isLoading ||
                  !isPasswordValid(getPasswordRequirements(password)) ||
                  password !== repeatPassword
                }
              >
                {isLoading ? 'Creando cuenta…' : 'Comenzar ahora'}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      )}

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link
            href="/auth/login"
            className="font-medium text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}

export function SignupForm(props: React.ComponentProps<'div'>) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Cargando…
        </div>
      }
    >
      <SignUpFormInner {...props} />
    </Suspense>
  )
}
