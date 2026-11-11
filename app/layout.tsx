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
    title: "RU Coach | Rodrigo Urbina - Entrenamiento Personal Premium",
    description:
      "La plataforma de fitness definitiva para el seguimiento de entrenamiento de élite, diseñada por Rodrigo Urbina.",
    type: "website",
    url: "https://rucoach.app",
    siteName: "RU Coach",
    images: [
      {
        url: "/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: "RU Coach Premium Fitness",
      },
    ],
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
