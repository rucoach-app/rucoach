"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Exercise } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createAdminExercise,
  deleteAdminExercise,
  updateAdminExercise,
} from "@/app/actions/exercises";
import { getR2PresignedUrl } from "@/app/actions/r2-storage";
import { R2_PUBLIC_URL } from "@/lib/constants";
import { exEquipment, exInstructions, exName } from "@/lib/exercise-i18n";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  ListOrdered,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const PRIMARY_MUSCLES = [
  { value: "chest", label: "Pecho" },
  { value: "back", label: "Espalda" },
  { value: "shoulders", label: "Hombros" },
  { value: "biceps", label: "Bíceps" },
  { value: "triceps", label: "Tríceps" },
  { value: "abs", label: "Abdomen / Core" },
  { value: "glutes", label: "Glúteos" },
  { value: "quadriceps", label: "Cuádriceps" },
  { value: "hamstrings", label: "Isquiotibiales" },
  { value: "adductors", label: "Aductores" },
  { value: "calves", label: "Pantorrillas" },
  { value: "forearms", label: "Antebrazos" },
  { value: "trapezius", label: "Trapecios" },
  { value: "lower_back", label: "Espalda baja / Lumbar" },
  { value: "obliques", label: "Oblicuos" },
  { value: "hip_flexors", label: "Flexores de cadera" },
  { value: "full_body", label: "Cuerpo completo" },
  { value: "cardio", label: "Cardio" },
] as const;

export const QUICK_SECONDARY_MUSCLES = [
  "Glúteos",
  "Cuádriceps",
  "Isquiotibiales",
  "Aductores",
  "Abdomen / Core",
  "Lumbar / Espalda baja",
  "Pantorrillas",
  "Hombros",
  "Tríceps",
  "Bíceps",
  "Espalda alta / Dorsales",
  "Trapecios",
  "Antebrazos",
  "Flexores de cadera",
  "Oblicuos",
] as const;

export const EXERCISE_TYPES = [
  { value: "strength", label: "Fuerza / hipertrofia" },
  { value: "cardio", label: "Cardio" },
  { value: "mobility", label: "Movilidad" },
  { value: "hiit", label: "HIIT" },
  { value: "stretching", label: "Estiramiento" },
  { value: "calisthenics", label: "Calistenia" },
  { value: "plyometrics", label: "Pliometría" },
] as const;

const QUICK_EQUIPMENT_OPTIONS = [
  "Barra",
  "Mancuerna",
  "Máquina",
  "Polea",
  "Peso corporal",
  "Pesa rusa",
  "Bandas",
] as const;

function cleanStepLine(line: string): string {
  return line.replace(/^\s*(?:\d+[.)]\s*|[-•*]\s*)/, "").trim();
}

function normalizeInitialMuscle(raw?: string | null): string {
  if (!raw) return "chest";
  const key = raw.trim().toLowerCase();
  const valid = PRIMARY_MUSCLES.some((m) => m.value === key);
  if (valid) return key;
  const aliasMap: Record<string, string> = {
    pectorals: "chest",
    pecho: "chest",
    lats: "back",
    espalda: "back",
    traps: "trapezius",
    trapecios: "trapezius",
    spine: "lower_back",
    lumbar: "lower_back",
    delts: "shoulders",
    hombros: "shoulders",
    quads: "quadriceps",
    cuádriceps: "quadriceps",
    cuadriceps: "quadriceps",
    glúteos: "glutes",
    gluteos: "glutes",
    femorales: "hamstrings",
    isquios: "hamstrings",
    isquiotibiales: "hamstrings",
    aductores: "adductors",
    adductor: "adductors",
    waist: "abs",
    core: "abs",
    abdomen: "abs",
  };
  return aliasMap[key] ?? "chest";
}

function normalizeInitialType(raw?: string | null): string {
  if (!raw) return "strength";
  const key = raw.trim().toLowerCase();
  const valid = EXERCISE_TYPES.some((t) => t.value === key);
  return valid ? key : "strength";
}

interface ExerciseFormProps {
  mode?: "create" | "edit";
  initialExercise?: Exercise;
  returnHref?: string;
}

export function ExerciseForm({
  mode = "create",
  initialExercise,
  returnHref = "/admin/exercises",
}: ExerciseFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit" && Boolean(initialExercise);

  // Extract initial steps from instructions_es (or fallback instructions)
  const initialStepsList = initialExercise
    ? exInstructions(initialExercise)
    : [];
  const rawInitialNotes = initialExercise?.technique_notes?.trim() ?? "";

  // Avoid duplicate notes if an older exercise saved the exact same text into both instructions_es and technique_notes
  const isNotesDuplicateOfSteps =
    initialStepsList.length > 0 &&
    rawInitialNotes.length > 0 &&
    initialStepsList.join("\n").trim() === rawInitialNotes;

  const [pending, setPending] = useState(false);
  const [name, setName] = useState(() =>
    initialExercise ? exName(initialExercise) : "",
  );
  const [primaryMuscle, setPrimaryMuscle] = useState<string>(() =>
    normalizeInitialMuscle(initialExercise?.primary_muscle),
  );
  const [exerciseType, setExerciseType] = useState<string>(() =>
    normalizeInitialType(initialExercise?.exercise_type),
  );
  const [usesExternalLoad, setUsesExternalLoad] = useState<boolean>(() =>
    initialExercise?.uses_external_load !== undefined
      ? Boolean(initialExercise.uses_external_load)
      : true,
  );
  const [secondaryMusclesList, setSecondaryMusclesList] = useState<string[]>(
    () => {
      if (initialExercise?.secondary_muscles_es?.length) {
        return initialExercise.secondary_muscles_es
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (initialExercise?.secondary_muscle) {
        return initialExercise.secondary_muscle
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [];
    },
  );
  const [customSecondaryMuscle, setCustomSecondaryMuscle] = useState("");

  const toggleSecondaryMuscle = (muscleName: string) => {
    setSecondaryMusclesList((prev) => {
      const exists = prev.some(
        (m) => m.toLowerCase() === muscleName.toLowerCase(),
      );
      if (exists) {
        return prev.filter(
          (m) => m.toLowerCase() !== muscleName.toLowerCase(),
        );
      }
      return [...prev, muscleName];
    });
  };

  const handleAddCustomSecondaryMuscle = () => {
    const trimmed = customSecondaryMuscle.trim();
    if (!trimmed) return;
    setSecondaryMusclesList((prev) => {
      const exists = prev.some(
        (m) => m.toLowerCase() === trimmed.toLowerCase(),
      );
      if (exists) return prev;
      return [...prev, trimmed];
    });
    setCustomSecondaryMuscle("");
  };

  const removeSecondaryMuscle = (muscleName: string) => {
    setSecondaryMusclesList((prev) =>
      prev.filter((m) => m.toLowerCase() !== muscleName.toLowerCase()),
    );
  };

  const [equipment, setEquipment] = useState<string>(() =>
    initialExercise ? (exEquipment(initialExercise) ?? "") : "",
  );

  // Step-by-step instructions ("por puntos")
  const [steps, setSteps] = useState<string[]>(() =>
    initialStepsList.length > 0 ? initialStepsList : [""],
  );
  const [techniqueNotes, setTechniqueNotes] = useState<string>(() =>
    isNotesDuplicateOfSteps ? "" : rawInitialNotes,
  );
  const [showPreview, setShowPreview] = useState<boolean>(false);

  // Media URLs & R2 Upload State
  const [uploadingGif, setUploadingGif] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [gifUrl, setGifUrl] = useState(initialExercise?.gif_url ?? "");
  const [imageUrl, setImageUrl] = useState(initialExercise?.image_url ?? "");
  const [demoVideoUrl, setDemoVideoUrl] = useState(
    initialExercise?.demo_video_url ?? "",
  );

  const gifInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const stepRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const focusStep = (index: number) => {
    requestAnimationFrame(() => {
      const el = stepRefs.current[index];
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  };

  const handleStepChange = (index: number, value: string) => {
    // Si el coach pega varias líneas con saltos de línea, las separamos automáticamente en puntos individuales
    if (value.includes("\n")) {
      const splitLines = value
        .split(/\r?\n/)
        .map(cleanStepLine)
        .filter(Boolean);

      if (splitLines.length > 1) {
        setSteps((prev) => {
          const next = [...prev];
          next.splice(index, 1, ...splitLines);
          return next;
        });
        toast.success(
          `Se separaron ${splitLines.length} pasos automáticamente`,
        );
        focusStep(index + splitLines.length - 1);
        return;
      }
    }

    setSteps((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addStep = (afterIndex?: number) => {
    setSteps((prev) => {
      const next = [...prev];
      const insertAt =
        afterIndex !== undefined ? afterIndex + 1 : next.length;
      next.splice(insertAt, 0, "");
      focusStep(insertAt);
      return next;
    });
  };

  const removeStep = (index: number) => {
    setSteps((prev) => {
      if (prev.length <= 1) {
        return [""];
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    setSteps((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
    focusStep(targetIndex);
  };

  const convertNotesToSteps = () => {
    if (!techniqueNotes.trim()) return;
    const rawParts = techniqueNotes
      .split(/\r?\n|(?<=\.)\s+/)
      .map(cleanStepLine)
      .filter(Boolean);

    if (rawParts.length === 0) return;

    setSteps((prev) => {
      const existingNonEmpty = prev.map((s) => s.trim()).filter(Boolean);
      return [...existingNonEmpty, ...rawParts];
    });
    setTechniqueNotes("");
    toast.success(
      `Se convirtieron las notas en ${rawParts.length} pasos numerados`,
    );
  };

  async function handleGifUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingGif(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "gif";
      const path = `exercises/${crypto.randomUUID()}.${ext}`;
      const contentType = file.type || "image/gif";

      const signedUrl = await getR2PresignedUrl(path, contentType);

      const res = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });

      if (!res.ok) throw new Error("Error al subir a R2");

      const finalUrl = `${R2_PUBLIC_URL}/${path}`;
      setGifUrl(finalUrl);
      toast.success("GIF subido a R2 correctamente");
    } catch (err) {
      toast.error("Error al subir el GIF");
      console.error(err);
    } finally {
      setUploadingGif(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `exercises/images/${crypto.randomUUID()}.${ext}`;
      const contentType = file.type || "image/jpeg";

      const signedUrl = await getR2PresignedUrl(path, contentType);

      const res = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });

      if (!res.ok) throw new Error("Error al subir imagen a R2");

      const finalUrl = `${R2_PUBLIC_URL}/${path}`;
      setImageUrl(finalUrl);
      toast.success("Imagen subida a R2 correctamente");
    } catch (err) {
      toast.error("Error al subir la imagen");
      console.error(err);
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleDeleteExercise() {
    if (!isEdit || !initialExercise) return;
    setDeleting(true);
    try {
      const res = await deleteAdminExercise(initialExercise.id);
      if (!res.success) {
        toast.error(res.error || "No se pudo eliminar el ejercicio");
        return;
      }
      toast.success("Ejercicio eliminado del catálogo");
      router.push("/admin/exercises");
      router.refresh();
    } catch {
      toast.error("Error inesperado al eliminar el ejercicio");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre del ejercicio es obligatorio");
      return;
    }

    setPending(true);
    try {
      const cleanSteps = steps.map(cleanStepLine).filter(Boolean);

      const fd = new FormData();
      fd.set("name", name.trim());
      fd.set("primaryMuscle", primaryMuscle);
      fd.set("exerciseType", exerciseType);
      fd.set("usesExternalLoad", String(usesExternalLoad));
      fd.set("secondaryMuscle", secondaryMusclesList.join(", "));
      fd.set("equipment", equipment.trim());
      fd.set("instructionsEs", JSON.stringify(cleanSteps));
      fd.set("techniqueNotes", techniqueNotes.trim());
      fd.set("gifUrl", gifUrl.trim());
      fd.set("imageUrl", imageUrl.trim());
      fd.set("demoVideoUrl", demoVideoUrl.trim());

      if (isEdit && initialExercise) {
        const res = await updateAdminExercise(initialExercise.id, fd);
        if (!res.success) {
          toast.error(res.error || "No se pudo actualizar el ejercicio");
          return;
        }
        toast.success("Ejercicio actualizado correctamente");
      } else {
        const res = await createAdminExercise(fd);
        if (!res.success) {
          toast.error(res.error || "No se pudo crear el ejercicio");
          return;
        }
        toast.success("Ejercicio creado en el catálogo");
      }

      router.push(returnHref);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo guardar el ejercicio",
      );
    } finally {
      setPending(false);
    }
  }

  const filledSteps = steps.map((s) => s.trim()).filter(Boolean);
  const selectedMuscleLabel =
    PRIMARY_MUSCLES.find((m) => m.value === primaryMuscle)?.label ??
    primaryMuscle;
  const selectedTypeLabel =
    EXERCISE_TYPES.find((t) => t.value === exerciseType)?.label ?? exerciseType;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        {/* 1. IDENTIDAD Y CLASIFICACIÓN */}
        <Field>
          <FieldLabel htmlFor="ex-name">Nombre del ejercicio</FieldLabel>
          <FieldDescription>
            Así aparecerá en el constructor de rutinas y en la app del
            asesorado.
          </FieldDescription>
          <FieldContent>
            <Input
              id="ex-name"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="Ej. Press inclinado con mancuernas"
            />
          </FieldContent>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel id="ex-pm-label">Grupo muscular principal</FieldLabel>
            <FieldDescription>
              Define el filtro principal en el catálogo.
            </FieldDescription>
            <FieldContent>
              <Select value={primaryMuscle} onValueChange={setPrimaryMuscle}>
                <SelectTrigger
                  className="h-11 w-full rounded-xl"
                  aria-labelledby="ex-pm-label"
                >
                  <SelectValue placeholder="Elige músculo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PRIMARY_MUSCLES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel id="ex-type-label">Tipo de ejercicio</FieldLabel>
            <FieldDescription>
              Categoría biomecánica o metabólica.
            </FieldDescription>
            <FieldContent>
              <Select value={exerciseType} onValueChange={setExerciseType}>
                <SelectTrigger
                  className="h-11 w-full rounded-xl"
                  aria-labelledby="ex-type-label"
                >
                  <SelectValue placeholder="Elige tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {EXERCISE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
        </div>

        {/* EQUIPAMIENTO */}
        <Field>
          <FieldLabel htmlFor="ex-eq">Equipamiento (opcional)</FieldLabel>
          <FieldDescription>
            Selecciona rápido o escribe otro equipo.
          </FieldDescription>
          <FieldContent className="space-y-2.5">
            <Input
              id="ex-eq"
              name="equipment"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="Ej. Mancuernas, Polea, Barra…"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_EQUIPMENT_OPTIONS.map((item) => {
                const active =
                  equipment.trim().toLowerCase() === item.toLowerCase();
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setEquipment(active ? "" : item)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95 cursor-pointer",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </FieldContent>
        </Field>

        {/* MÚSCULOS SECUNDARIOS / SINERGISTAS (INTERACTIVO MULTI-SELECCIÓN) */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 space-y-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Músculos secundarios / sinergistas involucrados
                {secondaryMusclesList.length > 0 && (
                  <Badge
                    variant="outline"
                    className="border-primary/40 bg-primary/10 text-primary font-bold text-[11px] px-2 py-0.5 rounded-full"
                  >
                    {secondaryMusclesList.length} añadido{secondaryMusclesList.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toca los músculos que también se activan en este ejercicio (ej. en Sentadilla Sumo: Glúteos + Cuádriceps + Aductores). Se iluminarán en el mapa anatómico y contarán para el volumen del atleta.
              </p>
            </div>
          </div>

          {/* Chips interactivos con 1 toque */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_SECONDARY_MUSCLES.map((muscle) => {
              const active = secondaryMusclesList.some(
                (m) => m.toLowerCase() === muscle.toLowerCase(),
              );
              return (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleSecondaryMuscle(muscle)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 cursor-pointer",
                    active
                      ? "border-primary bg-primary/15 text-primary font-semibold shadow-xs"
                      : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {active ? (
                    <Check className="size-3.5 stroke-[2.5]" />
                  ) : (
                    <Plus className="size-3.5 text-muted-foreground/60" />
                  )}
                  {muscle}
                </button>
              );
            })}
          </div>

          {/* Input para agregar otro músculo personalizado */}
          <div className="flex items-center gap-2 pt-1">
            <Input
              id="ex-custom-muscle"
              value={customSecondaryMuscle}
              onChange={(e) => setCustomSecondaryMuscle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustomSecondaryMuscle();
                }
              }}
              placeholder="¿Falta algún músculo? Escríbelo aquí (ej. Aductor mayor, Sóleo)…"
              className="h-10 text-xs rounded-xl"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCustomSecondaryMuscle}
              disabled={!customSecondaryMuscle.trim()}
              className="h-10 rounded-xl px-3 text-xs shrink-0 cursor-pointer"
            >
              <Plus className="size-3.5 mr-1" /> Añadir
            </Button>
          </div>

          {/* Resumen de músculos secundarios activos */}
          {secondaryMusclesList.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 p-2.5 text-xs">
              <span className="font-semibold text-foreground text-[11px] mr-1">
                Activará en el mapa del asesorado:
              </span>
              {secondaryMusclesList.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 rounded-full bg-background border border-border/70 px-2.5 py-0.5 text-[11px] font-medium text-foreground shadow-2xs"
                >
                  {m}
                  <button
                    type="button"
                    onClick={() => removeSecondaryMuscle(m)}
                    className="rounded-full hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    title={`Quitar ${m}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="space-y-0.5">
            <label
              htmlFor="ex-external-load"
              className="text-sm font-semibold text-foreground cursor-pointer"
            >
              Usa carga externa (peso en kg)
            </label>
            <p className="text-xs text-muted-foreground">
              Actívalo si el asesorado registra peso (barra, mancuerna, polea o
              máquina) para calcular PRs y gráficas de fuerza.
            </p>
          </div>
          <Switch
            id="ex-external-load"
            checked={usesExternalLoad}
            onCheckedChange={setUsesExternalLoad}
          />
        </div>

        <Separator />

        {/* 2. DESCRIPCIÓN POR PUNTOS ("CÓMO HACERLO") */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <ListOrdered className="size-4 text-primary shrink-0" />
                <h3 className="text-sm font-bold tracking-tight text-foreground">
                  Descripción paso a paso (Por puntos)
                </h3>
                <Badge
                  variant="secondary"
                  className="rounded-full px-2.5 py-0 text-[11px] font-semibold tabular-nums"
                >
                  {filledSteps.length}{" "}
                  {filledSteps.length === 1 ? "punto" : "puntos"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cada punto se mostrará numerado (1, 2, 3…) en la sección{" "}
                <strong className="font-semibold text-foreground">
                  &ldquo;Cómo hacerlo&rdquo;
                </strong>{" "}
                de la ficha del ejercicio. Si pegas un texto de varias líneas,
                se dividirá en puntos automáticamente.
              </p>
            </div>

            <Button
              type="button"
              variant={showPreview ? "default" : "outline"}
              size="sm"
              className="h-9 rounded-xl shrink-0 self-start"
              onClick={() => setShowPreview((prev) => !prev)}
            >
              <Eye className="size-3.5 mr-1.5" />
              {showPreview ? "Ocultar vista previa" : "Ver cómo luce"}
            </Button>
          </div>

          {filledSteps.length === 0 && techniqueNotes.trim().length > 0 && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-foreground/90 leading-relaxed">
                <span className="font-semibold text-primary">Sugerencia:</span>{" "}
                Este ejercicio tiene texto en &ldquo;Técnica y notas&rdquo; pero
                aún no tiene puntos paso a paso. ¿Quieres separarlo en puntos
                automáticamente?
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9 rounded-xl shrink-0 font-semibold"
                onClick={convertNotesToSteps}
              >
                <Sparkles className="size-3.5 mr-1.5 text-primary" />
                Convertir en puntos
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {steps.map((step, index) => (
              <div
                key={index}
                className="group relative flex items-start gap-2.5 sm:gap-3 rounded-xl border border-border/60 bg-background/70 p-2.5 sm:p-3 transition-colors focus-within:border-primary/50 focus-within:bg-background"
              >
                <span
                  className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary tabular-nums"
                  aria-hidden
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <Textarea
                    ref={(el) => {
                      stepRefs.current[index] = el;
                    }}
                    rows={2}
                    value={step}
                    onChange={(e) => handleStepChange(index, e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        (e.metaKey || e.ctrlKey)
                      ) {
                        e.preventDefault();
                        addStep(index);
                      }
                    }}
                    aria-label={`Paso ${index + 1}`}
                    placeholder={
                      index === 0
                        ? "Ej. Colócate de pie con los pies al ancho de los hombros y sujeta las mancuernas con agarre neutro…"
                        : `Describe el paso ${index + 1} de la ejecución…`
                    }
                    className="min-h-[60px] resize-y border-0 bg-transparent p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                  />
                </div>

                <div className="flex shrink-0 flex-col sm:flex-row items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                    disabled={index === 0}
                    onClick={() => moveStep(index, -1)}
                    aria-label={`Subir paso ${index + 1}`}
                    title="Subir paso"
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                    disabled={index === steps.length - 1}
                    onClick={() => moveStep(index, 1)}
                    aria-label={`Bajar paso ${index + 1}`}
                    title="Bajar paso"
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeStep(index)}
                    aria-label={`Eliminar paso ${index + 1}`}
                    title="Eliminar paso"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-xl font-semibold border-dashed"
              onClick={() => addStep()}
            >
              <Plus className="size-4 mr-1.5" />
              Agregar otro punto
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Tip: presiona <kbd className="rounded border px-1 py-0.5 text-[10px]">Ctrl + Enter</kbd> para insertar un paso debajo
            </span>
          </div>
        </div>

        {/* 3. NOTAS TÉCNICAS / CUES DEL COACH (OPCIONAL) */}
        <Field>
          <FieldLabel htmlFor="ex-notes">
            Técnica y notas del coach (opcional)
          </FieldLabel>
          <FieldDescription>
            Consejos adicionales, tempo sugerido, errores comunes o
            adaptaciones. Se muestra en un bloque aparte debajo de los pasos.
          </FieldDescription>
          <FieldContent>
            <Textarea
              id="ex-notes"
              name="techniqueNotes"
              value={techniqueNotes}
              onChange={(e) => setTechniqueNotes(e.target.value)}
              className="min-h-24 rounded-xl"
              placeholder="Ej. Evita arquear la espalda baja al final del movimiento; mantén 2 segundos en la fase excéntrica…"
            />
          </FieldContent>
        </Field>

        {/* VISTA PREVIA EN VIVO */}
        {showPreview && (
          <div className="rounded-2xl border border-primary/30 bg-background/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  Vista previa en vivo · Ficha del asesorado
                </p>
                <h4 className="text-lg font-bold capitalize tracking-tight text-foreground mt-0.5">
                  {name.trim() || "Nombre del ejercicio"}
                </h4>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="rounded-full text-[11px]">
                  {selectedTypeLabel}
                </Badge>
                <Badge variant="secondary" className="rounded-full text-[11px]">
                  {selectedMuscleLabel}
                </Badge>
                {equipment.trim() && (
                  <Badge variant="outline" className="rounded-full text-[11px]">
                    {equipment.trim()}
                  </Badge>
                )}
              </div>
            </div>

            {filledSteps.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cómo hacerlo
                </p>
                <ol className="flex flex-col gap-2 text-sm leading-relaxed text-foreground/90">
                  {filledSteps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary tabular-nums">
                        {i + 1}
                      </span>
                      <span className="min-w-0 pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Aún no has escrito puntos en &ldquo;Cómo hacerlo&rdquo;.
              </p>
            )}

            {techniqueNotes.trim() && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Técnica y notas
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                    {techniqueNotes.trim()}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <Separator />

        {/* 4. MULTIMEDIA */}
        <Field>
          <FieldLabel htmlFor="ex-gif">GIF animado del ejercicio</FieldLabel>
          <FieldDescription>
            Sube un archivo GIF/WebP a Cloudflare R2 o pega una URL directa.
          </FieldDescription>
          <FieldContent className="space-y-3">
            <input
              ref={gifInputRef}
              type="file"
              accept="image/gif,image/webp"
              className="sr-only"
              onChange={handleGifUpload}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                disabled={uploadingGif}
                onClick={() => gifInputRef.current?.click()}
              >
                {uploadingGif ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {gifUrl ? "Cambiar archivo GIF" : "Subir GIF a R2"}
              </Button>
              {gifUrl && (
                <>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-[240px]">
                    <Check
                      className="size-3.5 text-primary shrink-0"
                      aria-hidden
                    />
                    <span className="truncate">{gifUrl.split("/").pop()}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setGifUrl("")}
                  >
                    <X className="size-3.5 mr-1" />
                    Quitar GIF
                  </Button>
                </>
              )}
            </div>
            <Input
              id="ex-gif"
              name="gifUrl"
              type="url"
              className="h-11 rounded-xl"
              placeholder="https://... o sube uno arriba"
              value={gifUrl}
              onChange={(e) => setGifUrl(e.target.value)}
            />
            {(gifUrl || imageUrl) && (
              <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-2.5 w-fit">
                <img
                  src={gifUrl || imageUrl}
                  alt="Vista previa del ejercicio"
                  className="size-20 rounded-lg border border-border/40 bg-white object-contain mix-blend-multiply"
                />
                <div className="pr-2 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">
                    Vista previa multimedia
                  </p>
                  <p>Así se verá la demostración en la rutina.</p>
                </div>
              </div>
            )}
          </FieldContent>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ex-img">
              Imagen estática (opcional)
            </FieldLabel>
            <FieldDescription>
              Sube JPG/PNG/WebP a Cloudflare R2 o pega una URL directa.
            </FieldDescription>
            <FieldContent className="space-y-3">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleImageUpload}
              />
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl"
                  disabled={uploadingImage}
                  onClick={() => imageInputRef.current?.click()}
                >
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {imageUrl ? "Cambiar imagen" : "Subir imagen a R2"}
                </Button>
                {imageUrl && (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-[160px]">
                      <Check
                        className="size-3.5 text-primary shrink-0"
                        aria-hidden
                      />
                      <span className="truncate">{imageUrl.split("/").pop()}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setImageUrl("")}
                    >
                      <X className="size-3.5 mr-1" />
                      Quitar
                    </Button>
                  </>
                )}
              </div>
              <Input
                id="ex-img"
                name="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="h-11 rounded-xl"
                placeholder="https://… o sube una imagen arriba"
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="ex-video">
              URL de vídeo demo (opcional)
            </FieldLabel>
            <FieldDescription>
              Enlace de referencia (YouTube, Vimeo o MP4).
            </FieldDescription>
            <FieldContent>
              <Input
                id="ex-video"
                name="demoVideoUrl"
                type="url"
                value={demoVideoUrl}
                onChange={(e) => setDemoVideoUrl(e.target.value)}
                className="h-11 rounded-xl"
                placeholder="YouTube, Vimeo o archivo…"
              />
            </FieldContent>
          </Field>
        </div>
      </FieldGroup>

      <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {isEdit && initialExercise && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full sm:w-auto rounded-xl font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={pending || deleting}
                >
                  <Trash2 className="size-4 mr-1.5" />
                  Eliminar ejercicio
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar ejercicio del catálogo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Estás por eliminar permanentemente{" "}
                    <span className="font-semibold text-foreground capitalize">
                      {name.trim() || exName(initialExercise)}
                    </span>
                    . Si está asignado a una rutina o historial de entrenamiento, no se podrá eliminar para proteger los registros.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting} className="rounded-xl">
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteExercise();
                    }}
                    disabled={deleting}
                    className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Eliminando…
                      </>
                    ) : (
                      "Sí, eliminar"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl font-semibold"
            onClick={() => router.push(returnHref)}
            disabled={pending || deleting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="h-11 rounded-xl font-semibold"
            disabled={pending || deleting}
          >
            {pending ? (
              <>
                <Loader2 className="animate-spin" data-icon="inline-start" />
                Guardando…
              </>
            ) : isEdit ? (
              "Guardar cambios"
            ) : (
              "Crear ejercicio"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

