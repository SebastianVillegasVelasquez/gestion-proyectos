import { useMemo } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS, TASK_PRIORITY_LABELS } from "../../types/labels";
import type { Task, TaskStatus } from "../../types/api.types";
import { useChangeTaskStatus, useProjectTasks, useTaskDependencies } from "../../hooks/use-tasks";
import { getErrorMessage } from "@/utils/get-error-message";

const STATUS_FLOW: TaskStatus[] = [
  "pendiente_por_iniciar",
  "en_progreso",
  "en_revision",
  "completada",
];

export function TaskDetailPanel({
  projectId,
  task,
  onClose,
}: {
  projectId: string;
  task: Task;
  onClose: () => void;
}) {
  const changeStatus = useChangeTaskStatus(projectId);
  const depsQuery = useTaskDependencies(projectId, task.id);
  const tasksQuery = useProjectTasks(projectId);

  // depends_on_id → título de la tarea, para mostrar dependencias legibles
  // (no UUIDs). Reutiliza la lista de tareas ya cacheada del proyecto.
  const titleById = useMemo(() => {
    const map = new Map<string, string>();
    (tasksQuery.data ?? []).forEach((t) => map.set(t.id, t.title));
    return map;
  }, [tasksQuery.data]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Cerrar" className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{task.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <span
          className={cn(
            "mt-3 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium",
            TASK_STATUS_COLORS[task.status],
          )}
        >
          {TASK_STATUS_LABELS[task.status]}
        </span>

        {task.description && (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{task.description}</p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-slate-400">Inicio</dt>
            <dd className="text-slate-700 dark:text-slate-200">{task.start_date}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Entrega</dt>
            <dd className="text-slate-700 dark:text-slate-200">{task.due_date}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Prioridad</dt>
            <dd className="text-slate-700 dark:text-slate-200">
              {TASK_PRIORITY_LABELS[task.priority]}
            </dd>
          </div>
        </dl>

        {/* Cambio de estado */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cambiar estado
          </p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FLOW.map((status) => (
              <button
                key={status}
                type="button"
                disabled={status === task.status || changeStatus.isPending}
                onClick={() => {
                  changeStatus.mutate({ taskId: task.id, status });
                }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs transition disabled:cursor-not-allowed",
                  status === task.status
                    ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                {TASK_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
          {changeStatus.isError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {getErrorMessage(changeStatus.error, "No se pudo cambiar el estado")}
            </p>
          )}
        </div>

        {/* Dependencias */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Dependencias
          </p>
          {depsQuery.isLoading ? (
            <div className="h-6 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          ) : (depsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm italic text-slate-400">Sin dependencias.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
              {depsQuery.data?.map((dep) => (
                <li
                  key={dep.id}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 dark:border-slate-700"
                >
                  <span className="text-slate-400">Depende de</span>
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                    {titleById.get(dep.depends_on_id) ?? "otra tarea"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
