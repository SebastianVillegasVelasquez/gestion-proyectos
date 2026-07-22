import { useState } from "react";
import { Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useClientAccess, useRegenerateClientAccess } from "../../hooks/use-projects";
import { ClientAccessFields } from "./ClientAccessFields";

/**
 * Tarjeta para compartir el proyecto con el cliente: enlace completo + token
 * (solo lectura), con copiar/abrir/regenerar. El token se pide bajo demanda
 * (al abrir) para no exponerlo salvo que se vaya a compartir.
 */
export function ClientAccessCard({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const accessQuery = useClientAccess(projectId, open);
  const regenerate = useRegenerateClientAccess(projectId);

  if (!open) {
    return (
      <Card className="shrink-0">
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal-dark dark:text-brand-teal">
              <Share2 className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Compartir con el cliente
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Enlace de solo lectura con el avance del proyecto
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark"
          >
            Obtener enlace
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shrink-0">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center gap-2">
          <Share2 className="size-4 text-brand-teal" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Enlace del cliente
          </p>
        </div>

        {accessQuery.isLoading ? (
          <div className="h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ) : accessQuery.isError || !accessQuery.data ? (
          <p className="text-xs text-rose-500">No se pudo obtener el enlace. Intenta de nuevo.</p>
        ) : (
          <ClientAccessFields
            token={accessQuery.data.token}
            onRegenerate={() => {
              regenerate.mutate();
            }}
            regenerating={regenerate.isPending}
          />
        )}
      </CardContent>
    </Card>
  );
}
