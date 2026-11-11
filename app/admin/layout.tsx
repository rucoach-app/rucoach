import { getAuthData } from "@/lib/auth-utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLayoutShell } from "@/components/admin-layout-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role, profile } = await getAuthData();

  if (!user || role !== "admin") {
    redirect("/auth/login");
  }

  // Redirigir a onboarding SOLO si no está completado (evitando invocar headers() en cada navegación normal)
  if (profile && !profile.onboarding_completed) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || "";
    if (!pathname.startsWith("/admin/onboarding")) {
      redirect("/admin/onboarding");
    }
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </div>
  );
}
