import { useMemo, useState } from "react";
import { X, Link2, Trash2, ArrowRight } from "lucide-react";
import {
  useWorkItemDependencies,
  useAddWorkItemDependency,
  useRemoveWorkItemDependency,
} from "../../hooks/use-structure";
import type { WorkItemTree } from "../../types/api.types";

interface Props {
  projectId: string;
  item: WorkItemTree;
  tree: WorkItemTree[];
  onClose: () => void;
}

function flattenNames(nodes: WorkItemTree[], map: Map<string, string>): void {
  nodes.forEach((n) => {
    map.set(n.id, n.nombre);
    flattenNames(n.children, map);
  });
}

function flattenOptions(
  nodes: WorkItemTree[],
  depth = 0,
  acc: { id: string; label: string }[] = [],
): { id: string; label: string }[] {
  nodes.forEach((n) => {
    acc.push({ id: n.id, label: `${"  ".repeat(depth)}${depth > 0 ? "└ " : ""}${n.nombre}` });
    flattenOptions(n.children, depth + 1, acc);
  });
  return acc;
}

export function DependenciesModal({ projectId, item, tree, onClose }: Props) {
  const depsQuery = useWorkItemDependencies(item.id);
  const addDep = useAddWorkItemDependency(projectId);
  const removeDep = useRemoveWorkItemDependency(projectId);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    flattenNames(tree, map);
    return map;
  }, [tree]);

  // Candidatos a predecesor: todos menos el propio nodo (el backend rechaza
  // ciclos y auto-dependencias; aquí solo evitamos lo obvio).
  const options = useMemo(
    () => flattenOptions(tree).filter((o) => o.id !== item.id),
    [tree, item.id],
  );

  const deps = depsQuery.data ?? [];

  async function add() {
    if (!pick) {
      return;
    }
    setError(null);
    try {
      await addDep.mutateAsync({ itemId: item.id, dependsOnId: pick });
      setPick("");
    } catch {
      setError(
        "No se pudo añadir: crearía un ciclo, ya existe, o el nodo iniciaría antes de que termine su predecesor.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Link2 className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Dependencias
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                “{item.nombre}” no podrá iniciar hasta que terminen sus predecesores.
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
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Depende de
            </p>
            {depsQuery.isLoading ? (
              <div className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ) : deps.length === 0 ? (
              <p className="text-sm italic text-slate-400 dark:text-slate-500">
                Sin dependencias. Empieza cuando quiera (según sus fechas o su padre).
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {deps.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <ArrowRight className="size-3.5 shrink-0 text-amber-500" />
                    <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                      {nameById.get(d.depends_on_id) ?? "Nodo"}
                    </span>
                    <button
                      onClick={() => {
                        removeDep.mutate({ itemId: item.id, dependsOnId: d.depends_on_id });
                      }}
                      title="Quitar dependencia"
                      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Añadir predecesor
            </p>
            <div className="flex gap-2">
              <select
                value={pick}
                onChange={(e) => {
                  setPick(e.target.value);
                }}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Selecciona un nodo…</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                onClick={add}
                disabled={!pick || addDep.isPending}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                Añadir
              </button>
            </div>
            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
