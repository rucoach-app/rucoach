import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') || request.nextUrl.hostname
  if (host === 'rucoach-development.vercel.app') {
    const canonicalUrl = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      'https://rucoach.app',
    )
    return NextResponse.redirect(canonicalUrl, 308)
  }

  const url = request.nextUrl.pathname

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', url)

  // 1. Respuesta base
  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // 2. Cliente Supabase con lógica de cookies robusta para Vercel
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY!

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Actualizar request (para Server Components)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          
          // Actualizar response (para el Navegador)
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const publicPaths = [
    '/auth',
    '/welcome',
    '/offline',
    '/api/invitations',
    '/favicon.ico',
    '/manifest.json',
    '/dev-sw.js',
    '/push-sw.js',
    '/robots.txt',
    '/sitemap.xml',
    '/login',
    '/signup',
  ]
  const isPublicPath = publicPaths.some((path) => url.startsWith(path))
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-'))

  // En rutas públicas sin cookie de sesión, evitar el viaje de red a Supabase Auth
  if (isPublicPath && !hasAuthCookie) {
    return response
  }

  // 3. Permitir el Router Cache en memoria de Next.js en navegaciones/prefetches RSC
  const isRscRequest =
    request.headers.get('rsc') === '1' ||
    request.headers.get('next-router-prefetch') === '1'

  // 4. Obtener usuario (usando verificación JWT local rápida en RSC/prefetch si hay cookie)
  let user: { id: string } | null = null
  if (isRscRequest && hasAuthCookie) {
    try {
      const { data: claimsData } = await supabase.auth.getClaims()
      if (claimsData?.claims?.sub) {
        user = { id: claimsData.claims.sub }
      }
    } catch {
      // Fallback si la verificación de claims falla
    }
  }

  if (!user) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    user = authUser
  }

  // 5. Si no hay usuario y es ruta protegida -> Redirigir
  if (!user && !isPublicPath && url !== '/') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    const redirectResponse = NextResponse.redirect(redirectUrl)

    // IMPORTANTE: Copiar cookies a la redirección
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  if (!isPublicPath && !isRscRequest) {
    response.headers.set('Cache-Control', 'private, no-cache, must-revalidate')
    response.headers.set('Vary', 'Cookie')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|push-sw\\.js|dev-sw\\.js|offline\\.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
