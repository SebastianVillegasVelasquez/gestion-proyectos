import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import {
  useAddTaskDependency,
  useRemoveTaskDependency,
  useTaskDependencies,
} from "../hooks/use-tasks";
import { useNodeTypes, useWorkTree } from "../hooks/use-structure";
import type { WorkItemTree } from "../types/api.types";

const WI_PREFIX = "wi:";

/**
 * Editor de la dependencia Finish-to-Start de una tarea. Por ahora una tarea
 * solo puede depender de UN predecesor (otra tarea o un elemento del árbol,
 * típicamente una «actividad de terceros»), así que el selector de "añadir"
 * desaparece en cuanto hay una: para cambiarla se quita y se elige otra.
 *
 * El backend valida ciclos y dependencias entre proyectos; aquí solo se filtran
 * la propia tarea y la ya elegida.
 */
export function TaskDependencyEditor({
  taskId,
  projectId,
  canEdit,
  allTasks,
}: {
  taskId: string;
  projectId: string;
  canEdit: boolean;
  /** Tareas del proyecto para elegir de cuál depender. */
  allTasks: { id: string; title: string }[];
}) {
  const depsQuery = useTaskDependencies(taskId);
  const treeQuery = useWorkTree(projectId);
  const typesQuery = useNodeTypes(projectId);
  const addDependency = useAddTaskDependency();
  const removeDependency = useRemoveTaskDependency();
  const [pick, setPick] = useState("");

  const titleById = useMemo(() => {
    const map = new Map<string, string>();
    allTasks.forEach((t) => map.set(t.id, t.title));
    return map;
  }, [allTasks]);

  // Elementos que se comportan como dependencia de terceros (+ nombres de todos
  // los elementos, para etiquetar una dependencia ya guardada).
  const { depWorkItems, wiNameById } = useMemo(() => {
    const depTypeIds = new Set(
      (typesQuery.data ?? []).filter((t) => t.es_dependencia_externa).map((t) => t.id),
    );
    const items: { id: string; nombre: string }[] = [];
    const names = new Map<string, string>();
    const walk = (nodes: WorkItemTree[]) => {
      nodes.forEach((n) => {
        names.set(n.id, n.nombre);
        if (depTypeIds.has(n.tipo_id)) {
          items.push({ id: n.id, nombre: n.nombre });
        }
        walk(n.children);
      });
    };
    walk(treeQuery.data ?? []);
    return { depWorkItems: items, wiNameById: names };
  }, [typesQuery.data, treeQuery.data]);

  const deps = useMemo(() => depsQuery.data ?? [], [depsQuery.data]);
  const options = useMemo(() => {
    const takenTasks = new Set([taskId, ...deps.map((d) => d.depends_on_id).filter(Boolean)]);
    const takenWi = new Set(deps.map((d) => d.depends_on_work_item_id).filter(Boolean));
    return {
      workItems: depWorkItems
        .filter((w) => !takenWi.has(w.id))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      tasks: allTasks
        .filter((t) => !takenTasks.has(t.id))
        .sort((a, b) => a.title.localeCompare(b.title)),
    };
  }, [allTasks, depWorkItems, deps, taskId]);

  const hasOptions = options.workItems.length > 0 || options.tasks.length > 0;

  const labelFor = (dep: (typeof deps)[number]) =>
    dep.depends_on_work_item_id
      ? (wiNameById.get(dep.depends_on_work_item_id) ?? "un elemento")
      : (titleById.get(dep.depends_on_id ?? "") ?? "otra tarea");

  const submitAdd = () => {
    if (!pick) {
      return;
    }
    const isWi = pick.startsWith(WI_PREFIX);
    addDependency.mutate(
      {
        taskId,
        projectId,
        ...(isWi ? { dependsOnWorkItemId: pick.slice(WI_PREFIX.length) } : { dependsOnId: pick }),
      },
      {
        onSuccess: () => {
          setPick("");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      {depsQuery.isLoading ? (
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
      ) : deps.length === 0 ? (
        !canEdit && <p className="text-sm italic text-muted-foreground">Sin dependencias.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {deps.map((dep) => (
            <li
              key={dep.id}
              className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1"
            >
              <span className="text-muted-foreground">Depende de</span>
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                {labelFor(dep)}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    removeDependency.mutate({
                      taskId,
                      projectId,
                      dependsOnId: dep.depends_on_id ?? undefined,
                      dependsOnWorkItemId: dep.depends_on_work_item_id ?? undefined,
                    });
                  }}
                  disabled={removeDependency.isPending}
                  aria-label="Quitar dependencia"
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && deps.length === 0 && (
        <div className="flex items-center gap-1.5">
          <select
            value={pick}
            onChange={(e) => {
              setPick(e.target.value);
            }}
            disabled={!hasOptions || addDependency.isPending}
            aria-label="Elegir dependencia"
            className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-brand-gold"
          >
            <option value="">{hasOptions ? "Depende de…" : "No hay opciones"}</option>
            {options.workItems.length > 0 && (
              <optgroup label="Elementos (actividad de terceros)">
                {options.workItems.map((w) => (
                  <option key={w.id} value={`${WI_PREFIX}${w.id}`}>
                    {w.nombre}
                  </option>
                ))}
              </optgroup>
            )}
            {options.tasks.length > 0 && (
              <optgroup label="Tareas">
                {options.tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <button
            type="button"
            onClick={submitAdd}
            disabled={!pick || addDependency.isPending}
            className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-40"
          >
            <Plus className="size-3.5" />
            Añadir
          </button>
        </div>
      )}

      {(addDependency.isError || removeDependency.isError) && (
        <p className="text-xs text-rose-600 dark:text-rose-400">
          {getErrorMessage(
            addDependency.error ?? removeDependency.error,
            "No se pudo actualizar la dependencia",
          )}
        </p>
      )}
    </div>
  );
}
