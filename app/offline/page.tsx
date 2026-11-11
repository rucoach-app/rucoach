"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { WifiOff, RefreshCw, Home } from "lucide-react";

export default function OfflinePage() {
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
        role="main"
        className="flex-1 flex items-center justify-center px-4 py-6 sm:p-6 safe-area-inset-bottom"
        tabIndex={-1}
      >
        <Card className="w-full max-w-md text-center rounded-2xl border-border/60 bg-card/85 backdrop-blur-xl shadow-2xl">
          <CardHeader className="pb-4 pt-6 px-5 sm:px-6">
            <div className="mx-auto size-18 sm:size-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-5 ring-1 ring-amber-500/20">
              <WifiOff className="size-9 sm:size-10 text-amber-500" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
              Sin Conexión
            </CardTitle>
            <CardDescription className="text-sm sm:text-base font-medium">
              No pudimos conectar con{" "}
              <span className="text-foreground font-bold">RU Coach</span>. Verifica
              tu conexión a internet e inténtalo nuevamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-5 pb-6 sm:px-6">
            <div className="space-y-3">
              <Button
                onClick={() => window.location.reload()}
                className="w-full gap-2 h-12 text-sm font-bold uppercase tracking-tight rounded-xl"
              >
                <RefreshCw className="size-4" />
                Reintentar conexión
              </Button>

              <Button
                variant="outline"
                className="w-full gap-2 h-12 text-sm font-semibold rounded-xl border-border/60 hover:bg-muted transition-all"
                asChild
              >
                <Link href="/">
                  <Home className="size-4" />
                  Volver al inicio
                </Link>
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
              RU Coach · Rodrigo Urbina — Coaching de Élite
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
