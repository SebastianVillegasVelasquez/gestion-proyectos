import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import {
  useAddTaskDependency,
  useRemoveTaskDependency,
  useTaskDependencies,
} from "../hooks/use-tasks";

/**
 * Editor de la dependencia Finish-to-Start de una tarea. Por ahora una tarea
 * solo puede depender de OTRA (una sola), así que el selector de "añadir"
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
  const addDependency = useAddTaskDependency();
  const removeDependency = useRemoveTaskDependency();
  const [pick, setPick] = useState("");

  const titleById = useMemo(() => {
    const map = new Map<string, string>();
    allTasks.forEach((t) => map.set(t.id, t.title));
    return map;
  }, [allTasks]);

  const deps = useMemo(() => depsQuery.data ?? [], [depsQuery.data]);
  const options = useMemo(() => {
    const taken = new Set([taskId, ...deps.map((d) => d.depends_on_id)]);
    return allTasks.filter((t) => !taken.has(t.id)).sort((a, b) => a.title.localeCompare(b.title));
  }, [allTasks, deps, taskId]);

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
                {titleById.get(dep.depends_on_id) ?? "otra tarea"}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    removeDependency.mutate({
                      taskId,
                      dependsOnId: dep.depends_on_id,
                      projectId,
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
            disabled={options.length === 0 || addDependency.isPending}
            aria-label="Elegir dependencia"
            className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-brand-gold"
          >
            <option value="">
              {options.length === 0 ? "No hay más tareas del proyecto" : "Depende de…"}
            </option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (!pick) {
                return;
              }
              addDependency.mutate(
                { taskId, dependsOnId: pick, projectId },
                {
                  onSuccess: () => {
                    setPick("");
                  },
                },
              );
            }}
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
