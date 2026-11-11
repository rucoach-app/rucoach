"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

function getRedirectUrl() {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
          /\/$/,
          "",
        );
  return `${origin}/auth/callback?next=/auth/reset-password&type=recovery`;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectUrl(),
      });

      if (error) throw error;
      setSent(true);
      toast.success(
        "Revisa tu correo. Te enviamos un enlace para restablecer tu contraseña.",
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "";
      const isRateLimit =
        msg.toLowerCase().includes("rate limit") || msg.includes("429");
      toast.error(
        isRateLimit
          ? "Demasiados intentos. Espera un minuto e intenta de nuevo."
          : "No pudimos enviar el correo. Revisa el correo e intenta de nuevo.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col gap-4 px-6 pt-[max(1.5rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] safe-area-x md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="flex size-8 items-center justify-center rounded-md overflow-hidden">
              <Image
                src="/android-chrome-512x512.png"
                alt="Logo RU Coach"
                width={32}
                height={32}
                className="size-full object-contain"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tighter uppercase">
                RU Coach
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">
                Rodrigo Urbina
              </span>
            </div>
          </Link>
        </div>
        <main id="main-content" className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-2 text-center md:items-start md:text-left">
                <h1 className="text-2xl font-bold tracking-tight">
                  {sent ? "Revisa tu correo" : "¿Olvidaste tu contraseña?"}
                </h1>
                <p className="text-sm text-balance text-muted-foreground">
                  {sent
                    ? "Te hemos enviado un enlace para restablecer tu contraseña. Revisa también la carpeta de spam."
                    : "Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña."}
                </p>
              </div>

              {!sent ? (
                <form onSubmit={handleSubmit}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@email.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                      />
                    </Field>
                    <Field>
                      <Button
                        type="submit"
                        className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold cursor-pointer transition-all duration-200"
                        disabled={isLoading}
                      >
                        {isLoading ? "Enviando..." : "Enviar enlace"}
                      </Button>
                    </Field>
                  </FieldGroup>
                </form>
              ) : (
                <div className="flex flex-col gap-3">
                  <Button
                    className="w-full h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                    asChild
                  >
                    <Link
                      href={`/auth/verify-otp?email=${encodeURIComponent(email)}&type=recovery`}
                    >
                      Ingresar código de seguridad
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full h-11 rounded-xl" asChild>
                    <Link href="/auth/login">
                      <ArrowLeft className="size-4 mr-2" />
                      Volver al inicio de sesión
                    </Link>
                  </Button>
                </div>
              )}

              {!sent && (
                <div className="text-center">
                  <Link
                    href="/auth/login"
                    className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                  >
                    Volver al inicio de sesión
                  </Link>
                </div>
              )}
            </div>
          </div>
        </main>
        <div className="flex justify-center md:justify-start">
          <ThemeToggle />
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <Image
          src="/img-login.jpg"
          alt="RU Coach Training"
          fill
          priority
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.4] dark:grayscale-[0.2] transition-all duration-500"
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent lg:from-background/20" />
      </div>
    </div>
  );
}
