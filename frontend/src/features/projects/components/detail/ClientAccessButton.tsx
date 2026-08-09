import { useEffect, useRef, useState } from "react";
import { Share2, X } from "lucide-react";
import { useClientAccess, useRegenerateClientAccess } from "../../hooks/use-projects";
import { ClientAccessFields } from "./ClientAccessFields";

/**
 * Control compacto para compartir el proyecto con el cliente: un botón discreto
 * (pensado para el encabezado, junto al toggle de tema) que despliega un panel
 * con el enlace y el token. El token se pide bajo demanda (al abrir) para no
 * exponerlo salvo que se vaya a compartir. Reemplaza a la antigua tarjeta que
 * ocupaba una fila entera en el cuerpo del detalle.
 */
export function ClientAccessButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const accessQuery = useClientAccess(projectId, open);
  const regenerate = useRegenerateClientAccess(projectId);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera o con Escape: comportamiento esperado de un popover.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label="Compartir con el cliente"
        title="Compartir con el cliente"
        className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
      >
        <Share2 className="size-4 text-brand-blue" />
        <span className="hidden sm:inline">Compartir</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="size-4 text-brand-blue" />
              <p className="text-sm font-semibold text-foreground">Compartir con el cliente</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
              }}
              aria-label="Cerrar"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {accessQuery.isLoading ? (
            <div className="h-9 animate-pulse rounded-lg bg-accent" />
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
        </div>
      )}
    </div>
  );
}
