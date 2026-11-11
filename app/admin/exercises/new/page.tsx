import { getAuthUser } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ADMIN_FORM_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";
import { NewExerciseForm } from "./new-exercise-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function NewExercisePage() {
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/client/dashboard");

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        title="Nuevo ejercicio"
        description="Se guardará en el catálogo y estará disponible en el constructor de rutinas."
        backHref="/admin/exercises"
        backLabel="Catálogo"
      />

      <div className={ADMIN_FORM_PAGE_SHELL}>
        <Card className="border-muted/70">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Datos y ejecución del movimiento</CardTitle>
            <CardDescription>
              Define el nombre, grupo muscular, descripción paso a paso por
              puntos y recursos multimedia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewExerciseForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
