import { useState } from "react";
import { Share2, X } from "lucide-react";
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
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
              <Share2 className="size-4" />
            </span>
            <div>
              <p className="text-[15px] font-medium text-foreground">Compartir con el cliente</p>
              <p className="text-[13px] text-muted-foreground">
                Enlace de solo lectura con el avance del proyecto
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
            className="shrink-0 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark"
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="size-4 text-brand-blue" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Enlace del cliente
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
            }}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
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
