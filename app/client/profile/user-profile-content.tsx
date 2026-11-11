"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Download,
  Lock,
  Receipt,
  ShieldAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calculateLevel } from "@/lib/types";
import { Textarea } from "@/components/ui/textarea";
import {
  getVapidPublicKey,
  savePushSubscription,
  removePushSubscription,
} from "@/app/actions/web-push";
import {
  reportClientPain,
  resolveClientPainReport,
} from "@/app/actions/routine-overrides";
import { urlBase64ToUint8Array } from "@/lib/utils/web-push";
import {
  detectPWAPlatform,
  isRunningStandalone,
  openPWAInstallPrompt,
} from "@/components/pwa-install-cta";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { ProfileAvatarSection } from "@/components/profile/profile-avatar-section";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";

function parseLocalDateYmd(ymd?: string | null): Date | undefined {
  if (!ymd) return undefined;
  const datePart = ymd.split("T")[0];
  const d = new Date(`${datePart}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function formatLocalDateYmd(date?: Date): string | undefined {
  if (!date || Number.isNaN(date.getTime())) return undefined;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const CLIENT_PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
};

export interface ClientMembershipSummary {
  status: string;
  membershipStart: string | null;
  membershipEnd: string | null;
  planName: string | null;
  planPrice: number | null;
  planDurationDays: number | null;
  planDescription: string | null;
}

export interface ClientPaymentHistoryItem {
  id: string;
  amount: number;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  payment_method: string | null;
  reference: string | null;
  plan_name: string | null;
}

interface Profile {
  id: string;
  username?: string;
  avatar_url?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  birth_date?: string;
  fitness_goal?: string;
  experience_level?: string;
  xp_points?: number;
  level?: number;
  streak_days?: number;
}

export function UserProfileContent({
  initialProfile,
  userId,
  userEmail,
  clientId,
  membershipInfo,
  paymentHistory = [],
}: {
  initialProfile: Profile;
  userId: string;
  userEmail: string;
  clientId?: string;
  membershipInfo?: ClientMembershipSummary | null;
  paymentHistory?: ClientPaymentHistoryItem[];
}) {
  const [profile, setProfile] = useState<Profile>(initialProfile || {});
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const levelFromXp = calculateLevel(profile.xp_points ?? 0).level;

  // --- Password change state ---
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // --- Push notifications & PWA state ---
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  const [painRegion, setPainRegion] = useState<string>("none");
  const [painSeverity, setPainSeverity] = useState<number>(0);
  const [painNotes, setPainNotes] = useState<string>("");
  const [painSaving, setPainSaving] = useState(false);
  const [activePainReports, setActivePainReports] = useState<
    {
      id: string;
      body_region: string;
      severity: number;
      notes: string | null;
      reported_at: string;
    }[]
  >([]);

  useEffect(() => {
    setStandalone(isRunningStandalone());
    setIsIOSDevice(detectPWAPlatform().isIOS);
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    ) {
      setPushSupported(true);
      if (Notification.permission === "granted") {
        navigator.serviceWorker
          .getRegistration()
          .then((reg) => reg?.pushManager.getSubscription())
          .then((sub) => {
            setPushSubscribed(Boolean(sub));
          })
          .catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("client_pain_reports")
        .select("id, body_region, severity, notes, reported_at")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("reported_at", { ascending: false });

      if (cancelled) return;
      if (error) return;
      setActivePainReports((data ?? []) as any);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const handleSaveProfile = async () => {
    if (!profile.full_name?.trim()) {
      toast.error("El nombre completo es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      // Normalizamos valores: si es string vacío, enviamos null para evitar violaciones de CHECK constraints
      const profilePayload = {
        username: profile.username?.trim() || null,
        full_name: profile.full_name.trim(),
        phone: profile.phone?.trim() || null,
        gender:
          profile.gender && profile.gender !== "none" ? profile.gender : null,
        birth_date: profile.birth_date || null,
        fitness_goal: profile.fitness_goal || null,
        experience_level: profile.experience_level || null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(profilePayload)
        .eq("id", userId);

      if (error) {
        console.error("Error updating profile:", error);
        toast.error("No pudimos guardar. Intenta de nuevo.");
        return;
      }

      if (clientId) {
        // También normalizamos para la tabla de clientes si existe
        await supabase
          .from("clients")
          .update({
            full_name: profile.full_name.trim(),
            phone: profile.phone?.trim() || "",
            gender:
              profile.gender && profile.gender !== "none"
                ? profile.gender
                : null,
            birth_date: profile.birth_date || null,
          })
          .eq("id", clientId);
      }

      toast.success("¡Perfil actualizado!");
    } catch (err) {
      console.error("Error in handleSaveProfile:", err);
      toast.error("No pudimos guardar el perfil. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePainReport = async () => {
    if (!clientId) return;
    if (painRegion === "none") {
      toast.error("Selecciona una zona");
      return;
    }

    setPainSaving(true);
    try {
      const res = await reportClientPain({
        clientId,
        bodyRegion: painRegion,
        severity: painSeverity,
        notes: painNotes,
      });

      if (!res.success || !res.report) {
        toast.error(res.error || "No pudimos guardar tu reporte. Intenta de nuevo.");
        return;
      }

      setActivePainReports((prev) => [res.report!, ...prev]);
      setPainRegion("none");
      setPainSeverity(0);
      setPainNotes("");
      toast.success("Reporte guardado y enviado a tu coach");
    } finally {
      setPainSaving(false);
    }
  };

  const handleResolvePainReport = async (id: string) => {
    if (!clientId) return;
    const res = await resolveClientPainReport(id);

    if (!res.success) {
      toast.error(res.error || "No pudimos actualizar el reporte.");
      return;
    }

    setActivePainReports((prev) => prev.filter((r) => r.id !== id));
    toast.success("Reporte marcado como resuelto");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        toast.error(error.message || "No se pudo actualizar la contraseña.");
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      toast.success("¡Contraseña actualizada correctamente!");
    } catch {
      toast.error("Error inesperado al actualizar la contraseña.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleTogglePush = async (checked: boolean) => {
    if (!pushSupported) {
      toast.error("Tu navegador no soporta notificaciones Push.");
      return;
    }

    setPushLoading(true);
    try {
      if (checked) {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          toast.error("Permiso de notificaciones denegado en el navegador.");
          setPushSubscribed(false);
          return;
        }

        const vapidKey =
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
          (await getVapidPublicKey());
        if (!vapidKey) {
          toast.error("Falta configurar la clave pública VAPID.");
          setPushSubscribed(false);
          return;
        }

        const swUrl =
          process.env.NODE_ENV === "development" ? "/push-sw.js" : "/sw.js";
        const reg =
          (await navigator.serviceWorker.getRegistration()) ||
          (await navigator.serviceWorker
            .register(swUrl, { scope: "/" })
            .catch(() =>
              navigator.serviceWorker.register("/push-sw.js", { scope: "/" }),
            ));
        const readyReg = reg.active ? reg : await navigator.serviceWorker.ready;

        const subscription = await readyReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        const res = await savePushSubscription(subscription.toJSON());
        if (!res.success) {
          toast.error(res.error || "No se pudo guardar la suscripción Push.");
          setPushSubscribed(false);
          return;
        }

        setPushSubscribed(true);
        toast.success("Notificaciones Push activadas en este dispositivo.");
      } else {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await removePushSubscription(endpoint);
        }
        setPushSubscribed(false);
        toast.success("Notificaciones Push desactivadas en este dispositivo.");
      }
    } catch (err) {
      console.error("Error configurando notificaciones push:", err);
      toast.error("No se pudieron configurar las notificaciones Push.");
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <aside className="flex flex-col gap-6 lg:col-span-4 lg:sticky lg:top-[calc(96px+1.5rem)] lg:self-start">
        <ProfileAvatarSection
          userId={userId}
          initialUrl={profile.avatar_url}
          onAvatarUrlChange={(avatar_url) =>
            setProfile((p) => ({ ...p, avatar_url }))
          }
          description="Recomendado: foto cuadrada y buena luz. JPG, PNG o WebP · máx. 2 MB."
        />

        {/* Stats */}
        {profile.xp_points !== undefined && (
          <Card className="rounded-3xl border-border/80 shadow-md ring-1 ring-primary/5">
            <CardHeader>
              <CardTitle>Estadísticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <div className="min-w-0 rounded-2xl border border-border/50 bg-muted/15 px-2 py-3 sm:py-3.5 text-center">
                  <p className="text-xs font-medium text-muted-foreground truncate">Nivel</p>
                  <p className="mt-1 text-xl sm:text-2xl font-black tabular-nums text-primary">
                    {levelFromXp}
                  </p>
                </div>
                <div className="min-w-0 rounded-2xl border border-border/50 bg-muted/15 px-2 py-3 sm:py-3.5 text-center">
                  <p className="text-xs font-medium text-muted-foreground truncate">Experiencia</p>
                  <p className="mt-1 text-xl sm:text-2xl font-black tabular-nums text-primary">
                    {profile.xp_points || 0}
                  </p>
                </div>
                <div className="min-w-0 rounded-2xl border border-border/50 bg-muted/15 px-2 py-3 sm:py-3.5 text-center">
                  <p className="text-xs font-medium text-muted-foreground truncate">Racha</p>
                  <p className="mt-1 text-xl sm:text-2xl font-black tabular-nums text-primary">
                    {profile.streak_days || 0}d
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      </aside>

      <section className="flex flex-col gap-6 lg:col-span-8">
        {/* Profile Information */}
        <Card className="rounded-3xl border-border/80 shadow-md ring-1 ring-primary/5">
          <CardHeader>
            <CardTitle>Información personal</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input value={userEmail} disabled className="bg-muted" />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Usuario</FieldLabel>
                  <Input
                    value={profile.username || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, username: e.target.value })
                    }
                    placeholder="Tu usuario"
                  />
                </Field>
                <Field>
                  <FieldLabel>Nombre completo</FieldLabel>
                  <Input
                    value={profile.full_name || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, full_name: e.target.value })
                    }
                    placeholder="Tu nombre"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Teléfono</FieldLabel>
                  <Input
                    value={profile.phone || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, phone: e.target.value })
                    }
                    placeholder="Tu número"
                  />
                </Field>

                <Field>
                  <FieldLabel>Fecha de nacimiento</FieldLabel>
                  <DatePicker
                    date={parseLocalDateYmd(profile.birth_date)}
                    setDate={(date) =>
                      setProfile({
                        ...profile,
                        birth_date: formatLocalDateYmd(date),
                      })
                    }
                    placeholder="Tu fecha"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel>Género</FieldLabel>
                <Select
                  value={profile.gender || ""}
                  onValueChange={(value) =>
                    setProfile({ ...profile, gender: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar género" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled className="hidden">
                      Seleccionar
                    </SelectItem>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="female">Femenino</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Fitness Profile */}
        <Card className="rounded-3xl border-border/80 shadow-md ring-1 ring-primary/5">
          <CardHeader>
            <CardTitle>Perfil de fitness</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Objetivo</FieldLabel>
                  <Select
                    value={profile.fitness_goal || ""}
                    onValueChange={(value) =>
                      setProfile({ ...profile, fitness_goal: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar objetivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lose_weight">Perder peso</SelectItem>
                      <SelectItem value="gain_muscle">Ganar músculo</SelectItem>
                      <SelectItem value="maintain">Mantener</SelectItem>
                      <SelectItem value="strength">Fuerza</SelectItem>
                      <SelectItem value="endurance">Resistencia</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>Experiencia</FieldLabel>
                  <Select
                    value={profile.experience_level || ""}
                    onValueChange={(value) =>
                      setProfile({ ...profile, experience_level: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar nivel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Principiante</SelectItem>
                      <SelectItem value="intermediate">Intermedio</SelectItem>
                      <SelectItem value="advanced">Avanzado</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Save Action for Profile info */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSaveProfile}
            size="lg"
            className="w-full gap-2 sm:w-auto"
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar cambios de perfil"}
          </Button>
        </div>

        {/* Security & Notifications */}
        <Card className="rounded-3xl border-border/80 shadow-md ring-1 ring-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4 text-primary" aria-hidden />
              Seguridad y Notificaciones
            </CardTitle>
            <CardDescription>
              Actualiza tu contraseña de acceso y administra los avisos en este dispositivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {!standalone && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <Download className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">
                      Instalar aplicación en este dispositivo
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Instala RU Coach en tu inicio (iOS, Android o computadora) para pantalla completa, acceso rápido y notificaciones nativas.
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openPWAInstallPrompt()}
                  className="shrink-0 font-semibold"
                >
                  Instalar App
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/15 p-4">
              <div className="flex items-start gap-3">
                <Bell className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">
                    Notificaciones Push en este dispositivo
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {!pushSupported && isIOSDevice && !standalone
                      ? "En iPhone/iPad, primero instala RU Coach en tu pantalla de inicio (botón «Instalar App» arriba) para activar las notificaciones."
                      : "Recibe alertas cuando tu coach te envíe mensajes, actualice tu rutina o registre tu membresía."}
                  </span>
                </div>
              </div>
              <Switch
                checked={pushSubscribed}
                onCheckedChange={handleTogglePush}
                disabled={!pushSupported || pushLoading}
                aria-label="Activar notificaciones Push"
              />
            </div>

            <FieldGroup>
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Nueva contraseña</FieldLabel>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                  />
                </Field>
                <Field>
                  <FieldLabel>Confirmar contraseña</FieldLabel>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    autoComplete="new-password"
                  />
                </Field>
              </div>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleChangePassword}
                  disabled={changingPassword || !newPassword}
                  className="w-full sm:w-auto"
                >
                  {changingPassword ? "Actualizando…" : "Actualizar contraseña"}
                </Button>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Mi Membresía e Historial de Pagos */}
        {membershipInfo && (
          <Card
            id="membership"
            className="rounded-3xl border-border/80 shadow-md ring-1 ring-primary/5 scroll-mt-24"
          >
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="size-4 text-primary" aria-hidden />
                    Mi Membresía y Pagos
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Estado actual de tu plan de asesoría y recibos registrados.
                  </CardDescription>
                </div>
                {(() => {
                  const endStr = membershipInfo.membershipEnd?.slice(0, 10);
                  const endDate = endStr ? new Date(`${endStr}T23:59:59`) : null;
                  const daysLeft =
                    endDate && !Number.isNaN(endDate.getTime())
                      ? Math.ceil(
                          (endDate.getTime() - Date.now()) /
                            (1000 * 60 * 60 * 24),
                        )
                      : null;

                  if (
                    membershipInfo.status === "expired" ||
                    (daysLeft !== null && daysLeft < 0)
                  ) {
                    return (
                      <Badge
                        variant="outline"
                        className="border-destructive/40 bg-destructive/15 text-destructive font-bold"
                      >
                        Membresía vencida
                      </Badge>
                    );
                  }
                  if (daysLeft !== null && daysLeft <= 5) {
                    return (
                      <Badge
                        variant="outline"
                        className="border-warning/40 bg-warning/15 text-warning-foreground font-bold"
                      >
                        <CalendarClock className="mr-1 size-3.5" />
                        Por vencer · {daysLeft}d
                      </Badge>
                    );
                  }
                  return (
                    <Badge
                      variant="outline"
                      className="border-success/35 bg-success/15 text-success font-bold"
                    >
                      <CheckCircle2 className="mr-1 size-3.5" />
                      Activa
                      {daysLeft !== null ? ` · ${daysLeft}d restantes` : ""}
                    </Badge>
                  );
                })()}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Plan contratado
                  </p>
                  <p className="mt-1 text-base font-black text-foreground">
                    {membershipInfo.planName || "Plan Personalizado"}
                  </p>
                  {membershipInfo.planPrice != null && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      $
                      {membershipInfo.planPrice.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      MXN
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Inicio de ciclo
                  </p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {membershipInfo.membershipStart
                      ? parseLocalDateYmd(
                          membershipInfo.membershipStart,
                        )?.toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Fecha de corte
                  </p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {membershipInfo.membershipEnd
                      ? parseLocalDateYmd(
                          membershipInfo.membershipEnd,
                        )?.toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Receipt className="size-3.5 text-primary" />
                    Historial de Pagos ({paymentHistory.length})
                  </h4>
                </div>

                {paymentHistory.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-4 text-center text-xs text-muted-foreground">
                    Aún no hay recibos de pago registrados en tu historial.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {paymentHistory.map((p) => {
                      const isPending = !p.paid_at;
                      const paidDate = p.paid_at
                        ? parseLocalDateYmd(p.paid_at)?.toLocaleDateString(
                            "es-MX",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )
                        : null;
                      const startStr = p.period_start
                        ? parseLocalDateYmd(p.period_start)?.toLocaleDateString(
                            "es-MX",
                            {
                              day: "numeric",
                              month: "short",
                            },
                          )
                        : null;
                      const endStr = p.period_end
                        ? parseLocalDateYmd(p.period_end)?.toLocaleDateString(
                            "es-MX",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )
                        : null;
                      const methodLabel = p.payment_method
                        ? (CLIENT_PAYMENT_METHOD_LABELS[p.payment_method] ??
                          p.payment_method)
                        : null;

                      return (
                        <div
                          key={p.id}
                          className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/15 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-foreground">
                                {p.plan_name || "Mensualidad de Asesoría"}
                              </span>
                              <Badge
                                variant="outline"
                                className={
                                  !isPending
                                    ? "border-success/30 bg-success/12 text-success text-[10px] font-bold"
                                    : "border-warning/35 bg-warning/12 text-warning-foreground text-[10px] font-bold"
                                }
                              >
                                {!isPending ? "Liquidado" : "Pendiente"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {paidDate
                                ? `Pagado el ${paidDate}`
                                : "Pago pendiente de confirmación"}
                              {methodLabel ? ` • ${methodLabel}` : ""}
                              {startStr && endStr
                                ? ` • Vigencia: ${startStr} – ${endStr}`
                                : ""}
                            </p>
                            {p.reference && (
                              <p className="text-[11px] text-muted-foreground/75 italic mt-0.5">
                                Ref: {p.reference}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="text-base font-black tabular-nums text-foreground">
                              $
                              {(p.amount ?? 0).toLocaleString("es-MX", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pain / Injury Intake */}
        {clientId ? (
          <Card className="rounded-3xl border-border/80 shadow-md ring-1 ring-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-primary" aria-hidden />
                Dolor / lesión
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground">
                Sirve para que tu coach y la app ajusten la progresión: si hay
                dolor activo, evitamos subidas agresivas de carga y priorizamos
                continuidad y seguridad.
              </div>

              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Zona</FieldLabel>
                    <Select value={painRegion} onValueChange={setPainRegion}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona una zona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecciona…</SelectItem>
                        <SelectItem value="hombro">Hombro</SelectItem>
                        <SelectItem value="codo">Codo</SelectItem>
                        <SelectItem value="muñeca">Muñeca</SelectItem>
                        <SelectItem value="espalda_baja">Espalda baja</SelectItem>
                        <SelectItem value="rodilla">Rodilla</SelectItem>
                        <SelectItem value="cadera">Cadera</SelectItem>
                        <SelectItem value="tobillo">Tobillo</SelectItem>
                        <SelectItem value="cuello">Cuello</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Severidad (0-10)</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={painSeverity}
                      onChange={(e) =>
                        setPainSeverity(
                          Math.max(0, Math.min(10, Number(e.target.value) || 0)),
                        )
                      }
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel>Notas</FieldLabel>
                  <Textarea
                    value={painNotes}
                    onChange={(e) => setPainNotes(e.target.value)}
                    placeholder="¿Qué sientes? ¿Cuándo aparece? ¿Qué lo empeora/mejora?"
                  />
                </Field>

                <Button
                  onClick={handleSavePainReport}
                  disabled={painSaving}
                  className="w-full"
                >
                  {painSaving ? "Guardando…" : "Guardar reporte"}
                </Button>
              </FieldGroup>

              {activePainReports.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium">Reportes activos</div>
                  <div className="flex flex-col gap-2">
                    {activePainReports.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-start justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium">
                            {r.body_region} · {r.severity}/10
                          </div>
                          {r.notes ? (
                            <div className="text-muted-foreground mt-1 text-pretty">
                              {r.notes}
                            </div>
                          ) : null}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolvePainReport(r.id)}
                        >
                          Resuelto
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Sin reportes activos. Si sientes dolor, regístralo aquí para
                  que tu coach lo tome en cuenta.
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
