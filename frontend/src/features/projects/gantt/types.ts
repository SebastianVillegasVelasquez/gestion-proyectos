export type TaskStatus =
  | "pendiente_por_iniciar"
  | "en_progreso"
  | "en_revision"
  | "devuelta"
  | "completada"
  | "cancelada";

export type TaskPriority = "no_definida" | "baja" | "media" | "alta" | "urgente";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pendiente_por_iniciar: "Pendiente por iniciar",
  en_progreso: "En progreso",
  en_revision: "En revisión",
  devuelta: "Devuelta",
  completada: "Completada",
  cancelada: "Cancelada",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  no_definida: "No definida",
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = (
  Object.keys(TASK_STATUS_LABELS) as TaskStatus[]
).map((v) => ({ value: v, label: TASK_STATUS_LABELS[v] }));

export const TASK_PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = (
  Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]
).map((v) => ({ value: v, label: TASK_PRIORITY_LABELS[v] }));

// Visual tokens ────────────────────────────────────────────────────────────

export const STATUS_BAR_COLOR: Record<TaskStatus, string> = {
  pendiente_por_iniciar: "bg-slate-400 dark:bg-slate-500",
  en_progreso: "bg-blue-500",
  en_revision: "bg-amber-400",
  devuelta: "bg-rose-500",
  completada: "bg-emerald-500",
  cancelada: "bg-slate-300 dark:bg-slate-700 opacity-50",
};

export const STATUS_BADGE: Record<TaskStatus, string> = {
  pendiente_por_iniciar:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  en_progreso:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
  en_revision:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  devuelta:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400",
  completada:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
  cancelada:
    "border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 line-through",
};

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  no_definida: "text-slate-400 dark:text-slate-500",
  baja: "text-blue-500",
  media: "text-slate-500 dark:text-slate-400",
  alta: "text-orange-500",
  urgente: "text-rose-600",
};

// Model ─────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  node_id: string;
  assignee_id: string | null;
  start_date: string; // YYYY-MM-DD
  due_date: string; // YYYY-MM-DD
}

export function createEmptyTask(nodeId = ""): Task {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    status: "pendiente_por_iniciar",
    priority: "no_definida",
    node_id: nodeId,
    assignee_id: null,
    start_date: "",
    due_date: "",
  };
}
