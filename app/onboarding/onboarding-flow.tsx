"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  User,
  Activity,
  Target,
  Dumbbell,
  Bell,
  ChevronRight,
  ChevronLeft,
  Check,
  ShieldAlert,
  CalendarDays,
  Sparkles,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  completeOnboarding,
  type OnboardingInitialData,
} from "@/app/actions/onboarding";
import { getVapidPublicKey, savePushSubscription } from "@/app/actions/web-push";
import { openPWAInstallPrompt } from "@/components/pwa-install-cta";
import { urlBase64ToUint8Array } from "@/lib/utils/web-push";
import type { FitnessGoal, ExperienceLevel } from "@/lib/types";

interface OnboardingFlowProps {
  userId: string;
  userEmail: string;
  initialData?: OnboardingInitialData;
}

const STEPS = [
  { id: 1, title: "Perfil", description: "Tus datos básicos", icon: User },
  { id: 2, title: "Físico", description: "Tu punto de partida", icon: Activity },
  { id: 3, title: "Objetivo", description: "Lo que quieres lograr", icon: Target },
  { id: 4, title: "Entreno", description: "Nivel y salud articular", icon: Dumbbell },
  { id: 5, title: "Listo", description: "Resumen y avisos", icon: Bell },
];

const FITNESS_GOALS: { value: FitnessGoal; label: string; description: string }[] = [
  { value: "lose_weight", label: "Perder Peso", description: "Quemar grasa y mejorar definición corporal" },
  { value: "gain_muscle", label: "Ganar Músculo", description: "Hipertrofia y aumento de masa muscular" },
  { value: "strength", label: "Fuerza y Tonificación", description: "Aumentar cargas máximas y firmeza muscular" },
  { value: "endurance", label: "Resistencia", description: "Mejorar capacidad cardiovascular y rendimiento" },
  { value: "maintain", label: "Mantenerme", description: "Conservar composición corporal y salud activa" },
];

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string; description: string }[] = [
  { value: "beginner", label: "Principiante", description: "Menos de 6 meses entrenando con pesas" },
  { value: "intermediate", label: "Intermedio", description: "De 6 meses a 2 años de entrenamiento constante" },
  { value: "advanced", label: "Avanzado", description: "Más de 2 años dominando técnica y sobrecarga" },
];

const TRAINING_DAYS_OPTIONS = [2, 3, 4, 5, 6] as const;

const INJURY_REGIONS = [
  { value: "hombro", label: "Hombro" },
  { value: "rodilla", label: "Rodilla" },
  { value: "espalda_baja", label: "Espalda baja / Lumbar" },
  { value: "codo", label: "Codo" },
  { value: "muñeca", label: "Muñeca" },
  { value: "cadera", label: "Cadera" },
  { value: "tobillo", label: "Tobillo" },
  { value: "cuello", label: "Cuello / Cervical" },
  { value: "otro", label: "Otra zona" },
] as const;

function suggestUsernameFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 20);
}

export function OnboardingFlow({
  userId,
  userEmail,
  initialData,
}: OnboardingFlowProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Perfil
  const [fullName, setFullName] = useState(initialData?.fullName || "");
  const [username, setUsername] = useState(
    initialData?.username ||
      (initialData?.fullName ? suggestUsernameFromName(initialData.fullName) : ""),
  );
  const [usernameTouched, setUsernameTouched] = useState(
    Boolean(initialData?.username),
  );
  const [phone, setPhone] = useState(initialData?.phone || "");

  // Step 2: Físico y Biometría
  const [birthDate, setBirthDate] = useState(initialData?.birthDate || "");
  const [gender, setGender] = useState(initialData?.gender || "");
  const [height, setHeight] = useState(initialData?.height || "");
  const [initialWeight, setInitialWeight] = useState(
    initialData?.initialWeight || "",
  );
  const [waistCm, setWaistCm] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");

  // Step 3: Objetivo
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal | null>(
    initialData?.fitnessGoal ?? null,
  );

  // Step 4: Experiencia, Disponibilidad y Salud Articular
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(
    initialData?.experienceLevel ?? null,
  );
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState<number>(4);
  const [hasInjury, setHasInjury] = useState<boolean>(false);
  const [injuryRegion, setInjuryRegion] = useState<string>("hombro");
  const [injurySeverity, setInjurySeverity] = useState<number>(4);
  const [injuryNotes, setInjuryNotes] = useState<string>("");

  // Step 5: Notificaciones
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [isIOSBrowser, setIsIOSBrowser] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent;
      const ios =
        /iPad|iPhone|iPod/.test(ua) ||
        (window.navigator.platform === "MacIntel" &&
          window.navigator.maxTouchPoints > 1);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true;
      setIsIOSBrowser(ios && !standalone);
      setPushSupported(
        "Notification" in window &&
          "serviceWorker" in navigator &&
          "PushManager" in window,
      );
    }

    try {
      const saved = localStorage.getItem(`onboarding_state_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentStep) setCurrentStep(parsed.currentStep);
        if (parsed.fullName) setFullName(parsed.fullName);
        if (parsed.username) {
          setUsername(parsed.username);
          setUsernameTouched(true);
        }
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.birthDate) setBirthDate(parsed.birthDate);
        if (parsed.gender) setGender(parsed.gender);
        if (parsed.height) setHeight(parsed.height);
        if (parsed.initialWeight) setInitialWeight(parsed.initialWeight);
        if (parsed.waistCm) setWaistCm(parsed.waistCm);
        if (parsed.bodyFatPct) setBodyFatPct(parsed.bodyFatPct);
        if (parsed.fitnessGoal) setFitnessGoal(parsed.fitnessGoal);
        if (parsed.experienceLevel) setExperienceLevel(parsed.experienceLevel);
        if (parsed.trainingDaysPerWeek)
          setTrainingDaysPerWeek(parsed.trainingDaysPerWeek);
        if (typeof parsed.hasInjury === "boolean") setHasInjury(parsed.hasInjury);
        if (parsed.injuryRegion) setInjuryRegion(parsed.injuryRegion);
        if (parsed.injurySeverity) setInjurySeverity(parsed.injurySeverity);
        if (parsed.injuryNotes) setInjuryNotes(parsed.injuryNotes);
        if (parsed.notificationsEnabled !== undefined)
          setNotificationsEnabled(parsed.notificationsEnabled);
      }
    } catch (e) {
      console.error("Failed to load state", e);
    }
    setIsLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(
        `onboarding_state_${userId}`,
        JSON.stringify({
          currentStep,
          fullName,
          username,
          phone,
          birthDate,
          gender,
          height,
          initialWeight,
          waistCm,
          bodyFatPct,
          fitnessGoal,
          experienceLevel,
          trainingDaysPerWeek,
          hasInjury,
          injuryRegion,
          injurySeverity,
          injuryNotes,
          notificationsEnabled,
        }),
      );
    }
  }, [
    isLoaded,
    currentStep,
    fullName,
    username,
    phone,
    birthDate,
    gender,
    height,
    initialWeight,
    waistCm,
    bodyFatPct,
    fitnessGoal,
    experienceLevel,
    trainingDaysPerWeek,
    hasInjury,
    injuryRegion,
    injurySeverity,
    injuryNotes,
    notificationsEnabled,
    userId,
  ]);

  if (!isLoaded) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full size-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Validaciones biométricas en tiempo real
  const parsedHeight = parseFloat(height);
  const parsedWeight = parseFloat(initialWeight);
  const parsedWaist = waistCm.trim() ? parseFloat(waistCm) : undefined;
  const parsedFat = bodyFatPct.trim() ? parseFloat(bodyFatPct) : undefined;

  const isHeightValid =
    !isNaN(parsedHeight) && parsedHeight >= 100 && parsedHeight <= 250;
  const isWeightValid =
    !isNaN(parsedWeight) && parsedWeight >= 30 && parsedWeight <= 300;
  const isBirthDateValid = (() => {
    if (!birthDate) return false;
    const year = parseInt(birthDate.slice(0, 4), 10);
    const currentYear = new Date().getFullYear();
    return year >= currentYear - 100 && year <= currentYear - 10;
  })();

  const bmiValue =
    isHeightValid && isWeightValid
      ? (parsedWeight / Math.pow(parsedHeight / 100, 2)).toFixed(1)
      : null;

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return (
          fullName.trim().length >= 2 &&
          username.trim().length >= 3 &&
          username.trim().length <= 24
        );
      case 2:
        return isBirthDateValid && !!gender && isHeightValid && isWeightValid;
      case 3:
        return fitnessGoal !== null;
      case 4:
        return experienceLevel !== null && trainingDaysPerWeek >= 2;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleEnableNotifications = async () => {
    if (isIOSBrowser) {
      openPWAInstallPrompt();
      return;
    }

    if (!pushSupported) {
      toast.info(
        "Puedes activar las notificaciones más adelante desde tu Perfil.",
      );
      setNotificationsEnabled(false);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const vapidKey =
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
          (await getVapidPublicKey());
        if (!vapidKey) {
          toast.info(
            "Puedes activar las notificaciones más adelante desde tu Perfil.",
          );
          setNotificationsEnabled(false);
          return;
        }

        const existingReg = await navigator.serviceWorker.getRegistration();
        if (!existingReg) {
          const swUrl =
            process.env.NODE_ENV === "development" ? "/push-sw.js" : "/sw.js";
          await navigator.serviceWorker
            .register(swUrl, { scope: "/" })
            .catch(() =>
              navigator.serviceWorker.register("/push-sw.js", { scope: "/" }),
            );
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        const subJson = subscription.toJSON();
        localStorage.setItem(
          `push_subscription_${userId}`,
          JSON.stringify(subJson),
        );
        await savePushSubscription(subJson);
        setNotificationsEnabled(true);
        toast.success("¡Notificaciones en tiempo real activadas!");
      } else {
        setNotificationsEnabled(false);
        toast.error(
          "Permiso no concedido. Puedes activarlo después desde tu Perfil.",
        );
      }
    } catch (err) {
      console.error("Error pidiendo permiso de notificaciones:", err);
      setNotificationsEnabled(false);
      toast.info(
        "Podrás activar las notificaciones en cualquier momento desde tu Perfil.",
      );
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const result = await completeOnboarding({
        userId,
        fullName: fullName.trim(),
        username: username.trim(),
        phone: phone.trim(),
        birthDate,
        gender,
        height: isHeightValid ? parsedHeight : undefined,
        initialWeight: isWeightValid ? parsedWeight : undefined,
        waistCm:
          parsedWaist !== undefined && !isNaN(parsedWaist) && parsedWaist > 30
            ? parsedWaist
            : undefined,
        bodyFatPct:
          parsedFat !== undefined &&
          !isNaN(parsedFat) &&
          parsedFat >= 3 &&
          parsedFat <= 65
            ? parsedFat
            : undefined,
        fitnessGoal: fitnessGoal!,
        experienceLevel: experienceLevel!,
        trainingDaysPerWeek,
        injuryRegion: hasInjury ? injuryRegion : null,
        injurySeverity: hasInjury ? injurySeverity : undefined,
        injuryNotes: hasInjury ? injuryNotes.trim() : undefined,
        notificationsEnabled,
      });

      if (result.success) {
        if (notificationsEnabled) {
          try {
            const savedSub = localStorage.getItem(`push_subscription_${userId}`);
            if (savedSub) {
              const sub = JSON.parse(savedSub);
              await savePushSubscription(sub);
              localStorage.removeItem(`push_subscription_${userId}`);
            }
          } catch (e) {
            console.error("No se pudo guardar la suscripción push", e);
          }
        }

        localStorage.removeItem(`onboarding_state_${userId}`);
        toast.success("¡Bienvenido a RU Coach! Tu expediente está listo.");
        window.location.href = "/client/dashboard";
      } else {
        toast.error(
          result.error || "No pudimos guardar tus datos. Intenta de nuevo.",
        );
        if (result.field === "username" || result.field === "fullName") {
          setCurrentStep(1);
        } else if (
          result.field === "height" ||
          result.field === "initialWeight"
        ) {
          setCurrentStep(2);
        }
      }
    } catch (err) {
      console.error("[Onboarding] Error:", err);
      toast.error("Algo salió mal. Intenta de nuevo o recarga la página.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedGoalLabel =
    FITNESS_GOALS.find((g) => g.value === fitnessGoal)?.label ?? "—";
  const selectedExpLabel =
    EXPERIENCE_LEVELS.find((l) => l.value === experienceLevel)?.label ?? "—";

  return (
    <div className="min-h-dvh bg-background flex flex-col font-sans selection:bg-primary/20 overflow-x-hidden">
      {/* Unified Header */}
      <header className="safe-area-header-pt safe-area-x border-b border-border/50 bg-background/85 backdrop-blur-md sticky top-0 z-50">
        <div className="container max-w-4xl mx-auto h-14 sm:h-16 flex items-center justify-between px-3.5 sm:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="size-8 sm:size-9 rounded-lg overflow-hidden bg-black flex items-center justify-center shrink-0 border border-border/40">
              <Image
                src="/android-chrome-512x512.png"
                alt="Logo RU Coach"
                width={36}
                height={36}
                className="size-full object-contain"
              />
            </div>
            <div className="flex flex-col leading-none">
              <h1 className="font-black tracking-tighter uppercase text-base sm:text-lg">
                RU Coach
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mt-0.5">
                Rodrigo Urbina
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              Paso {currentStep}/{STEPS.length}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Modern Top Stepper Progress */}
      <div className="bg-background/95 backdrop-blur-sm border-b border-border/50 py-2.5 sm:py-3.5 sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:top-[calc(4rem+env(safe-area-inset-top,0px))] z-40 safe-area-x">
        <div className="container max-w-4xl mx-auto px-2.5 sm:px-4">
          <div className="flex items-start justify-between max-w-xl mx-auto w-full">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isComplete = currentStep > step.id;
              const isCurrent = currentStep === step.id;

              return (
                <div
                  key={step.id}
                  className="relative flex flex-1 flex-col items-center min-w-0"
                >
                  {index < STEPS.length - 1 && (
                    <div
                      className={`absolute left-1/2 top-3.5 sm:top-4 w-full h-0.5 -translate-y-1/2 transition-colors duration-300 ${
                        isComplete ? "bg-primary" : "bg-muted"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <button
                    type="button"
                    disabled={!isComplete}
                    onClick={() => {
                      if (isComplete) {
                        setCurrentStep(step.id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    aria-label={`Paso ${step.id}: ${step.title}`}
                    className={`relative z-10 flex size-7 sm:size-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                      isComplete
                        ? "border-primary bg-primary text-primary-foreground cursor-pointer hover:scale-105"
                        : isCurrent
                          ? "border-primary bg-background text-primary shadow-[0_0_0_3px] sm:shadow-[0_0_0_4px] shadow-primary/15 scale-105"
                          : "border-border bg-muted text-muted-foreground cursor-default"
                    }`}
                  >
                    {isComplete ? (
                      <Check className="size-3.5 sm:size-4" strokeWidth={3} />
                    ) : (
                      <Icon className="size-3.5 sm:size-4" />
                    )}
                  </button>
                  <span
                    className={`mt-1 sm:mt-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-tight sm:tracking-wider text-center truncate max-w-full px-0.5 transition-colors duration-300 ${
                      isCurrent
                        ? "text-foreground"
                        : isComplete
                          ? "text-primary"
                          : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main
        id="main-content"
        className="flex-1 container max-w-4xl mx-auto px-3.5 sm:px-6 py-4 sm:py-8 pb-28 sm:pb-32"
      >
        <div className="max-w-xl mx-auto">
          {/* Step 1: Perfil (Datos Básicos) */}
          {currentStep === 1 && (
            <div
              className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 sm:space-y-6"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canProceed()) {
                  e.preventDefault();
                  handleNext();
                }
              }}
            >
              <div className="space-y-1">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  Paso 1 de 5 · Identidad
                </span>
                <h2 className="text-xl sm:text-3xl font-bold tracking-tight">
                  Tu expediente de atleta
                </h2>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                  Confirma tus datos básicos para personalizar tu plataforma con{" "}
                  <span className="font-medium text-foreground break-all">
                    {userEmail}
                  </span>
                  .
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label
                    htmlFor="fullName"
                    className="text-[11px] sm:text-xs uppercase font-semibold text-muted-foreground"
                  >
                    Nombre completo *
                  </Label>
                  <Input
                    id="fullName"
                    placeholder="Ej. Juan Pérez"
                    value={fullName}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setFullName(nextName);
                      if (!usernameTouched) {
                        setUsername(suggestUsernameFromName(nextName));
                      }
                    }}
                    className="h-12 md:h-12 text-base px-3.5 sm:px-4 rounded-xl bg-background border-border focus-visible:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="username"
                      className="text-[11px] sm:text-xs uppercase font-semibold text-muted-foreground"
                    >
                      Nombre de usuario *
                    </Label>
                    {username.length >= 3 && (
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                        <Check className="size-3" /> Válido
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                      @
                    </span>
                    <Input
                      id="username"
                      placeholder="juan_perez"
                      maxLength={24}
                      className="h-12 md:h-12 pl-8 sm:pl-9 text-base rounded-xl bg-background border-border focus-visible:ring-primary/20"
                      value={username}
                      onChange={(e) => {
                        setUsernameTouched(true);
                        setUsername(
                          e.target.value
                            .toLowerCase()
                            .replace(/\s+/g, "_")
                            .replace(/[^a-z0-9_.]/g, ""),
                        );
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Tu identificador único dentro de RU Coach (3 a 24 caracteres).
                  </p>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label
                    htmlFor="phone"
                    className="text-[11px] sm:text-xs uppercase font-semibold text-muted-foreground"
                  >
                    Teléfono / WhatsApp (opcional)
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="Ej. 961 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 md:h-12 text-base px-3.5 sm:px-4 rounded-xl bg-background border-border focus-visible:ring-primary/20"
                  />
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Permite que tu coach te contacte directamente cuando sea
                    necesario.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Físico y Biometría */}
          {currentStep === 2 && (
            <div
              className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 sm:space-y-6"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canProceed()) {
                  e.preventDefault();
                  handleNext();
                }
              }}
            >
              <div className="space-y-1">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  Paso 2 de 5 · Punto de Partida
                </span>
                <h2 className="text-xl sm:text-3xl font-bold tracking-tight">
                  Físico y Biometría Inicial
                </h2>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                  Se registrará automáticamente como tu primera medición en tus
                  gráficas de progreso.
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2 min-w-0">
                    <Label
                      htmlFor="birthDate"
                      className="text-[11px] sm:text-xs uppercase font-semibold text-muted-foreground"
                    >
                      Fecha de nacimiento *
                    </Label>
                    <Input
                      id="birthDate"
                      type="date"
                      min="1930-01-01"
                      max={new Date(
                        new Date().getFullYear() - 10,
                        11,
                        31,
                      )
                        .toISOString()
                        .slice(0, 10)}
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="h-12 md:h-12 w-full max-w-full min-w-0 appearance-none block px-3 text-base rounded-xl bg-background border-border focus-visible:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2 min-w-0">
                    <Label
                      htmlFor="gender"
                      className="text-[11px] sm:text-xs uppercase font-semibold text-muted-foreground"
                    >
                      Género *
                    </Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger
                        id="gender"
                        className="h-12 w-full rounded-xl bg-background border-border"
                      >
                        <SelectValue placeholder="Selecciona..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Masculino</SelectItem>
                        <SelectItem value="female">Femenino</SelectItem>
                        <SelectItem value="other">
                          Otro / Prefiero no decir
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 items-start">
                  <div className="space-y-1.5 sm:space-y-2 min-w-0">
                    <Label
                      htmlFor="height"
                      className="text-[11px] sm:text-xs uppercase font-semibold text-muted-foreground leading-tight"
                    >
                      Estatura (cm) *
                    </Label>
                    <Input
                      id="height"
                      type="number"
                      inputMode="numeric"
                      min={100}
                      max={250}
                      placeholder="Ej. 175"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="h-12 md:h-12 text-base px-3 sm:px-4 rounded-xl bg-background border-border focus-visible:ring-primary/20"
                    />
                    {height && !isHeightValid && (
                      <p className="text-[11px] text-destructive">
                        100 a 250 cm
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5 sm:space-y-2 min-w-0">
                    <Label
                      htmlFor="weight"
                      className="text-[11px] sm:text-xs uppercase font-semibold text-muted-foreground leading-tight"
                    >
                      Peso actual (kg) *
                    </Label>
                    <Input
                      id="weight"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min={30}
                      max={300}
                      placeholder="Ej. 70.5"
                      value={initialWeight}
                      onChange={(e) => setInitialWeight(e.target.value)}
                      className="h-12 md:h-12 text-base px-3 sm:px-4 rounded-xl bg-background border-border focus-visible:ring-primary/20"
                    />
                    {initialWeight && !isWeightValid && (
                      <p className="text-[11px] text-destructive">
                        30 a 300 kg
                      </p>
                    )}
                  </div>
                </div>

                {bmiValue && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-2.5 text-xs">
                    <span className="text-foreground/80 font-medium">
                      Línea base calculada
                    </span>
                    <span className="font-bold text-foreground">
                      {parsedWeight} kg · {parsedHeight} cm · IMC {bmiValue}
                    </span>
                  </div>
                )}

                <div className="pt-3.5 sm:pt-4 border-t border-border/60 space-y-3">
                  <div>
                    <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Composición corporal adicional (Opcional)
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      Si conoces tu cintura o % de grasa actual, agrégalos a tu
                      primera medición.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 items-start">
                    <div className="space-y-1.5 min-w-0">
                      <Label
                        htmlFor="waistCm"
                        className="text-[11px] sm:text-xs text-muted-foreground leading-tight"
                      >
                        Cintura (cm)
                      </Label>
                      <Input
                        id="waistCm"
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        placeholder="Ej. 82 cm"
                        value={waistCm}
                        onChange={(e) => setWaistCm(e.target.value)}
                        className="h-11 text-base sm:text-sm px-3 rounded-xl bg-background border-border"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <Label
                        htmlFor="bodyFatPct"
                        className="text-[11px] sm:text-xs text-muted-foreground leading-tight"
                      >
                        % Grasa corporal
                      </Label>
                      <Input
                        id="bodyFatPct"
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        placeholder="Ej. 18 %"
                        value={bodyFatPct}
                        onChange={(e) => setBodyFatPct(e.target.value)}
                        className="h-11 text-base sm:text-sm px-3 rounded-xl bg-background border-border"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Objetivo */}
          {currentStep === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 sm:space-y-6">
              <div className="space-y-1">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  Paso 3 de 5 · Meta
                </span>
                <h2 className="text-xl sm:text-3xl font-bold tracking-tight">
                  Tu Objetivo Principal
                </h2>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                  Esto define el enfoque de volumen, intensidad y progresión de
                  tu plan.
                </p>
              </div>
              <div className="space-y-2.5 sm:space-y-3">
                {FITNESS_GOALS.map((goal) => (
                  <button
                    key={goal.value}
                    type="button"
                    onClick={() => setFitnessGoal(goal.value)}
                    className={`group w-full flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                      fitnessGoal === goal.value
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-sm"
                        : "border-border/80 bg-card/50 hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`size-10 sm:size-11 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                        fitnessGoal === goal.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:text-foreground"
                      }`}
                    >
                      <Target className="size-5" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p
                        className={`font-bold text-sm sm:text-base leading-snug ${
                          fitnessGoal === goal.value
                            ? "text-foreground"
                            : "text-foreground/90"
                        }`}
                      >
                        {goal.label}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-0.5">
                        {goal.description}
                      </p>
                    </div>
                    <div
                      className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        fitnessGoal === goal.value
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {fitnessGoal === goal.value && (
                        <div className="size-2 rounded-full bg-primary-foreground" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Experiencia, Disponibilidad y Salud Articular */}
          {currentStep === 4 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 sm:space-y-6">
              <div>
                <div className="mb-4 sm:mb-5 space-y-1">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                    Paso 4 de 5 · Planificación y Salud
                  </span>
                  <h2 className="text-xl sm:text-3xl font-bold tracking-tight">
                    Experiencia y Salud Articular
                  </h2>
                  <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                    Información clave para que tu coach diseñe una rutina segura
                    y adaptada a tu semana.
                  </p>
                </div>
                <div className="space-y-2.5 sm:space-y-3">
                  {EXPERIENCE_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setExperienceLevel(level.value)}
                      className={`group w-full flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                        experienceLevel === level.value
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-sm"
                          : "border-border/80 bg-card/50 hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <div
                        className={`size-10 sm:size-11 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                          experienceLevel === level.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground group-hover:text-foreground"
                        }`}
                      >
                        <Dumbbell className="size-5" />
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p
                          className={`font-bold text-sm sm:text-base leading-snug ${
                            experienceLevel === level.value
                              ? "text-foreground"
                              : "text-foreground/90"
                          }`}
                        >
                          {level.label}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-0.5">
                          {level.description}
                        </p>
                      </div>
                      <div
                        className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          experienceLevel === level.value
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {experienceLevel === level.value && (
                          <div className="size-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Disponibilidad semanal */}
              <div className="rounded-2xl border border-border/80 bg-card/60 p-4 sm:p-5 space-y-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary shrink-0" />
                  <p className="text-xs sm:text-sm font-semibold">
                    ¿Cuántos días por semana puedes entrenar?
                  </p>
                </div>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
                  {TRAINING_DAYS_OPTIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setTrainingDaysPerWeek(days)}
                      className={`h-13 sm:h-14 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                        trainingDaysPerWeek === days
                          ? "border-primary bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                          : "border-border bg-background hover:border-primary/40 text-foreground"
                      }`}
                    >
                      <span className="text-base font-black leading-none">
                        {days === 6 ? "6+" : days}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80 mt-1">
                        días
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lesiones o molestias articulares */}
              <div className="rounded-2xl border border-border/80 bg-card/60 p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-amber-500 shrink-0" />
                    <p className="text-xs sm:text-sm font-semibold">
                      ¿Tienes alguna molestia o lesión articular actual?
                    </p>
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
                    Si indicas una molestia, tu coach verá una alerta en tu ficha
                    para adaptar tus ejercicios.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  <button
                    type="button"
                    onClick={() => setHasInjury(false)}
                    className={`h-11 px-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                      !hasInjury
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sin molestias
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasInjury(true)}
                    className={`h-11 px-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                      hasInjury
                        ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sí, reportar molestia
                  </button>
                </div>

                {hasInjury && (
                  <div className="space-y-4 pt-3 border-t border-border/60 animate-in fade-in duration-200">
                    <div className="space-y-1.5">
                      <Label htmlFor="injuryRegion" className="text-xs">
                        Zona con molestia
                      </Label>
                      <Select
                        value={injuryRegion}
                        onValueChange={setInjuryRegion}
                      >
                        <SelectTrigger
                          id="injuryRegion"
                          className="h-12 w-full rounded-xl bg-background"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INJURY_REGIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">Intensidad de la molestia</Label>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                            injurySeverity <= 3
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : injurySeverity <= 6
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {injurySeverity}/10 ·{" "}
                          {injurySeverity <= 3
                            ? "Leve"
                            : injurySeverity <= 6
                              ? "Moderada"
                              : "Intensa"}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setInjurySeverity(lvl)}
                            className={`h-10 sm:h-9 rounded-lg text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                              injurySeverity === lvl
                                ? lvl <= 3
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : lvl <= 6
                                    ? "border-amber-500 bg-amber-500 text-black"
                                    : "border-rose-500 bg-rose-500 text-white"
                                : "border-border bg-background text-muted-foreground hover:border-foreground/30"
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="injuryNotes" className="text-xs">
                        Detalles para tu coach (opcional)
                      </Label>
                      <Textarea
                        id="injuryNotes"
                        rows={2}
                        placeholder="Ej. Molestia en hombro derecho al hacer press vertical..."
                        value={injuryNotes}
                        onChange={(e) => setInjuryNotes(e.target.value)}
                        className="rounded-xl bg-background text-base sm:text-sm resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Resumen y Notificaciones */}
          {currentStep === 5 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 sm:space-y-6">
              <div className="space-y-1 text-center mt-0.5">
                <div className="mx-auto size-14 sm:size-16 rounded-full bg-primary/10 flex items-center justify-center mb-2.5 ring-8 ring-primary/5">
                  <Sparkles className="size-7 sm:size-8 text-primary" />
                </div>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  Paso 5 de 5 · Confirmación
                </span>
                <h2 className="text-xl sm:text-3xl font-black tracking-tight">
                  ¡Tu expediente está listo!
                </h2>
                <p className="text-muted-foreground text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
                  Revisa tus datos iniciales (toca cualquier bloque si deseas
                  editarlo) y comienza tu plan.
                </p>
              </div>

              {/* Resumen del Expediente (Interactivo para editar rápido) */}
              <div className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm p-4 sm:p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-left group cursor-pointer min-w-0"
                  >
                    <p className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">
                      {fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{username}{" "}
                      <span className="underline ml-1 opacity-75">Editar</span>
                    </p>
                  </button>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary shrink-0">
                    Nivel 1 · 0 XP
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="rounded-xl bg-muted/40 hover:bg-muted/70 p-2.5 text-left transition-colors cursor-pointer"
                  >
                    <p className="text-[11px] text-muted-foreground">Biometría</p>
                    <p className="font-semibold text-foreground mt-0.5 leading-snug">
                      {initialWeight} kg · {height} cm
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="rounded-xl bg-muted/40 hover:bg-muted/70 p-2.5 text-left transition-colors cursor-pointer"
                  >
                    <p className="text-[11px] text-muted-foreground">Objetivo</p>
                    <p className="font-semibold text-foreground mt-0.5 leading-snug">
                      {selectedGoalLabel}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="rounded-xl bg-muted/40 hover:bg-muted/70 p-2.5 text-left transition-colors cursor-pointer"
                  >
                    <p className="text-[11px] text-muted-foreground">Experiencia</p>
                    <p className="font-semibold text-foreground mt-0.5 leading-snug">
                      {selectedExpLabel}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="rounded-xl bg-muted/40 hover:bg-muted/70 p-2.5 text-left transition-colors cursor-pointer"
                  >
                    <p className="text-[11px] text-muted-foreground">Disponibilidad</p>
                    <p className="font-semibold text-foreground mt-0.5 leading-snug">
                      {trainingDaysPerWeek === 6 ? "6+" : trainingDaysPerWeek}{" "}
                      días / sem
                    </p>
                  </button>
                </div>
                {hasInjury && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="w-full flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400 text-left cursor-pointer"
                  >
                    <ShieldAlert className="size-4 shrink-0" />
                    <span>
                      Alerta articular para tu coach:{" "}
                      <strong>
                        {INJURY_REGIONS.find((r) => r.value === injuryRegion)
                          ?.label ?? injuryRegion}
                      </strong>{" "}
                      ({injurySeverity}/10)
                    </span>
                  </button>
                )}
              </div>

              {/* Notificaciones Push (Android + iOS 16.4+ PWA) */}
              <div className="space-y-3 p-4 sm:p-5 bg-muted/30 rounded-2xl border border-border text-center">
                <div className="space-y-1">
                  <p className="text-sm font-bold">
                    Notificaciones en Tiempo Real
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isIOSBrowser
                      ? "En iPhone/iPad, agrega RU Coach a tu Pantalla de Inicio para recibir notificaciones Push nativas en tiempo real."
                      : "Recibe avisos al instante cuando Rodrigo te asigne una nueva rutina, registre tu pago o te envíe un mensaje."}
                  </p>
                </div>

                {isIOSBrowser ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleEnableNotifications}
                    className="w-full min-h-12 h-auto py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold whitespace-normal leading-snug"
                  >
                    <Smartphone className="mr-2 size-4 text-primary shrink-0" />
                    <span>Ver cómo instalar en iPhone / iPad</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant={notificationsEnabled ? "default" : "outline"}
                    onClick={handleEnableNotifications}
                    className={`w-full min-h-12 h-auto py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold whitespace-normal leading-snug transition-all ${
                      notificationsEnabled
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : ""
                    }`}
                  >
                    {notificationsEnabled ? (
                      <>
                        <Check className="mr-2 size-4 shrink-0" />
                        <span>Notificaciones en tiempo real activadas</span>
                      </>
                    ) : (
                      <>
                        <Bell className="mr-2 size-4 shrink-0" />
                        <span>Activar notificaciones en tiempo real</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Fixed Bottom Navigation Area */}
      <div className="fixed bottom-0 left-0 right-0 p-3.5 sm:p-4 pb-safe bg-background/95 backdrop-blur-xl border-t border-border/60 z-50">
        <div className="container max-w-xl mx-auto flex items-center justify-between gap-2.5 sm:gap-4">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="h-12 px-4 sm:px-6 rounded-xl font-semibold border-border hover:bg-muted shrink-0"
            >
              <ChevronLeft className="size-4 mr-1" />
              <span>Atrás</span>
            </Button>
          )}

          {currentStep < STEPS.length ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
              className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm sm:text-base hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
            >
              <span>Siguiente</span>
              <ChevronRight className="size-5 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleComplete}
              disabled={isSubmitting}
              className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm sm:text-base hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="size-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Terminar y Comenzar</span>
                  <Check className="size-5" />
                </div>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


