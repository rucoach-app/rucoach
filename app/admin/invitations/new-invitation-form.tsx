"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { createInvitationCode } from "@/app/actions/invitations";
import type { InvitationCodeItem } from "./invitation-cards-client";
import {
  UserPlus,
  User,
  ShieldCheck,
  Key,
  Copy,
  Check,
  Link2,
  MessageCircle,
  X,
  MailCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getPublicAppUrl } from "@/lib/utils";

interface NewInvitationFormProps {
  onCodeCreated?: (code: InvitationCodeItem) => void;
}

export function NewInvitationForm({ onCodeCreated }: NewInvitationFormProps) {
  const router = useRouter();
  const [forRole, setForRole] = React.useState<"client" | "admin">("client");
  const [emailValue, setEmailValue] = React.useState("");
  const [maxUses, setMaxUses] = React.useState("1");
  const [isPending, setIsPending] = React.useState(false);

  // Recién creado para banner interactivo inmediato
  const [recentlyCreated, setRecentlyCreated] = React.useState<{
    code: string;
    forRole: string;
    email: string | null;
    emailSent: boolean;
  } | null>(null);

  const [copiedCode, setCopiedCode] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);

  const hasSpecificEmail = emailValue.trim().length > 0;

  const getSignUpUrl = (code: string) =>
    `${getPublicAppUrl()}/auth/sign-up?code=${code}`;

  const handleCopyCode = (code: string) => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopiedCode(true);
        toast.success(`Código ${code} copiado al portapapeles.`);
        setTimeout(() => setCopiedCode(false), 2000);
      })
      .catch(() => toast.error("No pudimos copiar el código."));
  };

  const handleCopyLink = (code: string) => {
    const url = getSignUpUrl(code);
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedLink(true);
        toast.success("Enlace de registro copiado al portapapeles.");
        setTimeout(() => setCopiedLink(false), 2000);
      })
      .catch(() => toast.error("No pudimos copiar el enlace."));
  };

  const handleShareWhatsApp = (code: string, role: string) => {
    const url = getSignUpUrl(code);
    const roleLabel =
      role === "admin" ? "como Coach en RU Coach" : "a RU Coach";
    const text = `¡Hola! Te comparto tu código de invitación para unirte ${roleLabel}:\n\n🔑 Código: *${code}*\n👉 Regístrate directo aquí: ${url}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    const form = e.currentTarget;

    const formData = new FormData(form);
    formData.set("for_role", forRole);
    formData.set("max_uses", hasSpecificEmail ? "1" : maxUses || "1");

    try {
      const result = await createInvitationCode(formData);
      if (result.success && result.code) {
        const generatedCode = result.code;
        if (result.emailSent) {
          toast.success(
            `¡Código ${generatedCode} generado y enviado por correo!`,
          );
        } else {
          toast.success(
            `¡Código ${generatedCode} generado con éxito!`,
          );
        }

        const newCodePayload: InvitationCodeItem = (result.invitation as InvitationCodeItem) ?? {
          id: crypto.randomUUID(),
          code: generatedCode,
          email: emailValue.trim() || null,
          for_role: forRole,
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          times_used: 0,
          max_uses: hasSpecificEmail ? 1 : parseInt(maxUses) || 1,
          is_active: true,
          created_at: new Date().toISOString(),
          linked_client_id: null,
          linked_name: null,
          linked_phone: null,
        };

        setRecentlyCreated({
          code: generatedCode,
          forRole,
          email: emailValue.trim() || null,
          emailSent: Boolean(result.emailSent),
        });

        // Actualización optimista inmediata en la lista de abajo
        onCodeCreated?.(newCodePayload);

        // Revalidar en segundo plano con el servidor
        router.refresh();

        form.reset();
        setEmailValue("");
        setMaxUses("1");
      } else {
        toast.error(
          result?.error || "No pudimos generar el código. Intenta de nuevo.",
        );
      }
    } catch (error) {
      toast.error("No pudimos generar el código. Revisa tu conexión.");
      console.error(error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="size-5 text-primary" />
              Generar nuevo código de acceso
            </CardTitle>
            <CardDescription>
              Crea invitaciones exclusivas para nuevos asesorados o agrega otro coach a tu equipo.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={
              forRole === "admin"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold px-3 py-1"
                : "border-primary/30 bg-primary/10 text-primary font-bold px-3 py-1"
            }
          >
            {forRole === "admin" ? "Modo: Nuevo Coach / Admin" : "Modo: Nuevo Asesorado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Banner de código recién generado con acciones inmediatas */}
        {recentlyCreated && (
          <div className="mb-6 rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-4 sm:p-5 shadow-md animate-in fade-in slide-in-from-top-3 duration-300">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  <Check className="size-4 stroke-[3]" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    ¡Código de invitación listo para compartir!
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {recentlyCreated.emailSent
                      ? `Enviado por correo a ${recentlyCreated.email}`
                      : "Copia el código o envíalo directamente por WhatsApp al atleta o coach."}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRecentlyCreated(null)}
                className="size-7 rounded-full text-muted-foreground hover:text-foreground"
                title="Cerrar aviso"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/90 p-3 sm:p-4 rounded-xl border border-border/60 shadow-sm">
              <div className="flex items-center gap-3">
                <Key className="size-5 text-primary shrink-0" />
                <div>
                  <span className="font-mono text-2xl font-black tracking-widest text-primary uppercase select-all">
                    {recentlyCreated.code}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant="secondary"
                      className="text-[10px] uppercase font-bold px-1.5 py-0"
                    >
                      {recentlyCreated.forRole === "admin" ? "Coach" : "Cliente"}
                    </Badge>
                    {recentlyCreated.email && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 truncate max-w-[200px]">
                        <MailCheck className="size-3 text-primary" /> {recentlyCreated.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyCode(recentlyCreated.code)}
                  className="rounded-xl h-9 text-xs font-semibold"
                >
                  {copiedCode ? (
                    <>
                      <Check className="size-3.5 mr-1.5 text-primary" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5 mr-1.5" /> Copiar Código
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyLink(recentlyCreated.code)}
                  className="rounded-xl h-9 text-xs font-semibold"
                >
                  {copiedLink ? (
                    <>
                      <Check className="size-3.5 mr-1.5 text-primary" /> Enlace Copiado
                    </>
                  ) : (
                    <>
                      <Link2 className="size-3.5 mr-1.5" /> Copiar Enlace
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    handleShareWhatsApp(
                      recentlyCreated.code,
                      recentlyCreated.forRole,
                    )
                  }
                  className="rounded-xl h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                >
                  <MessageCircle className="size-3.5 mr-1.5" /> WhatsApp
                </Button>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)] lg:items-end"
        >
          <input type="hidden" name="for_role" value={forRole} />

          <FieldGroup>
            <Field>
              <FieldLabel className="text-sm font-semibold">
                ¿A quién vas a invitar?
              </FieldLabel>
              <Tabs
                value={forRole}
                onValueChange={(val) => {
                  if (val === "client" || val === "admin") setForRole(val);
                }}
                className="w-full"
              >
                <ScrollArea className="w-full whitespace-nowrap">
                  <TabsList className="inline-flex w-auto bg-muted/60 p-1 h-12 rounded-2xl border border-border/50 shadow-sm">
                    <TabsTrigger
                      value="client"
                      type="button"
                      className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md gap-2 text-xs sm:text-sm font-semibold transition-all"
                    >
                      <User className="size-4" />
                      Cliente (asesorado)
                    </TabsTrigger>
                    <TabsTrigger
                      value="admin"
                      type="button"
                      className="rounded-xl px-4 py-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md gap-2 text-xs sm:text-sm font-semibold transition-all"
                    >
                      <ShieldCheck className="size-4" />
                      Coach / Administrador
                    </TabsTrigger>
                  </TabsList>
                  <ScrollBar orientation="horizontal" className="invisible" />
                </ScrollArea>
              </Tabs>
              <div className="mt-3 flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground bg-muted/20 p-3 rounded-xl border border-border/50">
                {forRole === "admin" ? (
                  <>
                    <ShieldCheck
                      className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5"
                      aria-hidden
                    />
                    <div>
                      <span className="font-bold text-foreground">Acceso de Coach:</span>{" "}
                      El usuario que canjee este código tendrá permisos de administrador, acceso a toda la gestión de rutinas, ejercicios y atletas.
                    </div>
                  </>
                ) : (
                  <>
                    <User
                      className="size-4 shrink-0 text-primary mt-0.5"
                      aria-hidden
                    />
                    <div>
                      <span className="font-bold text-foreground">Acceso de Atleta:</span>{" "}
                      El asesorado podrá crear su cuenta y quedará vinculado directamente a tu cartera para que puedas asignarle rutinas y seguimiento.
                    </div>
                  </>
                )}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field className="sm:col-span-1">
                <FieldLabel htmlFor="email" className="text-xs font-semibold">
                  Email específico (opcional)
                </FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  className="rounded-xl"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Si lo indicas, el código queda reservado exclusivamente para ese email y se envía por correo.
                </p>
              </Field>

              <Field>
                <FieldLabel htmlFor="expires_in_days" className="text-xs font-semibold">
                  Expira en (días)
                </FieldLabel>
                <Input
                  id="expires_in_days"
                  name="expires_in_days"
                  type="number"
                  defaultValue={30}
                  min={1}
                  max={365}
                  className="rounded-xl"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Vigencia del código (1 a 365 días).
                </p>
              </Field>

              <Field>
                <FieldLabel htmlFor="max_uses" className="text-xs font-semibold">
                  Límite de usos
                </FieldLabel>
                <Input
                  id="max_uses"
                  name="max_uses"
                  type="number"
                  value={hasSpecificEmail ? "1" : maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  disabled={hasSpecificEmail}
                  min={1}
                  max={100}
                  className="rounded-xl"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {hasSpecificEmail
                    ? "1 uso único (asignado al email)."
                    : "Usa >1 para registros abiertos de grupos."}
                </p>
              </Field>
            </div>
          </FieldGroup>

          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Acción rápida
              </p>
              <p className="text-xs text-foreground font-medium">
                {forRole === "admin"
                  ? "Crear código para un nuevo Coach"
                  : "Crear código para un nuevo Atleta"}
              </p>
            </div>
            <Separator />
            <Button
              type="submit"
              disabled={isPending}
              className={`w-full lg:w-auto lg:min-w-44 lg:self-end rounded-xl font-bold shadow-sm transition-all ${
                forRole === "admin"
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : ""
              }`}
            >
              {forRole === "admin" ? (
                <ShieldCheck className="mr-2 size-4" />
              ) : (
                <UserPlus className="mr-2 size-4" />
              )}
              {isPending
                ? "Generando..."
                : forRole === "admin"
                  ? "Generar código de Coach"
                  : "Generar código de Cliente"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
