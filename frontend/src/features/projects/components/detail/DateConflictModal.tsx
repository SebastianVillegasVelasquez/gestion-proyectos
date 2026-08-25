import { useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useUpdateWorkItem } from "../../hooks/use-structure";
import type { WorkItemTree } from "../../types/api.types";

interface Props {
  projectId: string;
  /** Elemento que termina más tarde que el que lo contiene. */
  item: WorkItemTree;
  /** El elemento que lo contiene. En la UI nunca se le llama "padre": se le
   * llama por su nombre, que es como lo tiene en la cabeza quien planifica. */
  container: WorkItemTree;
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
 * Resuelve un desajuste de fechas: `item` termina después que `container`.
 *
 * Mover un elemento nunca se bloquea por fechas, así que el trabajo de este
 * modal es enseñar las dos fechas enfrentadas y dejar elegir cuál cede. Las
 * tres salidas son legítimas: recortar el de dentro, estirar el de fuera, o
 * poner una fecha distinta a mano (que puede seguir sin cuadrar: el aviso
 * seguirá ahí, y eso es válido mientras se replanifica).
 */
export function DateConflictModal({ projectId, item, container, onClose }: Props) {
  const updateItem = useUpdateWorkItem(projectId);
  const [manualDate, setManualDate] = useState<string | null>(null);

  const save = (itemId: string, fecha: string | null) => {
    updateItem.mutate({ itemId, payload: { fecha_fin_plan: fecha } }, { onSuccess: onClose });
  };

  // Una fecha escrita a mano puede seguir cayendo fuera: se avisa antes de
  // guardar, pero no se impide (el desajuste es un estado válido).
  const manualStillOutside =
    manualDate != null && container.fecha_fin_plan != null && manualDate > container.fecha_fin_plan;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Ajustar fechas"
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
            <CalendarClock className="size-4 text-rose-500" /> Ajustar fechas
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
            <span className="font-medium text-foreground">{container.nombre}</span>, que lo
            contiene. Puedes cuadrarlo ahora o dejarlo así y ajustarlo más tarde.
          </p>

          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-accent/40 p-3 text-sm">
            <div className="min-w-0">
              <dt className="truncate text-xs text-muted-foreground">{container.nombre}</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                termina {fmt(container.fecha_fin_plan)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="truncate text-xs text-muted-foreground">{item.nombre}</dt>
              <dd className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                termina {fmt(item.fecha_fin_plan)}
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
              onClick={() => {
                save(item.id, container.fecha_fin_plan);
              }}
              disabled={updateItem.isPending || !container.fecha_fin_plan}
              className="rounded-xl border border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              <span className="font-medium">
                Que {item.nombre} termine el {fmt(container.fecha_fin_plan)}
              </span>
              <span className="block text-xs text-muted-foreground">
                Se recorta para caber dentro de {container.nombre}.
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                save(container.id, item.fecha_fin_plan);
              }}
              disabled={updateItem.isPending || !item.fecha_fin_plan}
              className="rounded-xl border border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              <span className="font-medium">
                Que {container.nombre} termine el {fmt(item.fecha_fin_plan)}
              </span>
              <span className="block text-xs text-muted-foreground">
                Se estira para que quepa {item.nombre}.
              </span>
            </button>

            {manualDate == null ? (
              <button
                type="button"
                onClick={() => {
                  setManualDate(item.fecha_fin_plan ?? container.fecha_fin_plan ?? "");
                }}
                className="rounded-xl border border-dashed border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
              >
                <span className="font-medium">Elegir otra fecha</span>
                <span className="block text-xs text-muted-foreground">
                  Fija a mano cuándo termina {item.nombre}.
                </span>
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {item.nombre} termina el
                  </span>
                  <input
                    type="date"
                    autoFocus
                    value={manualDate}
                    onChange={(e) => {
                      setManualDate(e.target.value);
                    }}
                    aria-label={`Fecha de fin de ${item.nombre}`}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                  />
                </label>
                {manualStillOutside && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Sigue siendo posterior al fin de {container.nombre}: el aviso se mantendrá.
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setManualDate(null);
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      save(item.id, manualDate || null);
                    }}
                    disabled={updateItem.isPending || !manualDate}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-60"
                  >
                    Guardar fecha
                  </button>
                </div>
              </div>
            )}
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
