import { useMemo, useState } from "react";
import { X, ListPlus, FolderTree, Pencil } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useCreateTask, useUpdateTask } from "../hooks/use-tasks";
import { useWorkTree, useNodeTypes } from "../hooks/use-structure";
import { useDirectory } from "../hooks/use-members";
import { useTeams, useTeamMembers } from "../hooks/use-teams";
import { fullName } from "../utils/task-assignment";
import { TASK_PRIORITY_LABELS, USER_POSITION_LABELS, USER_POSITIONS } from "../types/labels";
import type { Task, TaskPriority, UserPosition } from "../types/api.types";
import { workItemPath } from "../utils/flatten-work-tree";
import { TaskDurationBadge } from "../components/TaskDurationBadge";
import { WorkItemPickerModal } from "./WorkItemPickerModal";
import {
  buildTaskPayload,
  buildTaskUpdatePayload,
  emptyTaskForm,
  taskToForm,
  validateTaskForm,
  WORK_ITEM_DEP_PREFIX,
  type TaskFormState,
} from "./build-task-payload";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-gold/25";

const PRIORITIES: TaskPriority[] = ["no_definida", "baja", "media", "alta", "urgente"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export function CreateTaskModal({
  projectId,
  tasks,
  initialWorkItemId,
  initialTitle,
  editTask,
  onClose,
}: {
  projectId: string;
  tasks: Task[];
  /** Preselecciona el elemento (p. ej. al crear desde un nodo de la estructura). */
  initialWorkItemId?: string;
  /** Título de partida. Al crear la tarea desde un elemento se precarga con su
   * nombre: normalmente la tarea ES ese elemento ("Video 1", "Guion"), y quien
   * la crea solo tiene que asignarla. Sigue siendo editable. */
  initialTitle?: string;
  /** Si llega, el modal EDITA esa tarea en vez de crear una (mismos campos y
   * estilo). Las dependencias se editan aparte (en la ficha de la tarea). */
  editTask?: Task;
  onClose: () => void;
}) {
  const isEdit = editTask != null;
  const treeQuery = useWorkTree(projectId);
  const nodeTypesQuery = useNodeTypes(projectId);
  const createTask = useCreateTask(projectId);
  const updateTask = useUpdateTask(projectId);
  const mutation = isEdit ? updateTask : createTask;
  const [pickingLocation, setPickingLocation] = useState(false);

  const [form, setForm] = useState<TaskFormState>(() =>
    editTask ? taskToForm(editTask) : emptyTaskForm(initialWorkItemId, initialTitle),
  );
  const [position, setPosition] = useState<UserPosition | "">("");
  const [clientError, setClientError] = useState<string | null>(null);

  const directoryQuery = useDirectory(position || undefined);
  const teamsQuery = useTeams(projectId);
  const teams = teamsQuery.data?.items ?? [];
  // Integrantes del equipo elegido, para asignar la tarea directo a uno de ellos.
  const teamMembersQuery = useTeamMembers(
    projectId,
    form.assignmentMode === "member" && form.teamId ? form.teamId : undefined,
  );

  const set = <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Ruta legible del elemento elegido ("Curso / Módulo 2 / Unidad 3"): es lo
  // que se enseña en el formulario, ya que el árbol vive dentro del modal.
  const selectedPath = useMemo(
    () => workItemPath(treeQuery.data ?? [], form.workItemId),
    [treeQuery.data, form.workItemId],
  );

  // Nombre "hoja" del elemento elegido ("Guion", "Video 1"). Muchas veces la
  // tarea ES ese elemento y no hace falta inventar un título: se ofrece como
  // un atajo de un clic, sin forzarlo (el campo sigue siendo libre).
  const selectedElementName = useMemo(() => {
    const path = workItemPath(treeQuery.data ?? [], form.workItemId || null);
    return path ? (path.split(" / ").pop() ?? null) : null;
  }, [treeQuery.data, form.workItemId]);

  // Elementos que se comportan como dependencia de terceros: una tarea puede
  // depender de ellos (además de depender de otra tarea).
  const depWorkItems = useMemo(() => {
    const depTypeIds = new Set(
      (nodeTypesQuery.data ?? []).filter((t) => t.es_dependencia_externa).map((t) => t.id),
    );
    if (depTypeIds.size === 0) {
      return [] as { id: string; nombre: string }[];
    }
    const out: { id: string; nombre: string }[] = [];
    const roots = treeQuery.data ?? [];
    const walk = (nodes: typeof roots) => {
      nodes.forEach((n) => {
        if (depTypeIds.has(n.tipo_id)) {
          out.push({ id: n.id, nombre: n.nombre });
        }
        walk(n.children);
      });
    };
    walk(roots);
    return out;
  }, [nodeTypesQuery.data, treeQuery.data]);

  const handleSubmit = () => {
    const error = validateTaskForm(form);
    if (error) {
      setClientError(error);
      return;
    }
    setClientError(null);
    if (isEdit) {
      const payload = buildTaskUpdatePayload(form, editTask);
      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }
      updateTask.mutate({ taskId: editTask.id, payload }, { onSuccess: onClose });
      return;
    }
    createTask.mutate(buildTaskPayload(form, projectId), { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-50">
            {isEdit ? (
              <>
                <Pencil className="size-4 text-brand-teal" /> Editar tarea
              </>
            ) : (
              <>
                <ListPlus className="size-4 text-brand-teal" /> Nueva tarea
              </>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
          <Field label="Título *">
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => {
                set("title", e.target.value);
              }}
              placeholder="Diseñar unidad 1"
            />
            {selectedElementName && selectedElementName !== form.title.trim() && (
              <button
                type="button"
                onClick={() => {
                  set("title", selectedElementName);
                }}
                className="mt-1 self-start rounded-md border border-brand-teal/30 bg-brand-teal/10 px-2 py-1 text-[11px] font-medium text-brand-teal-dark transition hover:bg-brand-teal/20 dark:text-brand-teal"
              >
                Usar «{selectedElementName}» como título
              </button>
            )}
          </Field>
          <Field label="Descripción">
            <textarea
              className={inputCls}
              rows={2}
              value={form.description}
              onChange={(e) => {
                set("description", e.target.value);
              }}
            />
          </Field>

          {/* Nodo del árbol de trabajo al que cuelga la tarea (opcional: la
              tarea puede crearse suelta y adjuntarse después). */}
          {/* Un botón que abre el árbol completo, no un desplegable: con cuatro
              niveles de estructura, elegir a ciegas en una lista aplanada es
              justo lo que hacía fallar la ubicación. */}
          <Field label="Ubicación en la estructura (opcional)">
            <button
              type="button"
              onClick={() => {
                setPickingLocation(true);
              }}
              className={`${inputCls} flex items-center justify-between gap-2 text-left`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <FolderTree className="size-4 shrink-0 text-brand-teal" />
                <span className="truncate">
                  {selectedPath ?? "Sin asignar (tarea independiente)"}
                </span>
              </span>
              <span className="shrink-0 text-xs font-medium text-brand-teal">Elegir</span>
            </button>
          </Field>

          {/* Asignación. "Nadie" = suelta; "persona" = individual; "equipo" = va
              a su bolsa y el líder reparte; "integrante" = directo a alguien del
              equipo, sin que el líder tenga que repartirla. */}
          <Field label="Asignar a">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 sm:grid-cols-4 dark:border-slate-700 dark:bg-slate-800/50">
              {(
                [
                  ["none", "Nadie aún"],
                  ["person", "Una persona"],
                  ["team", "Un equipo"],
                  ["member", "Integrante"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    set("assignmentMode", mode);
                    // Al cambiar de modo, limpiamos la selección del otro para no
                    // arrastrar valores incoherentes.
                    set("assigneeId", "");
                    set("teamId", "");
                    setPosition("");
                  }}
                  aria-pressed={form.assignmentMode === mode}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                    form.assignmentMode === mode
                      ? "bg-white text-brand-teal-dark shadow-sm dark:bg-slate-900 dark:text-brand-teal"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {/* Responsable individual: filtro por cargo + persona */}
          {form.assignmentMode === "person" && (
            <Field label="Responsable">
              <div className="flex gap-2">
                <select
                  className={`${inputCls} w-1/2`}
                  value={position}
                  onChange={(e) => {
                    setPosition(e.target.value as UserPosition | "");
                    set("assigneeId", "");
                  }}
                >
                  <option value="">Todos los cargos</option>
                  {USER_POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {USER_POSITION_LABELS[p]}
                    </option>
                  ))}
                </select>
                <select
                  className={`${inputCls} w-1/2`}
                  value={form.assigneeId}
                  onChange={(e) => {
                    set("assigneeId", e.target.value);
                  }}
                >
                  <option value="">Sin asignar</option>
                  {directoryQuery.data?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          )}

          {/* Delegar a un equipo: el líder repartirá subtareas dentro del equipo */}
          {form.assignmentMode === "team" && (
            <Field label="Equipo responsable">
              <select
                className={inputCls}
                value={form.teamId}
                onChange={(e) => {
                  set("teamId", e.target.value);
                }}
              >
                <option value="">Selecciona un equipo…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {teams.length === 0 && (
                <span className="text-[11px] text-slate-400">
                  Este proyecto aún no tiene equipos. Créalos en la sección «Equipos de trabajo».
                </span>
              )}
            </Field>
          )}

          {/* Directo a un integrante: se elige el equipo y, dentro, la persona.
              La tarea queda como "del equipo" pero ya asignada. */}
          {form.assignmentMode === "member" && (
            <Field label="Equipo e integrante">
              <div className="flex gap-2">
                <select
                  className={`${inputCls} w-1/2`}
                  value={form.teamId}
                  onChange={(e) => {
                    set("teamId", e.target.value);
                    set("assigneeId", "");
                  }}
                >
                  <option value="">Equipo…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  className={`${inputCls} w-1/2`}
                  value={form.assigneeId}
                  disabled={!form.teamId || teamMembersQuery.isLoading}
                  onChange={(e) => {
                    set("assigneeId", e.target.value);
                  }}
                >
                  <option value="">Integrante…</option>
                  {(teamMembersQuery.data ?? []).map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {fullName(m)}
                    </option>
                  ))}
                </select>
              </div>
              {teams.length === 0 && (
                <span className="text-[11px] text-slate-400">
                  Este proyecto aún no tiene equipos. Créalos en la sección «Equipos de trabajo».
                </span>
              )}
            </Field>
          )}

          {/* Aprobación: desactivada por defecto (entrega directo, sin
              revisión). Activarla exige que el líder/supervisor del proyecto
              apruebe o devuelva la entrega antes de darla por completada. */}
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/50">
            <input
              type="checkbox"
              checked={form.requiresApproval}
              onChange={(e) => {
                set("requiresApproval", e.target.checked);
              }}
              className="size-4 accent-brand-gold"
            />
            <span className="text-slate-600 dark:text-slate-300">
              Requiere aprobación del líder o supervisor para darse por completada
            </span>
          </label>

          {/* Dependencia: solo al CREAR. Al editar, las dependencias se
              gestionan en la ficha de la tarea (pueden ser varias). */}
          {isEdit ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-[11px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
              Las dependencias de esta tarea se editan en su ficha.
            </p>
          ) : (
            <Field label="Depende de (opcional)">
              <select
                className={inputCls}
                value={form.dependsOnId}
                onChange={(e) => {
                  set("dependsOnId", e.target.value);
                }}
              >
                <option value="">Sin dependencia</option>
                {depWorkItems.length > 0 && (
                  <optgroup label="Elementos (actividad de terceros)">
                    {depWorkItems.map((w) => (
                      <option key={w.id} value={`${WORK_ITEM_DEP_PREFIX}${w.id}`}>
                        {w.nombre}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Tareas">
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </optgroup>
              </select>
            </Field>
          )}

          {/* Prioridad */}
          <Field label="Prioridad">
            <select
              className={inputCls}
              value={form.priority}
              onChange={(e) => {
                set("priority", e.target.value as TaskPriority);
              }}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>

          {/* Fechas: inicio + (fin o duración). Opcionales: la tarea puede
              crearse sin planificar y ajustarse después. La duración en días
              queda además como estimación de esfuerzo aunque no haya fecha. */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inicio (opcional)">
              <input
                type="date"
                className={inputCls}
                value={form.startDate}
                onChange={(e) => {
                  set("startDate", e.target.value);
                }}
              />
            </Field>
            <Field label={form.dateMode === "duration" ? "Duración / estimado (días)" : "Fin"}>
              <div className="flex items-center gap-1">
                {form.dateMode === "duration" ? (
                  <input
                    type="number"
                    min={1}
                    step="0.25"
                    className={inputCls}
                    value={form.durationDays}
                    onChange={(e) => {
                      set("durationDays", e.target.value);
                    }}
                  />
                ) : (
                  <input
                    type="date"
                    className={inputCls}
                    value={form.dueDate}
                    onChange={(e) => {
                      set("dueDate", e.target.value);
                    }}
                  />
                )}
                {form.dateMode === "duration" && <TaskDurationBadge days={form.durationDays} />}
                <button
                  type="button"
                  title="Cambiar entre duración y fecha de fin"
                  onClick={() => {
                    set("dateMode", form.dateMode === "duration" ? "end" : "duration");
                  }}
                  className="shrink-0 rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {form.dateMode === "duration" ? "📅" : "⏱"}
                </button>
              </div>
            </Field>
          </div>

          {(clientError ?? mutation.isError) && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {clientError ??
                getErrorMessage(
                  mutation.error,
                  isEdit ? "No se pudo guardar la tarea" : "No se pudo crear la tarea",
                )}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending
              ? isEdit
                ? "Guardando…"
                : "Creando…"
              : isEdit
                ? "Guardar cambios"
                : "Crear tarea"}
          </button>
        </div>
      </div>

      {pickingLocation && (
        <WorkItemPickerModal
          tree={treeQuery.data ?? []}
          nodeTypes={nodeTypesQuery.data ?? []}
          value={form.workItemId || null}
          onSelect={(workItemId) => {
            set("workItemId", workItemId ?? "");
          }}
          onClose={() => {
            setPickingLocation(false);
          }}
        />
      )}
    </div>
  );
}
