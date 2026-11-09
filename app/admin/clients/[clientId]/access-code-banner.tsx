"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Send,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { resendInvitationCodeEmail } from "@/app/actions/invitations";
import { formatMexicoWhatsAppNumber, getPublicAppUrl } from "@/lib/utils";

interface AccessCodeBannerProps {
  code: string;
  codeId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  emailSent?: boolean;
  emailFailed?: boolean;
}

export function AccessCodeBanner({
  code,
  codeId,
  clientName,
  clientEmail,
  clientPhone,
  emailSent,
  emailFailed,
}: AccessCodeBannerProps) {
  const [copied, setCopied] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const signUpUrl = `${getPublicAppUrl()}/auth/sign-up?code=${code}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("¡Código copiado! Pégalo donde lo necesites.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(signUpUrl);
    toast.success("¡Enlace de registro copiado! Compártelo con tu asesorado.");
  };

  const handleShareWhatsApp = () => {
    const greeting = clientName ? `¡Hola ${clientName}! ` : "¡Hola! ";
    const text = `${greeting}Te comparto tu código de invitación para activar tu cuenta en RU Coach:\n\n🔑 Código: *${code}*\n👉 Regístrate directo aquí: ${signUpUrl}`;
    const phoneParam = formatMexicoWhatsAppNumber(clientPhone);
    const waUrl = phoneParam
      ? `https://api.whatsapp.com/send?phone=${phoneParam}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleResendEmail = async () => {
    if (!codeId) return;
    setIsResending(true);
    try {
      const res = await resendInvitationCodeEmail(codeId);
      if (res && "success" in res && res.success) {
        toast.success(`Invitación reenviada a ${clientEmail}.`);
      } else {
        toast.error(
          res && "error" in res
            ? String(res.error)
            : "No se pudo reenviar el correo.",
        );
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="border-primary/40 bg-primary/5 rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          Código de acceso pendiente para el asesorado
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {emailSent && clientEmail ? (
            <>
              Correo enviado a <strong>{clientEmail}</strong>. También puedes
              enviarle su invitación directo por WhatsApp para que active su
              cuenta en 1 clic.
            </>
          ) : emailFailed && clientEmail ? (
            <>
              No se pudo enviar el correo. Comparte el código por WhatsApp o
              enlace directo con <strong>{clientEmail}</strong>.
            </>
          ) : (
            <>
              Este asesorado aún no ha activado su cuenta. Compártele este
              código a{" "}
              <strong>{clientName || clientEmail || "tu asesorado"}</strong> por
              WhatsApp o correo para que cree su contraseña e inicie sesión.
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-background px-4 py-2.5">
            <span className="font-mono text-xl font-black tracking-widest text-primary">
              {code}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyCode}
              aria-label="Copiar código"
              className="h-8 w-8 shrink-0"
            >
              {copied ? (
                <Check className="size-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleShareWhatsApp}
            className="h-10 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 font-semibold"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Enviar por WhatsApp
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="h-10 rounded-xl"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copiar enlace
          </Button>

          {codeId && clientEmail && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isResending}
              onClick={handleResendEmail}
              className="h-10 rounded-xl"
            >
              <Send className="mr-2 h-4 w-4 text-primary" />
              {isResending ? "Reenviando..." : "Reenviar correo"}
            </Button>
          )}

          <Button variant="outline" size="sm" className="h-10 rounded-xl" asChild>
            <a
              href={`/auth/sign-up?code=${code}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir registro
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cuando el asesorado abra el enlace, su código y correo se validarán
          automáticamente; solo tendrá que elegir su contraseña.
        </p>
      </CardContent>
    </Card>
  );
}
