import { CalendarClock, X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useUpdateWorkItem } from "../../hooks/use-structure";
import type { WorkItemTree } from "../../types/api.types";

interface Props {
  projectId: string;
  /** Elemento que termina después que su padre. */
  item: WorkItemTree;
  parent: WorkItemTree;
  onClose: () => void;
}

function fmt(iso: string | null): string {
  if (!iso) {
    return "sin fecha";
  }
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Resuelve un conflicto de fechas: este elemento termina después que su padre.
 *
 * El sistema no impide llegar hasta aquí (mover un elemento nunca se bloquea
 * por fechas), así que el trabajo de este modal es enseñar las dos fechas
 * enfrentadas y dejar elegir cuál cede. Las dos salidas son legítimas: a veces
 * el hijo se pasó de largo, y a veces el padre se quedó corto.
 */
export function DateConflictModal({ projectId, item, parent, onClose }: Props) {
  const updateItem = useUpdateWorkItem(projectId);

  const trimChild = () => {
    updateItem.mutate(
      { itemId: item.id, payload: { fecha_fin_plan: parent.fecha_fin_plan } },
      { onSuccess: onClose },
    );
  };

  const extendParent = () => {
    updateItem.mutate(
      { itemId: parent.id, payload: { fecha_fin_plan: item.fecha_fin_plan } },
      { onSuccess: onClose },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Conflicto de fechas"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CalendarClock className="size-4 text-rose-500" /> Fechas fuera del padre
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

        <div className="flex flex-col gap-4 px-5 py-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{item.nombre}</span> termina después que{" "}
            <span className="font-medium text-foreground">{parent.nombre}</span>. Puedes dejarlo así
            y ajustarlo luego, o cuadrarlo ahora.
          </p>

          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-accent/40 p-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Fin de {parent.nombre}</dt>
              <dd className="font-semibold text-foreground">{fmt(parent.fecha_fin_plan)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Fin de {item.nombre}</dt>
              <dd className="font-semibold text-rose-600 dark:text-rose-400">
                {fmt(item.fecha_fin_plan)}
              </dd>
            </div>
          </dl>

          {updateItem.isError && (
            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              {getErrorMessage(updateItem.error, "No se pudieron actualizar las fechas")}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={trimChild}
              disabled={updateItem.isPending || !parent.fecha_fin_plan}
              className="rounded-xl border border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              <span className="font-medium">Recortar {item.nombre}</span>
              <span className="block text-xs text-muted-foreground">
                Termina el {fmt(parent.fecha_fin_plan)}, igual que su padre.
              </span>
            </button>
            <button
              type="button"
              onClick={extendParent}
              disabled={updateItem.isPending || !item.fecha_fin_plan}
              className="rounded-xl border border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              <span className="font-medium">Extender {parent.nombre}</span>
              <span className="block text-xs text-muted-foreground">
                Termina el {fmt(item.fecha_fin_plan)}, para que quepa su contenido.
              </span>
            </button>
          </div>
        </div>

        <div className="flex justify-end border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            Dejarlo así por ahora
          </button>
        </div>
      </div>
    </div>
  );
}
