import { useState } from "react";
import { X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import {
  useAddTaskDependency,
  useRemoveTaskDependency,
  useTaskDependencies,
  useUpdateTask,
} from "@/features/projects/hooks/use-tasks";
import type { UpdateTaskPayload } from "@/features/projects/types/api.types";
import type { ApiTeamTask, ApiTeamMember } from "../api/workspace.api";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

const PRIORITIES = ["no_definida", "baja", "media", "alta", "urgente"] as const;
const PRIORITY_LABELS: Record<(typeof PRIORITIES)[number], string> = {
  no_definida: "Sin definir",
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

/**
 * Edición de una tarea (o subtarea) DEL EQUIPO por su líder/supervisor: el
 * backend acota los campos tocables a los propios de la tarea (título,
 * prioridad, fechas, responsable, aprobación) y exige que siga siendo de SU
 * equipo — el mismo `PATCH /tasks/{id}` que usa la edición de administración,
 * solo que aquí no se ofrece cambiar de equipo ni la ubicación en el árbol.
 */
export function EditTeamTaskModal({
  projectId,
  task,
  teamMembers,
  siblings,
  onClose,
}: {
  projectId: string;
  task: ApiTeamTask;
  teamMembers: ApiTeamMember[];
  /** Otras subtareas de la misma tarea padre: candidatas a dependencia FtS.
   *  Vacío / no aplica cuando la tarea no es una subtarea. */
  siblings: ApiTeamTask[];
  onClose: () => void;
}) {
  const updateTask = useUpdateTask(projectId);
  const isSubtask = task.parent_task_id !== null;
  const depsQuery = useTaskDependencies(isSubtask ? task.id : undefined);
  const addDep = useAddTaskDependency();
  const removeDep = useRemoveTaskDependency();
  // Solo las dependencias hacia otra tarea (las hermanas); ignoramos las que
  // apuntan a un elemento del árbol, que aquí no se editan.
  const taskDeps = (depsQuery.data ?? []).filter((d) => d.depends_on_id !== null);
  const siblingById = new Map(siblings.map((s) => [s.id, s]));
  const available = siblings.filter((s) => !taskDeps.some((d) => d.depends_on_id === s.id));

  const [title, setTitle] = useState(task.title);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? "");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>(
    (task.priority as (typeof PRIORITIES)[number]) || "media",
  );
  const [startDate, setStartDate] = useState(task.start_date ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [requiresApproval, setRequiresApproval] = useState(task.requires_approval);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (cleanTitle.length < 2) {
      setError("El título debe tener al menos 2 caracteres.");
      return;
    }
    setError(null);

    const payload: UpdateTaskPayload = {};
    if (cleanTitle !== task.title) {
      payload.title = cleanTitle;
    }
    if (priority !== task.priority) {
      payload.priority = priority;
    }
    if ((assigneeId || null) !== (task.assignee_id ?? null)) {
      payload.assignee_id = assigneeId || null;
    }
    if ((startDate || null) !== (task.start_date ?? null)) {
      // `null`, no `undefined`: vaciar el campo debe llegar al backend.
      payload.start_date = startDate || null;
    }
    if ((dueDate || null) !== (task.due_date ?? null)) {
      payload.due_date = dueDate || null;
    }
    if (requiresApproval !== task.requires_approval) {
      payload.requires_approval = requiresApproval;
    }

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    updateTask.mutate(
      { taskId: task.id, payload },
      {
        onSuccess: onClose,
        onError: (err) => {
          setError(getErrorMessage(err, "No se pudo guardar la tarea"));
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Editar tarea</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className={labelCls} htmlFor="edit-team-task-title">
              Título *
            </label>
            <input
              id="edit-team-task-title"
              type="text"
              value={title}
              autoFocus
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="edit-team-task-assignee">
              Responsable
            </label>
            <select
              id="edit-team-task-assignee"
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
              }}
              className={inputCls}
            >
              <option value="">Sin asignar (bolsa del equipo)</option>
              {teamMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} {m.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="edit-team-task-priority">
              Prioridad
            </label>
            <select
              id="edit-team-task-priority"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value as (typeof PRIORITIES)[number]);
              }}
              className={inputCls}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="edit-team-task-start">
                Inicio
              </label>
              <input
                id="edit-team-task-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="edit-team-task-due">
                Entrega
              </label>
              <input
                id="edit-team-task-due"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                }}
                className={inputCls}
              />
            </div>
          </div>

          {isSubtask && (
            <div>
              <span className={labelCls}>Depende de (subtareas hermanas)</span>
              {taskDeps.length > 0 ? (
                <ul className="mb-2 space-y-1">
                  {taskDeps.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800/50"
                    >
                      <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                        {siblingById.get(d.depends_on_id ?? "")?.title ?? "Otra subtarea"}
                      </span>
                      <button
                        type="button"
                        disabled={removeDep.isPending}
                        onClick={() => {
                          removeDep.mutate({
                            taskId: task.id,
                            dependsOnId: d.depends_on_id ?? undefined,
                            projectId,
                          });
                        }}
                        className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-500/10"
                        aria-label="Quitar dependencia"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-2 text-[11px] text-slate-400 dark:text-slate-500">
                  Sin dependencias: puede comenzar en cuanto se planifique.
                </p>
              )}
              {available.length > 0 && (
                <select
                  value=""
                  disabled={addDep.isPending}
                  onChange={(e) => {
                    if (!e.target.value) {
                      return;
                    }
                    addDep.mutate({
                      taskId: task.id,
                      dependsOnId: e.target.value,
                      projectId,
                    });
                  }}
                  className={inputCls}
                >
                  <option value="">+ Añadir dependencia…</option>
                  {available.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                No podrá pasar a «en progreso» mientras una dependencia siga abierta.
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/50">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => {
                setRequiresApproval(e.target.checked);
              }}
              className="size-4 accent-brand-gold"
            />
            <span className="text-slate-600 dark:text-slate-300">
              Requiere aprobación del líder o supervisor para darse por completada
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </p>
          )}

          <div className="flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={updateTask.isPending || title.trim().length < 2}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-brand-gold-dark disabled:opacity-40"
            >
              {updateTask.isPending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
