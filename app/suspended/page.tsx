import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthData } from "@/lib/auth-utils";
import { formatMexicoWhatsAppNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SuspendedAccessWatcher } from "@/components/suspended-access-watcher";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LogOut,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const DEFAULT_COACH_PHONE = "9612378473";

function normalizeBrandName(rawName?: string | null): string {
  if (!rawName) return "RU Coach";
  const trimmed = rawName.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === "rodrigo coaching" ||
    trimmed.toLowerCase() === "mi gym" ||
    trimmed.toLowerCase() === "mi marca" ||
    trimmed.toLowerCase() === "mi espacio"
  ) {
    return "RU Coach";
  }
  return trimmed;
}

function formatWhatsAppPhone(rawPhone?: string | null): {
  waNumber: string;
  displayPhone: string;
} {
  const waNumber =
    formatMexicoWhatsAppNumber(rawPhone) ||
    formatMexicoWhatsAppNumber(DEFAULT_COACH_PHONE);
  const local10 =
    waNumber.length === 12 && waNumber.startsWith("52")
      ? waNumber.slice(2)
      : waNumber;
  const displayPhone =
    local10.length === 10
      ? `${local10.slice(0, 3)} ${local10.slice(3, 6)} ${local10.slice(6)}`
      : waNumber;
  return { waNumber, displayPhone };
}

export default async function SuspendedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const { user, role, profile } = await getAuthData();

  if (!user) {
    redirect("/auth/login");
  }

  if (role === "admin") {
    redirect("/admin/dashboard");
  }

  if (role === "receptionist") {
    redirect("/receptionist/dashboard");
  }

  const supabase = await createClient();

  // Verificar en tiempo real si el cliente ya tiene su pago/membresía activa
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, coach_id, status, membership_end")
    .eq("user_id", user.id)
    .maybeSingle();

  let effectiveStatus = status;

  if (clientRow) {
    const endDay = clientRow.membership_end?.slice(0, 10);
    const endDate = endDay ? new Date(`${endDay}T23:59:59`) : null;
    const isDateExpired =
      endDate && !Number.isNaN(endDate.getTime()) && endDate < new Date();

    if (isDateExpired) {
      effectiveStatus = "expired";
    } else if (clientRow.status === "active") {
      if (profile?.subscription_status !== "active") {
        await supabase
          .from("profiles")
          .update({ subscription_status: "active" })
          .eq("id", user.id);
      }
      redirect("/client/dashboard");
    } else if (
      clientRow.status === "pending_payment" ||
      clientRow.status === "expired" ||
      clientRow.status === "suspended"
    ) {
      effectiveStatus = clientRow.status;
    }
  } else if (profile?.subscription_status === "active") {
    redirect("/client/dashboard");
  }

  const admin = createAdminClient();
  let coachPhoneRaw: string | null = null;
  let gymNameRaw: string | null = null;

  if (clientRow?.coach_id) {
    const [{ data: coachGym }, { data: coachProfile }] = await Promise.all([
      admin
        .from("gym_settings")
        .select("phone, gym_name")
        .eq("admin_id", clientRow.coach_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("phone")
        .eq("id", clientRow.coach_id)
        .maybeSingle(),
    ]);
    coachPhoneRaw = coachProfile?.phone || coachGym?.phone || null;
    gymNameRaw = coachGym?.gym_name || null;
  }

  if (!coachPhoneRaw || !gymNameRaw) {
    const { data: fallbackGym } = await admin
      .from("gym_settings")
      .select("phone, gym_name")
      .limit(1)
      .maybeSingle();
    coachPhoneRaw = coachPhoneRaw || fallbackGym?.phone || null;
    gymNameRaw = gymNameRaw || fallbackGym?.gym_name || null;
  }

  const brandName = normalizeBrandName(gymNameRaw);
  const { waNumber, displayPhone } = formatWhatsAppPhone(coachPhoneRaw);
  const userEmail = profile?.email || user?.email || "";
  const userName = profile?.full_name || "";

  const isPaused = effectiveStatus === "pending_payment";
  const isExpired = effectiveStatus === "expired";

  let title = "Acceso Restringido";
  let badgeText = "Cuenta en revisión";
  let description = (
    <>
      Tu acceso a <span className="text-foreground font-bold">{brandName}</span> ha
      sido temporalmente pausado.
    </>
  );
  let icon = <AlertTriangle className="size-9 sm:size-10 text-destructive" />;

  let waText = `Hola Rodrigo, necesito apoyo con mi acceso a RU Coach${userName ? ` (soy ${userName})` : ""}. Mi correo es: ${userEmail}`;

  if (isPaused) {
    title = "Activación Pendiente";
    badgeText = "Paso final · Confirmar membresía";
    description = (
      <>
        ¡Tu perfil en <span className="text-foreground font-bold">{brandName}</span> ya
        está listo! Solo falta confirmar el pago de tu membresía con Rodrigo Urbina para
        habilitar tu panel de entrenamiento.
      </>
    );
    icon = <Clock className="size-9 sm:size-10 text-amber-500" />;
    waText = `Hola Rodrigo, acabo de completar mi registro en RU Coach${userName ? ` (soy ${userName})` : ""} y quiero coordinar el pago de mi membresía para activar mi cuenta. Mi correo es: ${userEmail}`;
  } else if (isExpired) {
    title = "Membresía Vencida";
    badgeText = "Renovación requerida";
    description = (
      <>
        Tu periodo de suscripción en{" "}
        <span className="text-foreground font-bold">{brandName}</span> ha finalizado.
        Todo tu progreso e historial están intactos para cuando renueves.
      </>
    );
    waText = `Hola Rodrigo, mi membresía en RU Coach ha vencido${userName ? ` (soy ${userName})` : ""} y me gustaría renovarla. Mi correo es: ${userEmail}`;
  }

  const waLink = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(waText)}`;

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Header consistente con RU Coach (evita que ThemeToggle flote sobre la tarjeta en móvil) */}
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

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        role="main"
        className="flex-1 flex items-center justify-center px-4 py-6 sm:p-6 safe-area-inset-bottom"
        tabIndex={-1}
      >
        <Card
          className={`w-full max-w-md text-center rounded-2xl bg-card/85 backdrop-blur-xl shadow-2xl ${
            isPaused
              ? "border-amber-500/25 shadow-amber-500/5"
              : "border-destructive/25 shadow-destructive/5"
          }`}
        >
          <CardHeader className="pb-3 pt-6 px-5 sm:px-6">
            <div
              className={`mx-auto size-18 sm:size-20 rounded-full flex items-center justify-center mb-4 ring-1 ${
                isPaused
                  ? "bg-amber-500/10 ring-amber-500/25"
                  : "bg-destructive/10 ring-destructive/25"
              }`}
            >
              {icon}
            </div>

            <div className="mx-auto mb-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border ${
                  isPaused
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                    : "bg-destructive/10 text-destructive border-destructive/25"
                }`}
              >
                {badgeText}
              </span>
            </div>

            <CardTitle className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
              {title}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base font-medium leading-relaxed mt-1.5">
              {description}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-5 pb-6 sm:px-6">
            <div className="p-4 bg-muted/40 rounded-xl text-left space-y-3 border border-border/60">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Estado de tu cuenta
              </p>
              <ul className="text-xs sm:text-sm text-foreground/90 space-y-2.5 font-medium">
                {isPaused ? (
                  <>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                      <span>Registro y perfil inicial completados</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-semibold">
                      <Clock className="size-4 text-amber-500 shrink-0" />
                      <span>Pago de membresía por confirmar</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-muted-foreground">
                      <Sparkles className="size-4 text-muted-foreground/60 shrink-0" />
                      <span>Activación inmediata de tu plan y rutinas</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                      <span>Historial y progreso resguardados</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-destructive font-semibold">
                      <AlertTriangle className="size-4 text-destructive shrink-0" />
                      <span>
                        {isExpired
                          ? "Periodo de membresía finalizado"
                          : "Acceso temporalmente pausado"}
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5 text-muted-foreground">
                      <Sparkles className="size-4 text-muted-foreground/60 shrink-0" />
                      <span>Contacta a tu coach para reactivar tu acceso</span>
                    </li>
                  </>
                )}
              </ul>
            </div>

            <div className="space-y-2.5">
              <Button
                className="w-full gap-2.5 h-12 rounded-xl text-sm sm:text-base font-bold bg-[#25D366] hover:bg-[#20ba56] text-white border-0 shadow-lg shadow-[#25D366]/20"
                asChild
              >
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-5 fill-current shrink-0" />
                  <span>Contactar por WhatsApp ({displayPhone})</span>
                </a>
              </Button>

              <SuspendedAccessWatcher userId={user.id} />

              <Button
                variant="outline"
                className="w-full gap-2 h-11 text-xs sm:text-sm font-semibold rounded-xl border-border/60 hover:bg-muted transition-all"
                asChild
              >
                <Link href="/auth/logout" prefetch={false}>
                  <LogOut className="size-4" />
                  Cerrar Sesión
                </Link>
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold pt-1">
              RU Coach · Rodrigo Urbina — Coaching de Élite
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
