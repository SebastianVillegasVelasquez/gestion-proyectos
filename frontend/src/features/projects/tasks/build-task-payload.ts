import type { CreateTaskPayload, TaskPriority } from "@/features/projects/types/api.types";

// A quién se le asigna la tarea. Excluyente: o una persona, o un equipo, o nadie
// (por ahora). Si va a un equipo, es el líder quien reparte subtareas.
export type AssignmentMode = "none" | "person" | "team";

export interface TaskFormState {
  title: string;
  description: string;
  // La tarea cuelga de un elemento del árbol de trabajo (cualquier nivel).
  workItemId: string;
  assignmentMode: AssignmentMode;
  assigneeId: string;
  // Equipo al que se delega la tarea (opcional).
  teamId: string;
  dependsOnId: string;
  priority: TaskPriority;
  startDate: string;
  dateMode: "end" | "duration";
  dueDate: string;
  durationDays: string;
  // false (por defecto): el responsable entrega y queda completada directo.
  // true: la aprueba o devuelve el líder/supervisor del proyecto.
  requiresApproval: boolean;
}

export function emptyTaskForm(workItemId = "", title = ""): TaskFormState {
  return {
    title,
    description: "",
    workItemId,
    assignmentMode: "none",
    assigneeId: "",
    teamId: "",
    dependsOnId: "",
    priority: "media",
    startDate: "",
    dateMode: "duration",
    dueDate: "",
    durationDays: "",
    requiresApproval: false,
  };
}

function nullIfEmpty(value: string): string | null {
  return value.trim() === "" ? null : value;
}

/** Construye el payload de creación a partir del formulario (puro y testeable).
 * `projectId` ancla la tarea al proyecto cuando se crea suelta (sin elemento). */
export function buildTaskPayload(form: TaskFormState, projectId: string): CreateTaskPayload {
  const workItemId = nullIfEmpty(form.workItemId);
  // Exclusividad persona/equipo: solo se envía el que corresponde al modo, el
  // otro va en null aunque el formulario tuviera un valor viejo seleccionado.
  const payload: CreateTaskPayload = {
    title: form.title.trim(),
    description: nullIfEmpty(form.description),
    priority: form.priority,
    assignee_id: form.assignmentMode === "person" ? nullIfEmpty(form.assigneeId) : null,
    team_id: form.assignmentMode === "team" ? nullIfEmpty(form.teamId) : null,
    depends_on_id: nullIfEmpty(form.dependsOnId),
    work_item_id: workItemId,
    project_id: workItemId ? undefined : projectId,
    // Las fechas son opcionales: la tarea puede quedar como borrador y
    // planificarse después. Solo enviamos lo que el usuario haya completado.
    start_date: nullIfEmpty(form.startDate),
    requires_approval: form.requiresApproval,
  };

  // La "duración en días" es también la estimación de esfuerzo de la tarea: se
  // guarda como `estimated_days` aunque no haya fecha de inicio, así se ve y se
  // edita después (antes se perdía si no dabas fecha).
  if (
    form.dateMode === "duration" &&
    form.durationDays.trim() !== "" &&
    Number(form.durationDays) > 0
  ) {
    payload.estimated_days = form.durationDays.trim();
  }

  if (form.startDate) {
    if (form.dateMode === "duration" && form.durationDays.trim() !== "") {
      // Con fecha de inicio, el backend además deriva el fin de esta duración.
      payload.duration_days = Number(form.durationDays);
    } else if (form.dateMode === "end") {
      payload.due_date = nullIfEmpty(form.dueDate);
    }
  }

  return payload;
}

/** Valida lo mínimo en el cliente antes de enviar (UX); el backend revalida. */
export function validateTaskForm(form: TaskFormState): string | null {
  if (form.title.trim().length < 2) {
    return "El título debe tener al menos 2 caracteres";
  }
  // La duración/estimado en días se valida siempre que se escriba (vale con o
  // sin fecha de inicio); la coherencia inicio/fin, solo si hay inicio.
  if (
    form.dateMode === "duration" &&
    form.durationDays.trim() !== "" &&
    Number(form.durationDays) <= 0
  ) {
    return "La duración debe ser mayor a 0 días";
  }
  if (form.startDate && form.dateMode === "end" && form.dueDate && form.dueDate < form.startDate) {
    return "La fecha de fin no puede ser anterior al inicio";
  }
  return null;
}
