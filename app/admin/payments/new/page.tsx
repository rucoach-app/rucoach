import { getAuthData } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewPaymentForm } from "./new-payment-form";
import {
  ADMIN_FORM_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";

type MembershipPlanRow = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
};

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams?: Promise<{ clientId?: string }>;
}) {
  const { user, role } = await getAuthData();

  if (!user || role !== "admin") {
    redirect("/auth/login");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const initialClientId = resolvedParams?.clientId;

  const supabase = await createClient();
  const [{ data: clients }, { data: plans }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, full_name, email, status, current_plan_id, membership_end")
      .eq("coach_id", user.id)
      .order("full_name"),
    supabase
      .from("membership_plans")
      .select("id, name, price, duration_days")
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        title="Registrar Nuevo Pago"
        description="Registra un cobro o cargo pendiente y actualiza automáticamente la vigencia del asesorado"
        backHref="/admin/payments"
        backLabel="Volver a pagos"
      />

      <div className={ADMIN_FORM_PAGE_SHELL}>
        <NewPaymentForm
          clients={clients || []}
          plans={(plans ?? []) as MembershipPlanRow[]}
          initialClientId={initialClientId}
        />
      </div>
    </div>
  );
}
