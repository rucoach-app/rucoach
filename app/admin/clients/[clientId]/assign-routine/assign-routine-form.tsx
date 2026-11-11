"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { assignRoutineToClient } from "@/app/actions/routine-assignment";
import { Dumbbell } from "lucide-react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

interface Routine {
  id: string;
  name: string;
  description?: string | null;
  duration_weeks?: number | null;
  days_per_week?: number | null;
}

interface Props {
  clientId: string;
  clientName: string;
  routines: Routine[];
}

export function AssignRoutineForm({ clientId, clientName, routines }: Props) {
  const router = useRouter();
  const [routineId, setRoutineId] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAssign = async () => {
    if (!routineId) {
      toast.error("Selecciona una rutina para asignar.");
      return;
    }

    setIsLoading(true);
    try {
      await assignRoutineToClient(clientId, routineId, notes || undefined);
      toast.success("Rutina asignada. Tu asesorado ya puede verla.");
      router.push(`/admin/clients/${clientId}`);
    } catch (error) {
      toast.error("No pudimos asignar la rutina. Intenta de nuevo.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-background">
      <AdminPageHeader
        title="Asignar rutina"
        description={clientName}
        backHref={`/admin/clients/${clientId}`}
        backLabel="Volver al asesorado"
      />

      <main className="container py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5" />
              Seleccionar rutina
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Elige la rutina que seguirá el asesorado. Podrás modificarla más
              adelante.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="routine">Rutina *</Label>
              <Select value={routineId} onValueChange={setRoutineId}>
                <SelectTrigger id="routine" className="w-full">
                  <SelectValue placeholder="Seleccionar rutina..." />
                </SelectTrigger>
                <SelectContent>
                  {routines.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No hay rutinas creadas. Crea una rutina primero.
                    </div>
                  ) : (
                    routines.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                        {(r.duration_weeks || r.days_per_week) &&
                          ` · ${r.duration_weeks ?? "-"} sem, ${r.days_per_week ?? "-"} días/sem`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notas para el asesorado</Label>
              <Textarea
                id="notes"
                placeholder="Objetivos, modificaciones, instrucciones especiales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex gap-4 pt-2">
              <Button onClick={handleAssign} disabled={!routineId || isLoading}>
                {isLoading ? "Asignando..." : "Asignar rutina"}
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/admin/clients/${clientId}`}>Cancelar</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
