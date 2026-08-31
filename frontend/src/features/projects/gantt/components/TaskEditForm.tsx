import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_LABELS } from "../../types/labels";
import type {
  ProjectMember,
  Task,
  TaskPriority,
  Team,
  UpdateTaskPayload,
} from "../../types/api.types";
import { useUpdateTask } from "../../hooks/use-tasks";
import { getErrorMessage } from "@/utils/get-error-message";

const PRIORITIES = Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[];

type Assignment = "none" | "person" | "team";

function initialAssignment(task: Task): Assignment {
  if (task.assignee_id) {
    return "person";
  }
  if (task.team_id) {
    return "team";
  }
  return "none";
}

/**
 * Formulario de edición de una tarea (acción de administración). Permite cambiar
 * título, descripción, prioridad, fechas y REASIGNAR: la tarea va a una persona o
 * a un equipo, nunca a ambos (regla persona-XOR-equipo del backend). Solo envía
 * los campos que cambiaron; al reasignar, pone en null el otro destino para que
 * el backend lo limpie.
 */
export function TaskEditForm({
  projectId,
  task,
  members,
  teams,
  onDone,
}: {
  projectId: string;
  task: Task;
  members: ProjectMember[];
  teams: Team[];
  onDone: () => void;
}) {
  const updateTask = useUpdateTask(projectId);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [startDate, setStartDate] = useState(task.start_date ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [assignment, setAssignment] = useState<Assignment>(initialAssignment(task));
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? "");
  const [teamId, setTeamId] = useState(task.team_id ?? "");
  const [estimatedHours, setEstimatedHours] = useState(task.estimated_hours ?? "");
  const [requiresApproval, setRequiresApproval] = useState(task.requires_approval);

  const save = () => {
    const payload: UpdateTaskPayload = {};
    const cleanTitle = title.trim();
    if (cleanTitle && cleanTitle !== task.title) {
      payload.title = cleanTitle;
    }
    if ((description.trim() || null) !== (task.description ?? null)) {
      payload.description = description.trim() || null;
    }
    if (priority !== task.priority) {
      payload.priority = priority;
    }
    if ((startDate || null) !== (task.start_date ?? null)) {
      // `null`, no `undefined`: vaciar la fecha debe llegar al backend.
      payload.start_date = startDate || null;
    }
    if ((dueDate || null) !== (task.due_date ?? null)) {
      payload.due_date = dueDate || null;
    }
    if ((estimatedHours || null) !== (task.estimated_hours ?? null)) {
      // Vacío = sin estimar (null), no cero: son cosas distintas.
      payload.estimated_hours = estimatedHours || null;
    }
    if (requiresApproval !== task.requires_approval) {
      payload.requires_approval = requiresApproval;
    }

    // Reasignación: persona XOR equipo. Se envía el otro campo en null para
    // limpiarlo cuando cambia el tipo de destino.
    if (assignment === "person") {
      if ((assigneeId || null) !== (task.assignee_id ?? null) || task.team_id) {
        payload.assignee_id = assigneeId || null;
        payload.team_id = null;
      }
    } else if (assignment === "team") {
      if ((teamId || null) !== (task.team_id ?? null) || task.assignee_id) {
        payload.team_id = teamId || null;
        payload.assignee_id = null;
      }
    } else if (task.assignee_id || task.team_id) {
      // "Sin asignar": limpia ambos.
      payload.assignee_id = null;
      payload.team_id = null;
    }

    if (Object.keys(payload).length === 0) {
      onDone();
      return;
    }

    updateTask.mutate({ taskId: task.id, payload }, { onSuccess: onDone });
  };

  const fieldClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const labelClass = "mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400";

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div>
        <label className={labelClass} htmlFor="task-title">
          Título
        </label>
        <input
          id="task-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="task-desc">
          Descripción
        </label>
        <textarea
          id="task-desc"
          value={description}
          rows={3}
          onChange={(e) => {
            setDescription(e.target.value);
          }}
          className={cn(fieldClass, "resize-y")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="task-priority">
            Prioridad
          </label>
          <select
            id="task-priority"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value as TaskPriority);
            }}
            className={fieldClass}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="task-estimated">
            Horas estimadas
          </label>
          <input
            id="task-estimated"
            type="number"
            step="0.25"
            min="0"
            placeholder="Sin estimar"
            value={estimatedHours}
            onChange={(e) => {
              setEstimatedHours(e.target.value);
            }}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="task-start">
            Inicio
          </label>
          <input
            id="task-start"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
            }}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="task-due">
            Entrega
          </label>
          <input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
            }}
            className={fieldClass}
          />
        </div>
      </div>

      {/* Reasignación: persona / equipo / sin asignar (excluyentes). */}
      <div>
        <span className={labelClass}>Responsable</span>
        <div className="mb-2 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
          {(
            [
              { id: "person", label: "Persona" },
              { id: "team", label: "Equipo" },
              { id: "none", label: "Sin asignar" },
            ] as { id: Assignment; label: string }[]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setAssignment(opt.id);
              }}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                assignment === opt.id
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {assignment === "person" && (
          <select
            value={assigneeId}
            onChange={(e) => {
              setAssigneeId(e.target.value);
            }}
            aria-label="Persona responsable"
            className={fieldClass}
          >
            <option value="">Selecciona a una persona…</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name} {m.last_name}
              </option>
            ))}
          </select>
        )}

        {assignment === "team" && (
          <select
            value={teamId}
            onChange={(e) => {
              setTeamId(e.target.value);
            }}
            aria-label="Equipo responsable"
            className={fieldClass}
          >
            <option value="">Selecciona un equipo…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

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

      {updateTask.isError && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {getErrorMessage(updateTask.error, "No se pudo guardar la tarea")}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={updateTask.isPending || !title.trim()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-50"
        >
          <Check className="size-4" /> Guardar cambios
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={updateTask.isPending}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <X className="size-4" /> Cancelar
        </button>
      </div>
    </div>
  );
}
