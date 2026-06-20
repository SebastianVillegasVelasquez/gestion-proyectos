import type { CreateTaskPayload, TaskPriority } from "@/features/projects/types/api.types";

export interface TaskFormState {
  title: string;
  description: string;
  // La tarea cuelga de un nodo del árbol de trabajo (cualquier nivel).
  workItemId: string;
  assigneeId: string;
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

/** Construye el payload de creación a partir del formulario (puro y testeable). */
export function buildTaskPayload(form: TaskFormState): CreateTaskPayload {
  const payload: CreateTaskPayload = {
    title: form.title.trim(),
    description: nullIfEmpty(form.description),
    priority: form.priority,
    assignee_id: nullIfEmpty(form.assigneeId),
    depends_on_id: nullIfEmpty(form.dependsOnId),
    work_item_id: form.workItemId,
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
  if (!form.workItemId) {
    return "Selecciona el nodo del proyecto";
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
