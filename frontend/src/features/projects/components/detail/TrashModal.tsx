import { Trash2, Undo2, X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useProjectTrash, useRestoreWorkItem } from "../../hooks/use-structure";

/** "hace 3 días" / "hoy" a partir de un ISO con hora. Basta para orientarse. */
function whenDeleted(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) {
    return "hoy";
  }
  if (days === 1) {
    return "ayer";
  }
  return `hace ${String(days)} días`;
}

/**
 * Papelera del proyecto: deshace un borrado.
 *
 * Borrar un elemento se lleva por delante todo lo que contenía, y en una
 * estructura de cientos de piezas eso puede ser el trabajo de un día. Todo se
 * borra de forma lógica, así que recuperarlo es cuestión de enseñarlo.
 *
 * Solo aparecen las RAÍCES de cada borrado (lo que alguien borró a propósito),
 * con la cuenta de lo que volvería con cada una.
 */
export function TrashModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const trashQuery = useProjectTrash(projectId);
  const restore = useRestoreWorkItem(projectId);
  const items = trashQuery.data ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Papelera del proyecto"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Trash2 className="size-4 text-muted-foreground" /> Papelera
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
          {trashQuery.isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-accent" />
          ) : trashQuery.isError ? (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
              No se pudo cargar la papelera.
            </p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No has borrado nada en este proyecto.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Al restaurar un elemento vuelve con todo lo que contenía, a su sitio original.
              </p>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.tipo_nombre ? `${item.tipo_nombre} · ` : ""}
                      borrado {whenDeleted(item.deleted_at)}
                      {item.contenido > 0 &&
                        ` · contiene ${String(item.contenido)} elemento${item.contenido !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={restore.isPending}
                    onClick={() => {
                      restore.mutate(item.id);
                    }}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                  >
                    <Undo2 className="size-3.5" /> Restaurar
                  </button>
                </div>
              ))}
            </>
          )}

          {restore.isError && (
            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              {getErrorMessage(restore.error, "No se pudo restaurar el elemento")}
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
