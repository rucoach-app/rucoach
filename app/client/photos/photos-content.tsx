"use client";

import { useState, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhotoUpload, PHOTO_VIEW_TYPES } from "@/components/photos/photo-upload";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { PhotoCompare } from "@/components/photos/photo-compare";
import type { ProgressPhoto } from "@/components/photos/photo-card";
import {
  LayoutGrid,
  Diff,
  UploadCloud,
  Camera,
  Sparkles,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { deleteR2Object } from "@/app/actions/r2-storage";
import { R2_PUBLIC_URL } from "@/lib/constants";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { parseRecordedDate } from "@/lib/calendar-date";

function parseTakenDate(dateStr: string): Date {
  return parseRecordedDate(dateStr);
}

export function PhotosContent({
  clientId,
  initialPhotos,
  latestWeightKg = null,
}: {
  clientId: string;
  initialPhotos: ProgressPhoto[];
  latestWeightKg?: number | null;
}) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>(initialPhotos);
  const [activeTab, setActiveTab] = useState<string>(() =>
    initialPhotos.length === 0 ? "upload" : "gallery",
  );
  const [uploadAngle, setUploadAngle] = useState<string>("front");
  const [galleryFilter, setGalleryFilter] = useState<string>("all");

  const angleStats = useMemo(() => {
    const map: Record<
      string,
      { count: number; latestDate: string | null }
    > = {
      front: { count: 0, latestDate: null },
      side: { count: 0, latestDate: null },
      back: { count: 0, latestDate: null },
      other: { count: 0, latestDate: null },
    };

    for (const p of photos) {
      const key =
        p.view_type && ["front", "side", "back", "other"].includes(p.view_type)
          ? p.view_type
          : "other";
      map[key].count += 1;
      if (
        !map[key].latestDate ||
        parseTakenDate(p.taken_at).getTime() >
          parseTakenDate(map[key].latestDate!).getTime()
      ) {
        map[key].latestDate = p.taken_at;
      }
    }

    return map;
  }, [photos]);

  const onUploadSuccess = useCallback((newPhoto: ProgressPhoto) => {
    setPhotos((prev) => {
      const updated = [newPhoto, ...prev];
      const count = updated.length;

      if (count === 1) {
        toast.success("¡Primera foto registrada!", {
          description:
            "Sube una foto más adelante para desbloquear el comparador Antes / Después.",
        });
      } else if (count === 2) {
        toast.success("¡Comparador desbloqueado!", {
          description:
            "Ya tienes 2 fotos registradas. Explora la pestaña Comparar para ver tu evolución.",
        });
      } else {
        toast.success("¡Foto guardada!", {
          description: `Tu progreso ha sido actualizado (${count} fotos en tu historial).`,
        });
      }

      return updated;
    });
    setActiveTab("gallery");
  }, []);

  const onDeleteSuccess = useCallback(
    async (deletedId: string) => {
      try {
        const photoToDelete = photos.find((p) => p.id === deletedId);
        const supabase = createClient();
        const { error } = await supabase
          .from("progress_photos")
          .delete()
          .eq("id", deletedId);

        if (error) throw error;

        if (photoToDelete?.photo_url) {
          try {
            const urlStr = photoToDelete.photo_url;
            let key: string | null = null;
            if (urlStr.startsWith(R2_PUBLIC_URL)) {
              key = urlStr.slice(R2_PUBLIC_URL.length).replace(/^\/+/, "");
            } else if (urlStr.includes(".r2.dev/")) {
              key = new URL(urlStr).pathname.replace(/^\/+/, "");
            }
            if (key) {
              await deleteR2Object(key);
            }
          } catch (r2Err) {
            console.warn("[PhotosContent] R2 delete warning:", r2Err);
          }
        }

        setPhotos((prev) => prev.filter((p) => p.id !== deletedId));
        toast.success("Foto eliminada");
      } catch {
        toast.error("No se pudo eliminar la foto de la base de datos.");
      }
    },
    [photos],
  );

  const handleAngleCardClick = (angleValue: string) => {
    const count = angleStats[angleValue]?.count ?? 0;
    if (activeTab === "upload" || count === 0) {
      setUploadAngle(angleValue);
      setActiveTab("upload");
      return;
    }
    if (activeTab === "gallery") {
      setGalleryFilter((prev) => (prev === angleValue ? "all" : angleValue));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
      {/* Left Aside: Studio Overview, Angle Checklist & Tips */}
      <aside className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-4 lg:sticky lg:top-[calc(112px+1.5rem)] lg:self-start">
        <Card className="overflow-hidden rounded-3xl border-border/80 shadow-md ring-1 ring-primary/5 transition-all hover:shadow-lg">
          <CardHeader className="space-y-4 pb-5">
            <div className="flex items-center gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                <Camera className="size-5 text-primary" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg font-bold tracking-tight">
                  Estudio Visual
                </CardTitle>
                <CardDescription className="text-xs font-medium">
                  Cobertura por perfil y protocolo de captura
                </CardDescription>
              </div>
            </div>

            {activeTab !== "upload" ? (
              <Button
                type="button"
                onClick={() => setActiveTab("upload")}
                className="h-11 w-full rounded-xl font-bold shadow-md shadow-primary/20"
              >
                <UploadCloud className="mr-2 size-4" />
                Registrar nueva foto
              </Button>
            ) : photos.length >= 2 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab("compare")}
                className="h-10 w-full rounded-xl text-xs font-semibold"
              >
                <Diff className="mr-2 size-4 text-primary" />
                Ir al comparador Antes / Después
              </Button>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 4 Angle Coverage Cards */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Perfiles registrados
                </p>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {activeTab === "upload"
                    ? "Toca para elegir ángulo"
                    : "Toca para filtrar"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {PHOTO_VIEW_TYPES.map((angle) => {
                  const stat = angleStats[angle.value];
                  const isUploadSelected =
                    activeTab === "upload" && uploadAngle === angle.value;
                  const isGalleryFiltered =
                    activeTab === "gallery" && galleryFilter === angle.value;
                  const isHighlighted = isUploadSelected || isGalleryFiltered;

                  return (
                    <button
                      key={angle.value}
                      type="button"
                      onClick={() => handleAngleCardClick(angle.value)}
                      className={cn(
                        "group flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all",
                        isHighlighted
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border/60 bg-muted/15 hover:border-primary/40 hover:bg-muted/25",
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-foreground">
                          {angle.label}
                        </span>
                        {stat.count > 0 ? (
                          <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <span className="size-2 rounded-full bg-muted-foreground/30 shrink-0" />
                        )}
                      </div>

                      <div className="mt-2">
                        <p className="text-lg font-black tabular-nums tracking-tight text-foreground">
                          {stat.count}{" "}
                          <span className="text-xs font-semibold text-muted-foreground">
                            {stat.count === 1 ? "foto" : "fotos"}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[10px] font-medium text-muted-foreground truncate">
                          {stat.latestDate
                            ? `Última: ${format(parseTakenDate(stat.latestDate), "d MMM", { locale: es })}`
                            : "Pendiente"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Compact Tips Section */}
            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-4">
              <div className="flex items-center gap-2">
                <Info className="size-4 text-primary shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Tips para mejores fotos
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    1
                  </span>
                  <span>
                    Usa la misma iluminación y hora del día (idealmente en ayunas).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    2
                  </span>
                  <span>
                    Mantén la misma distancia a la cámara y un fondo neutro.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    3
                  </span>
                  <span>
                    Usa ropa deportiva similar para comparar tu evolución con precisión.
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <p className="text-xs font-medium leading-relaxed text-primary">
                &ldquo;La constancia en las fotos es tan importante como la constancia en el entrenamiento. Es tu mejor herramienta para ver lo que la báscula no te dice.&rdquo;
              </p>
            </div>
          </CardContent>
        </Card>
      </aside>

      {/* Right Main Section */}
      <section className="order-1 min-w-0 lg:order-2 lg:col-span-8">
        <Card className="overflow-hidden rounded-3xl border-border/80 shadow-md ring-1 ring-primary/5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <CardHeader className="border-b bg-muted/5 px-5 pt-5 pb-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <TabsList className="no-scrollbar flex h-auto w-full items-center justify-start overflow-x-auto rounded-2xl border border-border/40 bg-muted/50 p-1 shadow-sm sm:w-fit">
                  <TabsTrigger
                    value="gallery"
                    className="shrink-0 gap-2 rounded-xl px-4 py-2 data-[state=active]:shadow-md"
                  >
                    <LayoutGrid className="size-4" />
                    <span>Galería</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="compare"
                    className="shrink-0 gap-2 rounded-xl px-4 py-2 data-[state=active]:shadow-md"
                  >
                    <Diff className="size-4" />
                    <span>Comparar</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="upload"
                    className="shrink-0 gap-2 rounded-xl px-4 py-2 data-[state=active]:shadow-md"
                  >
                    <UploadCloud className="size-4" />
                    <span>Subir</span>
                  </TabsTrigger>
                </TabsList>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="gap-1.5 rounded-xl px-3 py-1 text-xs font-semibold"
                  >
                    <Camera className="size-3.5 text-primary" />
                    <span>
                      {photos.length}{" "}
                      {photos.length === 1
                        ? "foto registrada"
                        : "fotos registradas"}
                    </span>
                  </Badge>

                  {photos.length >= 2 && (
                    <Badge
                      variant="outline"
                      className="gap-1.5 rounded-xl border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                    >
                      <Sparkles className="size-3.5" />
                      <span>Comparador activo</span>
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6">
              <TabsContent
                value="gallery"
                className="mt-0 focus-visible:outline-none"
              >
                <PhotoGallery
                  photos={photos}
                  onDeleteSuccess={onDeleteSuccess}
                  onRequestUpload={() => setActiveTab("upload")}
                  externalFilter={galleryFilter}
                  onExternalFilterChange={setGalleryFilter}
                />
              </TabsContent>

              <TabsContent
                value="compare"
                className="mt-0 focus-visible:outline-none"
              >
                <PhotoCompare
                  photos={photos}
                  onRequestUpload={() => setActiveTab("upload")}
                />
              </TabsContent>

              <TabsContent
                value="upload"
                className="mt-0 focus-visible:outline-none"
              >
                <PhotoUpload
                  clientId={clientId}
                  onSuccess={onUploadSuccess}
                  latestWeightKg={latestWeightKg}
                  selectedViewType={uploadAngle}
                  onViewTypeChange={setUploadAngle}
                />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </section>
    </div>
  );
}
