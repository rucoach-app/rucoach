import { getAuthData } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GymSettingsForm } from "./gym-settings-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, User, Settings } from "lucide-react";
import {
  ADMIN_DATA_PAGE_SHELL,
  AdminPageHeader,
} from "@/components/admin/admin-page-header";
import { CoachProfileSettings } from "@/components/admin/coach-profile-settings";
import { MembershipPlansSettings } from "@/components/admin/membership-plans-settings";
import { cn } from "@/lib/utils";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { user, role, profile } = await getAuthData();

  if (!user || role !== "admin") redirect("/auth/login");

  const resolvedParams = searchParams ? await searchParams : {};
  const validTabs = ["profile", "plans", "general"];
  const defaultTab =
    resolvedParams?.tab && validTabs.includes(resolvedParams.tab)
      ? resolvedParams.tab
      : "profile";

  const supabase = await createClient();

  const [{ data: gymSettings }, { data: membershipPlans }] = await Promise.all([
    supabase
      .from("gym_settings")
      .select("gym_name, phone, schedule, currency, timezone")
      .eq("admin_id", user.id)
      .maybeSingle(),
    supabase
      .from("membership_plans")
      .select("id, name, duration_days, price, description, is_active, coach_id")
      .order("price", { ascending: true }),
  ]);

  const normalizedPlans = (membershipPlans ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    duration_days: Number(p.duration_days) || 30,
    price: Number(p.price) || 0,
    description: p.description ?? null,
    is_active: Boolean(p.is_active ?? true),
    coach_id: p.coach_id ?? null,
  }));

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        sticky
        title="Configuración"
        description="Administra los datos de tu negocio y la experiencia de tus asesorados."
      />

      <div className={cn(ADMIN_DATA_PAGE_SHELL, "space-y-8")}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <Tabs defaultValue={defaultTab} className="flex flex-col gap-6">
            <TabsList className="no-scrollbar flex h-auto w-full sm:w-fit items-center justify-start overflow-x-auto rounded-2xl border border-border/40 bg-muted/50 p-1 shadow-sm">
              <TabsTrigger
                value="profile"
                className="shrink-0 gap-2 rounded-xl px-4 py-2 data-[state=active]:shadow-md"
              >
                <User className="size-4" />
                Mi perfil
              </TabsTrigger>
              <TabsTrigger
                value="plans"
                className="shrink-0 gap-2 rounded-xl px-4 py-2 data-[state=active]:shadow-md"
              >
                <CreditCard className="size-4" />
                Planes y Tarifas
              </TabsTrigger>
              <TabsTrigger
                value="general"
                className="shrink-0 gap-2 rounded-xl px-4 py-2 data-[state=active]:shadow-md"
              >
                <Settings className="size-4" />
                General
              </TabsTrigger>
            </TabsList>
            <TabsContent value="profile" className="mt-0">
              <CoachProfileSettings
                userId={user.id}
                initialFullName={profile?.full_name}
                initialAvatarUrl={profile?.avatar_url}
              />
            </TabsContent>
            <TabsContent value="plans" className="mt-0">
              <MembershipPlansSettings
                initialPlans={normalizedPlans}
                currency={gymSettings?.currency ?? "MXN"}
              />
            </TabsContent>
            <TabsContent value="general" className="mt-0">
              <GymSettingsForm
                initialData={
                  gymSettings
                    ? {
                        gym_name: gymSettings.gym_name,
                        phone: gymSettings.phone ?? undefined,
                        schedule: gymSettings.schedule ?? undefined,
                        currency: gymSettings.currency ?? "MXN",
                        timezone: gymSettings.timezone ?? "America/Mexico_City",
                      }
                    : null
                }
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
