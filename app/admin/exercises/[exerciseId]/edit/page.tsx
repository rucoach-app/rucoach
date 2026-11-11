import { getAuthUser } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ADMIN_FORM_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";
import { ExerciseForm } from "@/components/admin/exercises/exercise-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { exName } from "@/lib/exercise-i18n";
import type { Exercise } from "@/lib/types";

interface EditExercisePageProps {
  params: Promise<{ exerciseId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function EditExercisePage({
  params,
  searchParams,
}: EditExercisePageProps) {
  const { exerciseId } = await params;
  const { returnTo } = await searchParams;
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/client/dashboard");

  const { data: exerciseRow, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", exerciseId)
    .single();

  if (error || !exerciseRow) {
    redirect("/admin/exercises");
  }

  const exercise = exerciseRow as Exercise;
  const safeReturnHref =
    returnTo && returnTo.startsWith("/admin/")
      ? returnTo
      : "/admin/exercises";

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        title={`Editar · ${exName(exercise)}`}
        description="Modifica los pasos de ejecución por puntos, notas técnicas, músculos o multimedia."
        backHref={safeReturnHref}
        backLabel="Volver"
      />

      <div className={ADMIN_FORM_PAGE_SHELL}>
        <Card className="border-muted/70">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Ficha y ejecución del ejercicio</CardTitle>
            <CardDescription>
              Los cambios se reflejarán de inmediato en el catálogo y en todas
              las rutinas activas que incluyan este movimiento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExerciseForm
              mode="edit"
              initialExercise={exercise}
              returnHref={safeReturnHref}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

