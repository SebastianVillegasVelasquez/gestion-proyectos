import type {
  CreateTaskPayload,
  Task,
  TaskPriority,
  UpdateTaskPayload,
} from "@/features/projects/types/api.types";

// A quién se le asigna la tarea:
//  - "none"   sin asignar (suelta, disponible para asignar luego)
//  - "person" a una persona (individual, no cuenta como trabajo de equipo)
//  - "team"   a un equipo (cae en su bolsa; el líder reparte)
//  - "member" directamente a un integrante de un equipo: la tarea es del equipo
//             (team_id) pero ya con responsable (assignee_id), sin que el líder
//             tenga que repartirla.
export type AssignmentMode = "none" | "person" | "team" | "member";

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
/** El selector de "Depende de" mezcla tareas y elementos del árbol; los
 * elementos van prefijados con `wi:` para distinguirlos en el payload. */
export const WORK_ITEM_DEP_PREFIX = "wi:";

export function buildTaskPayload(form: TaskFormState, projectId: string): CreateTaskPayload {
  const workItemId = nullIfEmpty(form.workItemId);
  const dep = nullIfEmpty(form.dependsOnId);
  const dependsOnWorkItem = dep?.startsWith(WORK_ITEM_DEP_PREFIX)
    ? dep.slice(WORK_ITEM_DEP_PREFIX.length)
    : null;
  // Solo se envía lo que corresponde al modo; lo demás va en null aunque el
  // formulario arrastrara un valor viejo. "member" es el único que manda ambos.
  const withPerson = form.assignmentMode === "person" || form.assignmentMode === "member";
  const withTeam = form.assignmentMode === "team" || form.assignmentMode === "member";
  const payload: CreateTaskPayload = {
    title: form.title.trim(),
    description: nullIfEmpty(form.description),
    priority: form.priority,
    assignee_id: withPerson ? nullIfEmpty(form.assigneeId) : null,
    team_id: withTeam ? nullIfEmpty(form.teamId) : null,
    depends_on_id: dependsOnWorkItem ? null : dep,
    depends_on_work_item_id: dependsOnWorkItem,
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
  if (form.assignmentMode === "member" && (!form.teamId || !form.assigneeId)) {
    return "Elige el equipo y el integrante al que se asigna la tarea";
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

// ── Edición ──────────────────────────────────────────────────────────────────
// El formulario de edición es el MISMO que el de creación (mismos campos,
// mismo estilo). Estas dos funciones lo puentean con una `Task` existente.

/** Precarga el formulario con los valores de una tarea existente. */
export function taskToForm(task: Task): TaskFormState {
  const hasPerson = task.assignee_id != null;
  const hasTeam = task.team_id != null;
  const assignmentMode: AssignmentMode =
    hasPerson && hasTeam ? "member" : hasTeam ? "team" : hasPerson ? "person" : "none";
  const estimated = task.estimated_days ?? "";
  return {
    title: task.title,
    description: task.description ?? "",
    workItemId: task.work_item_id ?? "",
    assignmentMode,
    assigneeId: task.assignee_id ?? "",
    teamId: task.team_id ?? "",
    dependsOnId: "",
    priority: task.priority,
    startDate: task.start_date ?? "",
    // Con fin explícito → modo "fin"; si no, se edita por duración/estimado.
    dateMode: task.due_date ? "end" : "duration",
    dueDate: task.due_date ?? "",
    durationDays: estimated,
    requiresApproval: task.requires_approval,
  };
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Payload de PATCH con SOLO lo que cambió respecto a `task`. Refleja el mismo
 * modelo de fechas que la creación: en modo "duración" el estimado manda y el
 * fin se deriva de inicio + días; en modo "fin", el fin es explícito. */
export function buildTaskUpdatePayload(form: TaskFormState, task: Task): UpdateTaskPayload {
  const out: UpdateTaskPayload = {};
  const set = <K extends keyof UpdateTaskPayload>(
    key: K,
    next: UpdateTaskPayload[K],
    prev: UpdateTaskPayload[K],
  ) => {
    if (next !== prev) {
      out[key] = next;
    }
  };

  set("title", form.title.trim(), task.title);
  set("description", nullIfEmpty(form.description), task.description ?? null);
  set("priority", form.priority, task.priority);
  set("requires_approval", form.requiresApproval, task.requires_approval);
  set("start_date", nullIfEmpty(form.startDate), task.start_date ?? null);

  if (form.dateMode === "duration") {
    const est = nullIfEmpty(form.durationDays);
    set("estimated_days", est, task.estimated_days ?? null);
    const derivedDue = form.startDate && est ? addDaysISO(form.startDate, Number(est)) : null;
    set("due_date", derivedDue, task.due_date ?? null);
  } else {
    set("due_date", nullIfEmpty(form.dueDate), task.due_date ?? null);
  }

  // Asignación: se mandan ambos ids (juntos = integrante directo, ver
  // buildTaskPayload). Solo si cambia alguno.
  const withPerson = form.assignmentMode === "person" || form.assignmentMode === "member";
  const withTeam = form.assignmentMode === "team" || form.assignmentMode === "member";
  const nextAssignee = withPerson ? nullIfEmpty(form.assigneeId) : null;
  const nextTeam = withTeam ? nullIfEmpty(form.teamId) : null;
  if (nextAssignee !== (task.assignee_id ?? null) || nextTeam !== (task.team_id ?? null)) {
    out.assignee_id = nextAssignee;
    out.team_id = nextTeam;
  }

  return out;
}
