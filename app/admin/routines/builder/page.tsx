import { getAuthData } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import {
  ADMIN_DATA_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";
import { RoutineBuilderLazy } from "./routine-builder-lazy";

export default async function BuilderPage() {
  const { user, role } = await getAuthData();
  if (!user) redirect("/auth/login");
  if (role !== "admin") redirect("/client/dashboard");

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        sticky
        title="Constructor de rutinas"
        description="Organiza la semana, arrastra ejercicios y guarda en un clic"
        backHref="/admin/routines"
        backLabel="Volver a rutinas"
      />

      <div className={ADMIN_DATA_PAGE_SHELL}>
        <RoutineBuilderLazy />
      </div>
    </div>
  );
}
