"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { getPublicAppUrl } from "@/lib/utils";

export function CopyInviteButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${getPublicAppUrl()}/auth/sign-up?code=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(
        "Enlace copiado. Compártelo por WhatsApp o como prefieras.",
      );
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No pudimos copiar el enlace. Intenta de nuevo.");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      title="Copiar enlace para compartir"
    >
      {copied ? (
        <Check className="size-4 text-success" />
      ) : (
        <Copy className="size-4" />
      )}
    </Button>
  );
}
