import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="safe-area-header-pt safe-area-x border-b border-border/50 bg-background/85 backdrop-blur-md sticky top-0 z-50">
        <div className="container max-w-4xl mx-auto h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="size-9 rounded-lg overflow-hidden bg-black flex items-center justify-center shrink-0 border border-border/40">
              <Image
                src="/android-chrome-512x512.png"
                alt="Logo RU Coach"
                width={36}
                height={36}
                className="size-full object-contain"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black tracking-tighter uppercase text-lg">
                RU Coach
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mt-0.5">
                Rodrigo Urbina
              </span>
            </div>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main
        id="main-content"
        className="flex-1 flex items-center justify-center px-4 py-6 sm:p-6 safe-area-inset-bottom"
        tabIndex={-1}
      >
        <div className="w-full max-w-md">
          <Card className="w-full text-center rounded-2xl border-border/60 bg-card/85 backdrop-blur-xl shadow-2xl">
            <CardHeader className="pb-4 pt-6 px-5 sm:px-6">
              <div className="mx-auto size-18 sm:size-20 rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20 flex items-center justify-center mb-5">
                <AlertCircle className="size-9 sm:size-10 text-destructive" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
                Error de Autenticación
              </CardTitle>
              <CardDescription className="text-sm sm:text-base font-medium">
                Hubo un problema al procesar tu solicitud
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-5 pb-6 sm:px-6">
              <p className="text-sm text-muted-foreground">
                {message ||
                  "No pudimos procesar tu solicitud de autenticación. Por favor, intenta de nuevo o contacta al soporte si el problema persiste."}
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild className="w-full h-12 rounded-xl font-semibold">
                  <Link href="/auth/login">Volver a Iniciar Sesión</Link>
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="w-full h-12 rounded-xl font-semibold border-border/60 hover:bg-muted transition-all"
                >
                  <Link href="/auth/sign-up">Crear Nueva Cuenta</Link>
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                RU Coach · Rodrigo Urbina — Coaching de Élite
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
