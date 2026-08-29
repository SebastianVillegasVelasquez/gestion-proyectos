import { useMemo, useState } from "react";
import { X, ListChecks, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { useAttachTask, useProjectTasks } from "../../hooks/use-tasks";
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "../../types/labels";
import type { WorkItemTree } from "../../types/api.types";
import { CreateTaskModal } from "../../tasks/CreateTaskModal";

export function NodeTasksModal({
  projectId,
  node,
  onClose,
}: {
  projectId: string;
  node: WorkItemTree;
  onClose: () => void;
}) {
  const tasksQuery = useProjectTasks(projectId);
  const attachTask = useAttachTask(projectId);
  const [selectedStandalone, setSelectedStandalone] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const allTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const attached = useMemo(
    () => allTasks.filter((t) => t.work_item_id === node.id),
    [allTasks, node.id],
  );
  const standalone = useMemo(() => allTasks.filter((t) => t.work_item_id === null), [allTasks]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold text-foreground">
            <ListChecks className="size-4 shrink-0 text-brand-teal" />
            <span className="truncate">Tareas de “{node.nombre}”</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Adjuntas a este elemento
            </p>
            {attached.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">Ninguna tarea adjunta todavía.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {attached.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="truncate text-foreground">{t.title}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        TASK_STATUS_COLORS[t.status],
                      )}
                    >
                      {TASK_STATUS_LABELS[t.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Adjuntar una tarea suelta del proyecto
            </p>
            {standalone.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                No hay tareas sueltas para adjuntar.
              </p>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedStandalone}
                  onChange={(e) => {
                    setSelectedStandalone(e.target.value);
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand-blue"
                >
                  <option value="">Selecciona una tarea…</option>
                  {standalone.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedStandalone || attachTask.isPending}
                  onClick={() => {
                    attachTask.mutate(
                      { taskId: selectedStandalone, workItemId: node.id },
                      {
                        onSuccess: () => {
                          setSelectedStandalone("");
                        },
                      },
                    );
                  }}
                  className="shrink-0 rounded-lg border border-brand-blue/40 bg-brand-blue/10 px-3 py-2 text-xs font-medium text-brand-blue-dark transition hover:bg-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-blue"
                >
                  Adjuntar
                </button>
              </div>
            )}
            {attachTask.isError && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                {getErrorMessage(attachTask.error, "No se pudo adjuntar la tarea")}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-brand-blue/40 hover:text-brand-blue-dark"
          >
            <Plus className="size-4" /> Nueva tarea en este elemento
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateTaskModal
          projectId={projectId}
          tasks={allTasks}
          initialWorkItemId={node.id}
          initialTitle={node.nombre}
          onClose={() => {
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
