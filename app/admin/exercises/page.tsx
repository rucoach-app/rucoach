import { Suspense } from "react";
import { getAuthData } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ADMIN_DATA_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";
import { AdminExerciseCatalog } from "@/components/admin/exercises/admin-exercise-catalog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Exercise } from "@/lib/types";
import {
  canonicalMuscleDbTerms,
  MUSCLES,
  type MuscleSlug,
} from "@/lib/anatomy/muscles";

interface AdminExercisesPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    bodyPart?: string;
    equipment?: string;
    muscle?: string;
  }>;
}

export default async function AdminExercisesPage({
  searchParams,
}: AdminExercisesPageProps) {
  const {
    page: pageStr,
    search,
    bodyPart,
    equipment,
    muscle,
  } = await searchParams;
  const { user, role } = await getAuthData();
  if (!user || role !== "admin") redirect("/auth/login");

  const supabase = await createClient();

  const pageSize = 24;
  const page = pageStr ? Math.max(1, parseInt(pageStr)) : 1;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("exercises").select("*", { count: "exact" });

  if (search) {
    query = query.or(`name.ilike.%${search}%,name_es.ilike.%${search}%`);
  }

  if (bodyPart) {
    query = query.contains("body_parts_es", [bodyPart]);
  }

  if (equipment) {
    query = query.or(
      `equipment_es.ilike.%${equipment}%,equipment.ilike.%${equipment}%`,
    );
  }

  const validMuscle =
    muscle && MUSCLES.includes(muscle as MuscleSlug)
      ? (muscle as MuscleSlug)
      : null;

  if (validMuscle) {
    const terms = canonicalMuscleDbTerms(validMuscle);
    const orClauses = terms.flatMap((t) => [
      `primary_muscle.ilike.${t}`,
      `secondary_muscles.cs.{"${t}"}`,
    ]);
    query = query.or(orClauses.join(","));
  }

  const {
    data: rows,
    count,
    error,
  } = await query.order("name").range(from, to);

  if (error) {
    console.error("admin exercises", error);
  }

  const exercises = (rows ?? []) as Exercise[];
  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Body parts en español (valores de body_parts_es)
  const allBodyParts = [
    "antebrazos",
    "brazos",
    "cardio",
    "cintura",
    "cuello",
    "espalda",
    "hombros",
    "pantorrillas",
    "pecho",
    "piernas",
  ].sort();

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        sticky
        title="Catálogo de ejercicios"
        description="Consulta la biblioteca, explora por grupo muscular en el mapa anatómico o agrega nuevos movimientos."
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/admin/exercises/new">
              <Plus data-icon="inline-start" />
              Nuevo ejercicio
            </Link>
          </Button>
        }
      />

      <div className={ADMIN_DATA_PAGE_SHELL}>
        <Suspense fallback={null}>
          <AdminExerciseCatalog
            exercises={exercises}
            totalCount={totalCount}
            totalPages={totalPages}
            currentPage={page}
            allBodyParts={allBodyParts}
            initialFilters={{
              search: search || "",
              bodyPart: bodyPart || null,
              equipment: equipment || null,
              muscle: validMuscle,
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
