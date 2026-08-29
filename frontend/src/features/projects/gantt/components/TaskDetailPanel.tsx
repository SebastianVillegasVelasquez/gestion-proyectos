import { useMemo, useState } from "react";
import { X, Info, FolderTree, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS, TASK_PRIORITY_LABELS } from "../../types/labels";
import type { Task, TaskStatus } from "../../types/api.types";
import { TaskEditForm } from "./TaskEditForm";
import { TaskEffortPanel } from "../../tasks/TaskEffortPanel";
import { TaskComments } from "../../tasks/TaskComments";
import {
  useAttachTask,
  useChangeTaskStatus,
  useDetachTask,
  useProjectTasks,
} from "../../hooks/use-tasks";
import { useProjectMembers } from "../../hooks/use-members";
import { useTeams } from "../../hooks/use-teams";
import { useWorkTree, useNodeTypes } from "../../hooks/use-structure";
import { workItemPath } from "../../utils/flatten-work-tree";
import { WorkItemPickerModal } from "../../tasks/WorkItemPickerModal";
import { TaskDependencyEditor } from "../../components/TaskDependencyEditor";
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

// Todos los estados, para el override de gestión (admin/super_admin/developer).
const ALL_STATUSES = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];

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
  const tasksQuery = useProjectTasks(projectId);
  const membersQuery = useProjectMembers(projectId);
  const teamsQuery = useTeams(projectId);
  const treeQuery = useWorkTree(projectId);
  const nodeTypesQuery = useNodeTypes(projectId);
  const attachTask = useAttachTask(projectId);
  const detachTask = useDetachTask(projectId);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [editing, setEditing] = useState(false);
  const { user } = useAuth();

  const currentNodePath = useMemo(
    () => workItemPath(treeQuery.data ?? [], task.work_item_id),
    [treeQuery.data, task.work_item_id],
  );

  const assigneeName = useMemo(() => {
    if (!task.assignee_id) {
      return null;
    }
    const member = (membersQuery.data ?? []).find((m) => m.user_id === task.assignee_id);
    return member ? `${member.name} ${member.last_name}` : null;
  }, [task.assignee_id, membersQuery.data]);

  const teamName = useMemo(() => {
    if (!task.team_id) {
      return null;
    }
    return (teamsQuery.data?.items ?? []).find((t) => t.id === task.team_id)?.name ?? null;
  }, [task.team_id, teamsQuery.data]);

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

  // Roles de gestión pueden fijar cualquier estado (corrección administrativa),
  // en paralelo al flujo normal de responsable/líder. El backend lo autoriza.
  const isManagement =
    user?.role === "developer" || user?.role === "super_admin" || user?.role === "admin";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Cerrar" className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{task.title}</h2>
          <div className="flex shrink-0 items-center gap-1">
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                }}
                aria-label="Editar tarea"
                title="Editar tarea"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <Pencil className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {editing ? (
          <TaskEditForm
            projectId={projectId}
            task={task}
            members={membersQuery.data ?? []}
            teams={teamsQuery.data?.items ?? []}
            onDone={() => {
              setEditing(false);
            }}
          />
        ) : (
          <>
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
              <div className="col-span-2">
                <dt className="text-xs text-slate-400">Responsable</dt>
                <dd className="text-slate-700 dark:text-slate-200">
                  {assigneeName ?? <span className="italic text-slate-400">Sin asignar</span>}
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

            {/* Esfuerzo: lo estimado frente a lo dedicado, y los apuntes de horas. */}
            <div className="mt-5">
              <TaskEffortPanel projectId={projectId} taskId={task.id} />
            </div>

            {/* Conversación: por qué se decidió lo que se decidió, junto a la tarea. */}
            <div className="mt-5">
              <TaskComments taskId={task.id} />
            </div>

            {/* Ubicación en la estructura: un solo control para las tres cosas
                (adjuntar, cambiar y quitar), porque para quien planifica son la
                misma decisión — "¿de dónde cuelga esto?". El árbol se elige en
                un modal grande y no en un desplegable: con cuatro niveles, una
                lista aplanada no deja ver el contexto. */}
            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <FolderTree className="size-3.5" /> Ubicación en la estructura
              </p>
              <button
                type="button"
                disabled={attachTask.isPending || detachTask.isPending}
                onClick={() => {
                  setPickingLocation(true);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm transition hover:border-brand-teal dark:border-slate-700 dark:bg-slate-800/50"
              >
                <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">
                  {currentNodePath ?? "Sin ubicación (tarea independiente)"}
                </span>
                <span className="shrink-0 text-xs font-medium text-brand-teal">
                  {currentNodePath ? "Cambiar" : "Ubicar"}
                </span>
              </button>
              {(attachTask.isError || detachTask.isError) && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                  {getErrorMessage(
                    attachTask.error ?? detachTask.error,
                    "No se pudo actualizar la ubicación",
                  )}
                </p>
              )}
            </div>

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

              {isManagement && (
                <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-2.5 dark:border-slate-700">
                  <label
                    htmlFor="mgmt-status"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                  >
                    Cambiar estado (gestión)
                  </label>
                  <select
                    id="mgmt-status"
                    value={task.status}
                    disabled={changeStatus.isPending}
                    onChange={(e) => {
                      changeStatus.mutate({
                        taskId: task.id,
                        status: e.target.value as TaskStatus,
                      });
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {TASK_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Como administrador puedes corregir el estado directamente, sin pasar por el
                    flujo.
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
              <TaskDependencyEditor
                taskId={task.id}
                projectId={projectId}
                canEdit={isManagement}
                allTasks={tasksQuery.data ?? []}
              />
            </div>
          </>
        )}
      </aside>

      {pickingLocation && (
        <WorkItemPickerModal
          tree={treeQuery.data ?? []}
          nodeTypes={nodeTypesQuery.data ?? []}
          value={task.work_item_id}
          onSelect={(workItemId) => {
            // Elegir "sin ubicación" es quitarla; elegir un elemento la adjunta
            // o la mueve. Un mismo control, dos endpoints distintos.
            if (workItemId) {
              attachTask.mutate({ taskId: task.id, workItemId });
            } else if (task.work_item_id) {
              detachTask.mutate(task.id);
            }
          }}
          onClose={() => {
            setPickingLocation(false);
          }}
        />
      )}
    </div>
  );
}
