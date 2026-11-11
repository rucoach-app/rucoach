"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminClientStatusBadge } from "@/components/admin/admin-client-status-badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Calendar, Mail } from "lucide-react";
import { getGoalLabel } from "@/lib/constants";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

interface PendingClient {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  phone?: string;
  goal?: string;
}

export default function PendingClientsPage() {
  const [clients, setClients] = useState<PendingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    const loadPendingClients = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setClients([]);
          return;
        }

        const { data, error } = await supabase
          .from("clients")
          .select("id, full_name, email, created_at, phone, goal")
          .eq("coach_id", user.id)
          .eq("admin_approved", false)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setClients(data || []);
      } catch {
        toast.error(
          "No pudimos cargar la lista de asesorados pendientes. Recarga la página.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadPendingClients();
  }, []);

  const handleApproveClient = async (clientId: string) => {
    setApproving(clientId);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión requerida");

      const { error } = await supabase
        .from("clients")
        .update({
          admin_approved: true,
          approval_date: new Date().toISOString(),
          status: "pending_payment",
        })
        .eq("id", clientId)
        .eq("coach_id", user.id);

      if (error) throw error;

      toast.success("¡Asesorado aprobado! Ya puede usar la app.");
      setClients(clients.filter((c) => c.id !== clientId));
    } catch {
      toast.error("No pudimos aprobar al asesorado. Intenta de nuevo.");
    } finally {
      setApproving(null);
    }
  };

  const handleRejectClient = async (clientId: string) => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión requerida");

      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId)
        .eq("coach_id", user.id);

      if (error) throw error;

      toast.success("Solicitud rechazada correctamente.");
      setClients(clients.filter((c) => c.id !== clientId));
    } catch {
      toast.error("No pudimos rechazar la solicitud. Intenta de nuevo.");
    }
  };

  if (loading) {
    return <div className="container py-8">Cargando...</div>;
  }

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        title="Clientes pendientes"
        description="Aprueba o rechaza nuevas solicitudes"
        backHref="/admin/clients"
        backLabel="Volver a asesorados"
      />
      <main className="container py-8">
        {clients.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">
                No hay clientes pendientes
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {clients.map((client) => (
              <Card key={client.id} className="overflow-hidden">
                <CardContent className="pt-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {client.full_name}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {client.email}
                      </div>
                      {client.phone && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {client.phone}
                        </p>
                      )}
                    </div>
                    <AdminClientStatusBadge status="pending" />
                  </div>

                  {client.goal && (
                    <p className="mb-4 text-sm">
                      <span className="font-medium">Objetivo:</span>{" "}
                      {getGoalLabel(client.goal)}
                    </p>
                  )}

                  <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(client.created_at).toLocaleDateString()}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApproveClient(client.id)}
                      disabled={approving === client.id}
                      className="flex-1 gap-2"
                      variant="default"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Aprobar
                    </Button>
                    <Button
                      onClick={() => handleRejectClient(client.id)}
                      variant="outline"
                      className="flex-1 gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Rechazar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
