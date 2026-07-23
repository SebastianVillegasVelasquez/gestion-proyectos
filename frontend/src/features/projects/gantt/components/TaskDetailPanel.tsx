import { useMemo } from "react";
import { X, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS, TASK_PRIORITY_LABELS } from "../../types/labels";
import type { Task, TaskStatus } from "../../types/api.types";
import { useChangeTaskStatus, useProjectTasks, useTaskDependencies } from "../../hooks/use-tasks";
import { useProjectMembers } from "../../hooks/use-members";
import { useTeams } from "../../hooks/use-teams";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getErrorMessage } from "@/utils/get-error-message";

// Transiciones permitidas para el responsable (entrega) y para el líder (revisión).
// Se derivan del estado actual y del rol del usuario en este proyecto.
type ActorRole = "assignee" | "leader" | "none";

const ASSIGNEE_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pendiente_por_iniciar: ["en_progreso"],
  en_progreso: ["en_revision"],
  en_revision: [], // Ya está en manos del líder.
  devuelta: ["en_progreso"], // Retomar tras observaciones.
  completada: [],
  cancelada: [],
};

const LEADER_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pendiente_por_iniciar: [],
  en_progreso: [],
  en_revision: ["completada", "devuelta"], // Aprobar o devolver.
  devuelta: [],
  completada: [],
  cancelada: [],
};

// Textos "acción" para los botones (más claros que el nombre plano del estado).
const ACTION_LABEL: Partial<Record<TaskStatus, string>> = {
  en_progreso: "Iniciar / retomar",
  en_revision: "Entregar para revisión",
  completada: "Aprobar entrega",
  devuelta: "Devolver con observaciones",
};

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
  const depsQuery = useTaskDependencies(task.id);
  const tasksQuery = useProjectTasks(projectId);
  const membersQuery = useProjectMembers(projectId);
  const teamsQuery = useTeams();
  const { user } = useAuth();

  const teamName = useMemo(() => {
    if (!task.team_id) {
      return null;
    }
    return (teamsQuery.data?.items ?? []).find((t) => t.id === task.team_id)?.name ?? null;
  }, [task.team_id, teamsQuery.data]);

  const titleById = useMemo(() => {
    const map = new Map<string, string>();
    (tasksQuery.data ?? []).forEach((t) => map.set(t.id, t.title));
    return map;
  }, [tasksQuery.data]);

  // Rol del usuario dentro del proyecto: líder (coordinador/supervisor),
  // responsable de esta tarea, o ninguno.
  const actorRole: ActorRole = useMemo(() => {
    if (!user) {
      return "none";
    }
    if (task.assignee_id === user.id) {
      return "assignee";
    }
    const member = (membersQuery.data ?? []).find((m) => m.user_id === user.id);
    if (member?.project_role === "coordinador" || member?.project_role === "supervisor") {
      return "leader";
    }
    return "none";
  }, [user, task.assignee_id, membersQuery.data]);

  const allowed =
    actorRole === "assignee"
      ? ASSIGNEE_TRANSITIONS[task.status]
      : actorRole === "leader"
        ? LEADER_TRANSITIONS[task.status]
        : [];

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
          {teamName && (
            <div className="col-span-2">
              <dt className="text-xs text-slate-400">Equipo delegado</dt>
              <dd className="mt-0.5 w-fit rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                {teamName}
              </dd>
            </div>
          )}
        </dl>

        {/* Acciones de flujo — sólo visibles para responsable o líder. El admin
            no puede pisar el estado sin ver el avance real. */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {actorRole === "assignee"
              ? "Tu tarea"
              : actorRole === "leader"
                ? "Revisión de la entrega"
                : "Estado"}
          </p>

          {allowed.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {allowed.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={changeStatus.isPending}
                  onClick={() => {
                    changeStatus.mutate({ taskId: task.id, status });
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-60",
                    status === "completada"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                      : status === "devuelta"
                        ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
                        : "border-brand-blue/40 bg-brand-blue/10 text-brand-blue-dark hover:bg-brand-blue/20 dark:text-brand-blue",
                  )}
                >
                  {ACTION_LABEL[status] ?? TASK_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
              <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
              <p>
                {actorRole === "none"
                  ? "El cambio de estado lo hacen el responsable (al entregar) y el líder (al aprobar o devolver). Un administrador no puede pisar el estado sin ver el avance."
                  : task.status === "en_revision" && actorRole === "assignee"
                    ? "Enviaste la entrega. Espera a que el líder la revise."
                    : task.status === "completada"
                      ? "Esta tarea ya fue aprobada. No hay más acciones sobre ella."
                      : "Sin acciones disponibles en este estado."}
              </p>
            </div>
          )}

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
