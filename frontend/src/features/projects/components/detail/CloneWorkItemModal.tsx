import { useMemo, useState } from "react";
import { X, Copy, ArrowDown, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCloneWorkItem } from "../../hooks/use-structure";
import type { DuracionUnidad, WorkItemTree } from "../../types/api.types";

interface Props {
  projectId: string;
  source: WorkItemTree;
  tree: WorkItemTree[];
  onClose: () => void;
}

interface FlatOption {
  id: string;
  label: string;
  disabled: boolean;
  reason?: string;
}

/** Recoge los ids del subárbol que se va a clonar (no son destinos válidos). */
function collectDescendantIds(node: WorkItemTree, into: Set<string>): void {
  into.add(node.id);
  node.children.forEach((c) => {
    collectDescendantIds(c, into);
  });
}

/** Aplana el árbol con sangría, marcando inválido el propio subárbol. */
function flatten(
  nodes: WorkItemTree[],
  forbidden: Set<string>,
  depth = 0,
  acc: FlatOption[] = [],
): FlatOption[] {
  nodes.forEach((n) => {
    const disabled = forbidden.has(n.id);
    acc.push({
      id: n.id,
      label: `${"  ".repeat(depth)}${depth > 0 ? "└ " : ""}${n.nombre}`,
      disabled,
      reason: disabled ? "Pertenece al contenido que vas a copiar" : undefined,
    });
    flatten(n.children, forbidden, depth + 1, acc);
  });
  return acc;
}

export function CloneWorkItemModal({ projectId, source, tree, onClose }: Props) {
  const cloneItem = useCloneWorkItem(projectId);
  const [targetParentId, setTargetParentId] = useState<string>("");
  const [offsetValue, setOffsetValue] = useState("0");
  const [offsetUnidad, setOffsetUnidad] = useState<DuracionUnidad>("dias");
  const [renameTo, setRenameTo] = useState(`${source.nombre} (copia)`);
  const [error, setError] = useState<string | null>(null);

  const forbidden = useMemo(() => {
    const set = new Set<string>();
    collectDescendantIds(source, set);
    return set;
  }, [source]);

  const options = useMemo(() => flatten(tree, forbidden), [tree, forbidden]);

  async function submit() {
    setError(null);
    const raw = Number(offsetValue);
    if (Number.isNaN(raw)) {
      setError("Indica un desplazamiento válido (puede ser 0 o negativo).");
      return;
    }
    const offsetDays = offsetUnidad === "semanas" ? raw * 7 : raw;

    try {
      await cloneItem.mutateAsync({
        itemId: source.id,
        payload: {
          target_parent_id: targetParentId || null,
          offset_days: offsetDays,
          rename_root_to: renameTo.trim() || null,
        },
      });
      onClose();
    } catch {
      setError("No se pudo duplicar. Revisa el destino e inténtalo de nuevo.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              <Copy className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Duplicar elemento
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Copia “{source.nombre}” y todo lo que cuelga de él.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-4 px-5 py-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Pegar bajo
            </span>
            <select
              value={targetParentId}
              onChange={(e) => {
                setTargetParentId(e.target.value);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Raíz del proyecto</option>
              {options.map((o) => (
                <option key={o.id} value={o.id} disabled={o.disabled}>
                  {o.label}
                  {o.disabled ? " — no disponible" : ""}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400">
              Los elementos del contenido a copiar están deshabilitados (no se puede pegar dentro de
              sí mismo).
            </span>
          </label>

          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <CalendarPlus className="size-3.5" /> Desplazamiento de fechas
            </span>
            <div className="flex gap-2">
              <input
                type="number"
                value={offsetValue}
                onChange={(e) => {
                  setOffsetValue(e.target.value);
                }}
                className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-800 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <select
                value={offsetUnidad}
                onChange={(e) => {
                  setOffsetUnidad(e.target.value as DuracionUnidad);
                }}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="dias">días</option>
                <option value="semanas">semanas</option>
              </select>
            </div>
            <span className="text-[11px] text-slate-400">
              Se suma a todas las fechas plan del contenido duplicado. Usa
              <span className="font-medium"> 0</span> para mantenerlas iguales, o un valor negativo
              para adelantarlas.
            </span>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Nombre del elemento copiado
            </span>
            <input
              value={renameTo}
              onChange={(e) => {
                setRenameTo(e.target.value);
              }}
              placeholder={source.nombre}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <ArrowDown className="size-3" /> qué se copia
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              <li>
                <span className="font-medium text-slate-700 dark:text-slate-200">Sí</span>:
                jerarquía completa, fechas plan (desplazadas), duraciones, tipos y dependencias FtS
                internas al contenido copiado.
              </li>
              <li>
                <span className="font-medium text-rose-600 dark:text-rose-400">No</span>: fechas
                reales, porcentaje completado, ni dependencias hacia elementos fuera del contenido
                copiado.
              </li>
            </ul>
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={cloneItem.isPending}
            className={cn(
              "rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60",
            )}
          >
            {cloneItem.isPending ? "Duplicando…" : "Duplicar elemento"}
          </button>
        </footer>
      </div>
    </div>
  );
}
