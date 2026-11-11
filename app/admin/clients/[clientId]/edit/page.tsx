import { getAuthUser, getUserRole } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditClientForm } from "./edit-client-form";
import {
  ADMIN_FORM_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";

interface Props {
  params: Promise<{ clientId: string }>;
}

export default async function EditClientPage({ params }: Props) {
  const user = await getAuthUser();
  const role = await getUserRole();
  const { clientId } = await params;

  if (!user) redirect("/auth/login");
  if (role !== "admin") redirect("/auth/login");

  const supabase = await createClient();
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .single();

  if (error || !client) redirect("/admin/clients");

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        title="Editar asesorado"
        description={client.full_name}
        backHref={`/admin/clients/${clientId}`}
        backLabel="Volver al asesorado"
      />

      <div className={ADMIN_FORM_PAGE_SHELL}>
        <EditClientForm client={client} />
      </div>
    </div>
  );
}
