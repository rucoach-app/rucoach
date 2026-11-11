"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  PasswordInput,
  getPasswordRequirements,
  isPasswordValid,
} from "@/components/ui/password-input";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN" ||
        !!session
      ) {
        setIsAuthenticated(true);
      }
    });

    const checkAuth = async () => {
      try {
        if (typeof window !== "undefined") {
          const searchParams = new URLSearchParams(window.location.search);
          const code = searchParams.get("code");
          const tokenHash = searchParams.get("token_hash");
          const type = searchParams.get("type");

          if (code) {
            const { data } = await supabase.auth.exchangeCodeForSession(code);
            if (data.session && mounted) {
              setIsAuthenticated(true);
              return;
            }
          } else if (tokenHash) {
            const { data } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: (type as "recovery" | "email") || "recovery",
            });
            if (data.session && mounted) {
              setIsAuthenticated(true);
              return;
            }
          }

          if (window.location.hash) {
            const hashParams = new URLSearchParams(
              window.location.hash.slice(1),
            );
            const accessToken = hashParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token");
            if (accessToken && refreshToken) {
              const { data } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (data.session && mounted) {
                setIsAuthenticated(true);
                return;
              }
            }
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setIsAuthenticated(!!session);
        if (!session) {
          router.replace("/auth/forgot-password");
        }
      } catch {
        if (mounted) {
          setIsAuthenticated(false);
          router.replace("/auth/forgot-password");
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(
        "Las contraseñas no coinciden. Escríbelas igual en ambos campos.",
      );
      return;
    }
    const req = getPasswordRequirements(password);
    if (!isPasswordValid(req)) {
      toast.error(
        "La contraseña debe cumplir todos los requisitos indicados abajo.",
      );
      return;
    }

    const supabase = createClient();
    setIsLoading(true);

    try {
      const { data: updateData, error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      toast.success("¡Contraseña actualizada con éxito!");

      const userId = updateData.user?.id;
      let targetPath = "/client/dashboard";

      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, onboarding_completed")
          .eq("id", userId)
          .maybeSingle();

        const role =
          profile?.role ??
          (updateData.user?.user_metadata?.role as string | undefined) ??
          "client";

        if (profile && !profile.onboarding_completed) {
          targetPath = role === "admin" ? "/admin/onboarding" : "/onboarding";
        } else if (role === "admin") {
          targetPath = "/admin/dashboard";
        } else if (role === "receptionist") {
          targetPath = "/receptionist/dashboard";
        } else {
          targetPath = "/client/dashboard";
        }
      }

      router.push(targetPath);
      router.refresh();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "";
      const isRateLimit =
        msg.toLowerCase().includes("rate limit") || msg.includes("429");
      toast.error(
        isRateLimit
          ? "Demasiados intentos. Espera un minuto e intenta de nuevo."
          : "No pudimos actualizar la contraseña. Intenta de nuevo.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div
        id="main-content"
        className="min-h-dvh flex items-center justify-center p-6 bg-background"
      >
        <div className="animate-spin size-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

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
                  Nueva contraseña
                </h1>
                <p className="text-sm text-balance text-muted-foreground">
                  Elige una contraseña segura para proteger tu cuenta de RU
                  Coach.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="password">Nueva contraseña</FieldLabel>
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
                    <FieldLabel htmlFor="confirm">
                      Confirmar contraseña
                    </FieldLabel>
                    <PasswordInput
                      id="confirm"
                      autoComplete="new-password"
                      placeholder="Repite tu contraseña"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
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
                        password !== confirmPassword
                      }
                    >
                      {isLoading ? "Guardando..." : "Guardar contraseña"}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>

              <div className="text-center">
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                >
                  Volver al inicio de sesión
                </Link>
              </div>
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
