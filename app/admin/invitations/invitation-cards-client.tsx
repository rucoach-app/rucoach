"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Copy,
  Power,
  Trash2,
  MoreVertical,
  Mail,
  Calendar,
  Key,
  UserPlus,
  MessageCircle,
  Link2,
  RotateCcw,
  Send,
  User,
  ShieldCheck,
  Search,
  X,
} from "lucide-react";
import {
  deactivateInvitationCode,
  deleteInvitationCode,
  reactivateInvitationCode,
  resendInvitationCodeEmail,
} from "@/app/actions/invitations";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMexicoWhatsAppNumber, getPublicAppUrl } from "@/lib/utils";

export type InvitationCodeItem = {
  id: string;
  code: string;
  email: string | null;
  for_role: string;
  expires_at: string | null;
  times_used: number;
  max_uses: number;
  is_active: boolean;
  used_at?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  linked_client_id?: string | null;
  linked_name?: string | null;
  linked_phone?: string | null;
};

interface InvitationCardsClientProps {
  codes: InvitationCodeItem[];
  onCodesChange?: (codes: InvitationCodeItem[]) => void;
}

export function InvitationCardsClient({
  codes: initialCodes,
  onCodesChange,
}: InvitationCardsClientProps) {
  const router = useRouter();
  const [codes, setCodes] = useState(initialCodes);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Filtros de búsqueda y rol
  const [roleFilter, setRoleFilter] = useState<"all" | "client" | "admin">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setCodes(initialCodes);
  }, [initialCodes]);

  const updateCodes = (newCodes: InvitationCodeItem[]) => {
    setCodes(newCodes);
    onCodesChange?.(newCodes);
  };

  const getSignUpUrl = (code: string) =>
    `${getPublicAppUrl()}/auth/sign-up?code=${code}`;

  const handleCopyLink = (code: string) => {
    const url = getSignUpUrl(code);
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast.success("Enlace de registro copiado al portapapeles.");
      })
      .catch(() => {
        toast.error("No pudimos copiar el enlace.");
      });
  };

  const handleCopyCodeOnly = (code: string) => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        toast.success(`Código ${code} copiado.`);
      })
      .catch(() => {
        toast.error("No pudimos copiar el código.");
      });
  };

  const handleShareWhatsApp = (item: InvitationCodeItem) => {
    const url = getSignUpUrl(item.code);
    const greeting = item.linked_name ? `¡Hola ${item.linked_name}! ` : "¡Hola! ";
    const roleLabel =
      item.for_role === "admin" ? "como Coach en RU Coach" : "a RU Coach";
    const text = `${greeting}Te comparto tu código de invitación para unirte ${roleLabel}:\n\n🔑 Código: *${item.code}*\n👉 Regístrate directo aquí: ${url}`;
    const phoneParam = formatMexicoWhatsAppNumber(item.linked_phone);
    const waUrl = phoneParam
      ? `https://api.whatsapp.com/send?phone=${phoneParam}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleDeactivate = async (codeId: string) => {
    const result = await deactivateInvitationCode(codeId);
    if (result && "success" in result && result.success) {
      const updated = codes.map((c) =>
        c.id === codeId ? { ...c, is_active: false } : c,
      );
      updateCodes(updated);
      router.refresh();
      toast.success("Código desactivado");
    } else {
      toast.error(
        result && "error" in result ? String(result.error) : "Error al desactivar",
      );
    }
  };

  const handleReactivate = async (codeId: string) => {
    const result = await reactivateInvitationCode(codeId);
    if (result && "success" in result && result.success) {
      const updated = codes.map((c) =>
        c.id === codeId
          ? {
              ...c,
              is_active: true,
              expires_at: result.expires_at ?? c.expires_at,
            }
          : c,
      );
      updateCodes(updated);
      router.refresh();
      toast.success("Código reactivado correctamente");
    } else {
      toast.error(
        result && "error" in result ? String(result.error) : "Error al reactivar",
      );
    }
  };

  const handleResendEmail = async (codeId: string) => {
    setResendingId(codeId);
    try {
      const result = await resendInvitationCodeEmail(codeId);
      if (result && "success" in result && result.success) {
        toast.success("Invitación reenviada por correo electrónico.");
      } else {
        toast.error(
          result && "error" in result
            ? String(result.error)
            : "No se pudo reenviar el correo",
        );
      }
    } finally {
      setResendingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);

    const result = await deleteInvitationCode(deleteId);
    if (result && "success" in result && result.success) {
      const updated = codes.filter((c) => c.id !== deleteId);
      updateCodes(updated);
      router.refresh();
      toast.success("Código eliminado permanentemente");
      setDeleteId(null);
    } else {
      toast.error(
        result && "error" in result ? String(result.error) : "Error al eliminar",
      );
    }
    setIsDeleting(false);
  };

  // Conteos globales para badges
  const clientCount = useMemo(
    () => codes.filter((c) => c.for_role !== "admin").length,
    [codes],
  );
  const adminCount = useMemo(
    () => codes.filter((c) => c.for_role === "admin").length,
    [codes],
  );

  // Filtrado por rol y búsqueda
  const filteredCodes = useMemo(() => {
    return codes.filter((c) => {
      if (roleFilter === "client" && c.for_role === "admin") return false;
      if (roleFilter === "admin" && c.for_role !== "admin") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = c.code.toLowerCase().includes(q);
        const emailMatch = c.email?.toLowerCase().includes(q);
        const nameMatch = c.linked_name?.toLowerCase().includes(q);
        if (!codeMatch && !emailMatch && !nameMatch) return false;
      }
      return true;
    });
  }, [codes, roleFilter, searchQuery]);

  const activeCodes = useMemo(() => {
    return filteredCodes.filter((c) => {
      const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
      const isUsed = c.times_used >= c.max_uses;
      return c.is_active && !isExpired && !isUsed;
    });
  }, [filteredCodes]);

  const inactiveCodes = useMemo(() => {
    return filteredCodes.filter((c) => {
      const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
      const isUsed = c.times_used >= c.max_uses;
      return !c.is_active || isExpired || isUsed;
    });
  }, [filteredCodes]);

  const renderCodeList = (list: InvitationCodeItem[]) => {
    if (list.length === 0) return null;

    return (
      <div className="flex flex-col gap-3">
        {list.map((code) => {
          const isExpired = Boolean(
            code.expires_at && new Date(code.expires_at) < new Date(),
          );
          const isUsed = code.times_used >= code.max_uses;
          const isInactive = !code.is_active;
          const canDeactivate = !isInactive && !isExpired && !isUsed;
          const canReactivate = (isInactive || isExpired) && !isUsed;

          return (
            <div
              key={code.id}
              className={`group flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl border transition-all hover:bg-muted/30 ${
                isInactive || isExpired || isUsed
                  ? "opacity-80 bg-muted/10 border-border/40"
                  : "bg-card shadow-sm border-border/60 hover:shadow-md hover:border-primary/30"
              }`}
            >
              {/* Left Details */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1 overflow-hidden">
                <div className="flex flex-col gap-1 min-w-[170px]">
                  <div className="flex items-center gap-2">
                    <Key className="size-4 text-primary shrink-0" />
                    <button
                      type="button"
                      onClick={() => handleCopyCodeOnly(code.code)}
                      title="Clic para copiar solo el código"
                      className="text-xl font-mono font-black text-primary tracking-widest uppercase hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      {code.code}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {isUsed ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold uppercase"
                      >
                        Reclamado
                      </Badge>
                    ) : isExpired ? (
                      <Badge
                        variant="outline"
                        className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-bold uppercase"
                      >
                        Expirado
                      </Badge>
                    ) : isInactive ? (
                      <Badge
                        variant="outline"
                        className="bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20 text-[10px] font-bold uppercase"
                      >
                        Inactivo
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold uppercase"
                      >
                        Activo
                      </Badge>
                    )}

                    {code.for_role === "admin" ? (
                      <Badge
                        variant="outline"
                        className="text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/10 text-[10px] font-bold uppercase flex items-center gap-1"
                      >
                        <ShieldCheck className="size-3" /> Coach
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-bold uppercase bg-secondary/70 flex items-center gap-1"
                      >
                        <User className="size-3" /> Cliente
                      </Badge>
                    )}

                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold tabular-nums text-muted-foreground border-border/60"
                    >
                      {code.times_used}/{code.max_uses}{" "}
                      {code.max_uses === 1 ? "uso" : "usos"}
                    </Badge>
                  </div>
                </div>

                {/* Metadata Column */}
                <div className="flex flex-col gap-1.5 sm:ml-4 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground font-medium">
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <Mail className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">
                        {code.email ||
                          (code.max_uses > 1
                            ? `Código grupal (${code.max_uses} lugares)`
                            : "Abierto (cualquier correo)")}
                      </span>
                    </span>
                    {code.linked_name && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        <User className="size-3.5 shrink-0" />
                        {code.linked_client_id ? (
                          <Link
                            href={`/admin/clients/${code.linked_client_id}`}
                            className="hover:underline underline-offset-2"
                          >
                            {code.linked_name}
                          </Link>
                        ) : (
                          <span>{code.linked_name}</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="size-3.5 opacity-70 shrink-0" />
                      {code.expires_at
                        ? `Expira: ${format(new Date(code.expires_at), "d MMM yyyy", { locale: es })}`
                        : "Sin fecha de expiración"}
                    </span>
                    {isUsed && (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        · Canjeado {code.linked_name ? `por ${code.linked_name}` : "en registro"}
                      </span>
                    )}
                    {code.created_at && (
                      <span className="opacity-70">
                        · Creado {format(new Date(code.created_at), "d MMM yyyy", { locale: es })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Right */}
              <div className="flex flex-wrap items-center gap-2 lg:ml-auto border-t lg:border-0 pt-3 lg:pt-0 border-border/50 justify-between lg:justify-end">
                <div className="flex flex-wrap items-center gap-1.5">
                  {canDeactivate && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleShareWhatsApp(code)}
                        className="h-9 px-3 text-xs font-bold rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30"
                      >
                        <MessageCircle className="size-3.5 mr-1.5" />
                        WhatsApp
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopyCodeOnly(code.code)}
                        className="h-9 px-2.5 text-xs font-semibold rounded-xl bg-muted/60 text-foreground hover:bg-muted"
                      >
                        <Copy className="size-3.5 mr-1.5" />
                        Código
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopyLink(code.code)}
                        className="h-9 px-2.5 text-xs font-semibold rounded-xl bg-primary/10 text-primary hover:bg-primary/20"
                      >
                        <Link2 className="size-3.5 mr-1.5" />
                        Enlace
                      </Button>
                    </>
                  )}
                  {isUsed && (
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 px-3 bg-muted/70 rounded-full py-1">
                      <UserPlus className="size-3 text-emerald-600" /> Reclamado
                    </span>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Más opciones"
                      className="size-9 rounded-full sm:rounded-lg"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[195px] rounded-xl">
                    <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                      Acciones
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {canDeactivate && code.email && (
                      <DropdownMenuItem
                        disabled={resendingId === code.id}
                        onClick={() => handleResendEmail(code.id)}
                        className="gap-2 cursor-pointer font-medium"
                      >
                        <Send className="size-4 text-primary" />
                        {resendingId === code.id
                          ? "Reenviando..."
                          : "Reenviar correo"}
                      </DropdownMenuItem>
                    )}
                    {canDeactivate && (
                      <DropdownMenuItem
                        onClick={() => handleDeactivate(code.id)}
                        className="gap-2 cursor-pointer font-medium"
                      >
                        <Power className="size-4 text-muted-foreground" />
                        Desactivar
                      </DropdownMenuItem>
                    )}
                    {canReactivate && (
                      <DropdownMenuItem
                        onClick={() => handleReactivate(code.id)}
                        className="gap-2 cursor-pointer font-medium text-primary"
                      >
                        <RotateCcw className="size-4" />
                        Reactivar (+30 días)
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => setDeleteId(code.id)}
                      className="text-destructive gap-2 focus:text-destructive focus:bg-destructive/10 cursor-pointer font-medium"
                    >
                      <Trash2 className="size-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/50 shadow-sm">
          {/* Tabs de Rol */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Button
              type="button"
              size="sm"
              variant={roleFilter === "all" ? "default" : "ghost"}
              onClick={() => setRoleFilter("all")}
              className="rounded-xl h-8 text-xs font-bold"
            >
              Todos ({codes.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={roleFilter === "client" ? "default" : "ghost"}
              onClick={() => setRoleFilter("client")}
              className="rounded-xl h-8 text-xs font-bold gap-1.5"
            >
              <User className="size-3.5" />
              Clientes ({clientCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={roleFilter === "admin" ? "default" : "ghost"}
              onClick={() => setRoleFilter("admin")}
              className="rounded-xl h-8 text-xs font-bold gap-1.5"
            >
              <ShieldCheck className="size-3.5" />
              Coaches ({adminCount})
            </Button>
          </div>

          {/* Buscador */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar código o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8 h-8 rounded-xl text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Sección Activos */}
        <section>
          {activeCodes.length === 0 && inactiveCodes.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-border/50 flex flex-col items-center gap-4 bg-muted/10">
              <Key className="size-10 text-muted-foreground/30" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">
                  {searchQuery || roleFilter !== "all"
                    ? "Sin resultados para el filtro seleccionado"
                    : "No has generado ningún código de invitación todavía"}
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {searchQuery || roleFilter !== "all"
                    ? "Prueba cambiando el rol o limpiando el texto de búsqueda."
                    : "Usa el formulario superior para generar códigos para tus atletas o coaches."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activeCodes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <span className="relative flex size-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full size-2 bg-primary"></span>
                    </span>
                    Códigos Activos ({activeCodes.length})
                  </h3>
                  {renderCodeList(activeCodes)}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Sección Historial */}
        {inactiveCodes.length > 0 && (
          <section className="space-y-4 pt-6 border-t border-border/40">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Historial de Códigos ({inactiveCodes.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Códigos completados, vencidos o dados de baja. Puedes eliminarlos definitivamente sin afectar a los usuarios ya registrados.
              </p>
            </div>
            {renderCodeList(inactiveCodes)}
          </section>
        )}
      </div>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar código permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará el código de tu lista de administración por completo. No te preocupes, si este código ya fue usado por un cliente, su cuenta no se verá afectada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">
              Conservar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive rounded-xl text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              {isDeleting ? "Eliminando..." : "Eliminar Código"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
