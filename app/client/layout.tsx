import { getAuthData, getCurrentClientRecord } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { ClientLayoutShell } from "@/components/client-layout-shell";
import { createClient } from "@/lib/supabase/server";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role, profile } = await getAuthData();

  if (!user || (role !== "client" && role !== "admin")) {
    redirect("/auth/login");
  }

  // Verificar vigencia real en tabla clients (cacheada por request con getCurrentClientRecord)
  if (role === "client") {
    const [supabase, clientRow] = await Promise.all([
      createClient(),
      getCurrentClientRecord(user.id),
    ]);

    if (clientRow) {
      if (clientRow.membership_end) {
        const endDay = clientRow.membership_end.slice(0, 10);
        const endDate = new Date(`${endDay}T23:59:59`);
        if (!Number.isNaN(endDate.getTime()) && endDate < new Date()) {
          if (clientRow.status !== "expired") {
            await supabase
              .from("clients")
              .update({ status: "expired" })
              .eq("id", clientRow.id);
          }
          if (profile?.subscription_status !== "expired") {
            await supabase
              .from("profiles")
              .update({ subscription_status: "expired" })
              .eq("id", user.id);
          }
          redirect("/suspended?status=expired");
        }
      }

      if (
        clientRow.status === "suspended" ||
        clientRow.status === "expired" ||
        clientRow.status === "pending_payment"
      ) {
        redirect(`/suspended?status=${clientRow.status}`);
      }

      // Si en clients ya está activo y vigente, asegurar que profiles.subscription_status esté sincronizado
      if (
        clientRow.status === "active" &&
        profile?.subscription_status !== "active"
      ) {
        await supabase
          .from("profiles")
          .update({ subscription_status: "active" })
          .eq("id", user.id);
      }
    } else if (
      profile?.subscription_status === "suspended" ||
      profile?.subscription_status === "expired" ||
      profile?.subscription_status === "pending_payment"
    ) {
      redirect(`/suspended?status=${profile.subscription_status}`);
    }
  }

  // Redirigir a onboarding si no está completado
  if (profile && !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <ClientLayoutShell>{children}</ClientLayoutShell>
    </div>
  );
}
