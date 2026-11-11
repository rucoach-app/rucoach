import { getAuthUser } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import {
  ADMIN_FORM_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";
import { NewClientForm } from "./new-client-form";

export default async function NewClientPage() {
  const user = await getAuthUser();

  if (!user) redirect("/auth/login");

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        title="Nuevo asesorado"
        description="Agrega un nuevo asesorado a tu lista"
        backHref="/admin/clients"
        backLabel="Volver a asesorados"
      />

      <div className={ADMIN_FORM_PAGE_SHELL}>
        <NewClientForm />
      </div>
    </div>
  );
}
