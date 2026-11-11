import { getAuthData } from "@/lib/auth-utils";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditPaymentForm } from "./edit-payment-form";
import {
  ADMIN_FORM_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";

export default async function EditPaymentPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { user, role } = await getAuthData();
  if (!user || role !== "admin") redirect("/auth/login");

  const { paymentId } = await params;
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("payments")
    .select(
      `
      *,
      clients (full_name, email)
    `,
    )
    .eq("id", paymentId)
    .single();

  if (!payment) notFound();

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        sticky
        title="Editar pago"
        description={`${payment.clients?.full_name ?? "Cliente"} • $${payment.amount?.toFixed(2) ?? "0.00"}`}
        backHref="/admin/payments"
        backLabel="Volver a pagos"
      />
      <div className={ADMIN_FORM_PAGE_SHELL}>
        <EditPaymentForm payment={payment} />
      </div>
    </div>
  );
}
