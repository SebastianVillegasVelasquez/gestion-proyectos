import type { CreateTaskPayload, TaskPriority } from "@/features/projects/types/api.types";

export interface TaskFormState {
  title: string;
  description: string;
  // La tarea cuelga de un elemento del árbol de trabajo (cualquier nivel).
  workItemId: string;
  assigneeId: string;
  // Equipo al que se delega la tarea (opcional).
  teamId: string;
  dependsOnId: string;
  priority: TaskPriority;
  startDate: string;
  dateMode: "end" | "duration";
  dueDate: string;
  durationDays: string;
}

export function emptyTaskForm(workItemId = ""): TaskFormState {
  return {
    title: "",
    description: "",
    workItemId,
    assigneeId: "",
    teamId: "",
    dependsOnId: "",
    priority: "media",
    startDate: "",
    dateMode: "duration",
    dueDate: "",
    durationDays: "",
  };
}

function nullIfEmpty(value: string): string | null {
  return value.trim() === "" ? null : value;
}

/** Construye el payload de creación a partir del formulario (puro y testeable).
 * `projectId` ancla la tarea al proyecto cuando se crea suelta (sin elemento). */
export function buildTaskPayload(form: TaskFormState, projectId: string): CreateTaskPayload {
  const workItemId = nullIfEmpty(form.workItemId);
  const payload: CreateTaskPayload = {
    title: form.title.trim(),
    description: nullIfEmpty(form.description),
    priority: form.priority,
    assignee_id: nullIfEmpty(form.assigneeId),
    team_id: nullIfEmpty(form.teamId),
    depends_on_id: nullIfEmpty(form.dependsOnId),
    work_item_id: workItemId,
    project_id: workItemId ? undefined : projectId,
    start_date: form.startDate,
  };

  if (form.dateMode === "duration") {
    payload.duration_days = Number(form.durationDays);
  } else {
    payload.due_date = form.dueDate;
  }

  return payload;
}

/** Valida lo mínimo en el cliente antes de enviar (UX); el backend revalida. */
export function validateTaskForm(form: TaskFormState): string | null {
  if (form.title.trim().length < 2) {
    return "El título debe tener al menos 2 caracteres";
  }
  if (!form.startDate) {
    return "Indica la fecha de inicio";
  }
  if (form.dateMode === "duration" && Number(form.durationDays) <= 0) {
    return "La duración debe ser mayor a 0 días";
  }
  if (form.dateMode === "end" && !form.dueDate) {
    return "Indica la fecha de fin";
  }
  return null;
}
