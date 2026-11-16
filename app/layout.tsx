import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { PWASetup } from "@/components/pwa-setup";
import { PWAInstallCTA } from "@/components/pwa-install-cta";
import { PersonSchema, OrganizationSchema } from "@/components/seo-schema";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://rucoach.app"),
  title: {
    default: "Entrenamiento Personal Premium | RU Coach - Rodrigo Urbina",
    template: "%s | RU Coach",
  },
  description:
    "Transforma tu físico con el coaching de élite de Rodrigo Urbina en RU Coach. Progresión automática, seguimiento avanzado y resultados garantizados. ¡Comienza hoy!",
  manifest: "/manifest.json",
  keywords: [
    "Rodrigo Urbina",
    "RU Coach",
    "entrenamiento personal",
    "fitness",
    "coaching premium",
    "rutinas de gimnasio",
    "hipertrofia",
    "fuerza",
  ],
  authors: [{ name: "Rodrigo Urbina" }],
  openGraph: {
    title: "RU Coach | Entrenamiento Personalizado de Élite",
    description:
      "Rutinas a tu medida, control de cargas, récords personales y seguimiento continuo con Rodrigo Urbina.",
    type: "website",
    url: "https://rucoach.app",
    siteName: "RU Coach",
    locale: "es_MX",
  },
  twitter: {
    card: "summary_large_image",
    title: "RU Coach | Entrenamiento Personalizado de Élite",
    description:
      "Rutinas a tu medida, control de cargas, récords personales y seguimiento continuo con Rodrigo Urbina.",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RU Coach",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFA" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var sa=navigator.standalone===true||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches);if(!sa)return;d.classList.add('is-standalone');var p=document.createElement('div');p.style.cssText='position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';d.appendChild(p);var cs=getComputedStyle(p);var t=parseFloat(cs.paddingTop)||0;var b=parseFloat(cs.paddingBottom)||0;d.removeChild(p);if(t===0&&/iPhone/.test(navigator.userAgent)){var h=Math.max(screen.width,screen.height);if(h>=812){var m={812:44,844:47,852:59,874:62,896:48,926:47,932:59,956:62};d.style.setProperty('--inset-top-fb',(m[h]||47)+'px');d.style.setProperty('--inset-bottom-fb','34px')}}}catch(e){}})();`,
          }}
        />
        <link rel="alternate" href="https://rucoach.app" hrefLang="es" />
        <PersonSchema />
        <OrganizationSchema />
      </head>
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans antialiased min-h-dvh`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-[max(1rem,env(safe-area-inset-top))] focus:z-[9999] focus:px-4 focus:py-3 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:font-medium focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Saltar al contenido principal
          </a>
          {children}
          <Toaster
            position="top-center"
            offset="max(1rem, env(safe-area-inset-top, 1rem))"
            mobileOffset={{
              top: "max(1rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))",
              bottom: "max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))",
              left: "max(1rem, env(safe-area-inset-left, 1rem))",
              right: "max(1rem, env(safe-area-inset-right, 1rem))",
            }}
            toastOptions={{
              style: {
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              },
            }}
          />
          <PWASetup />
          <PWAInstallCTA />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
