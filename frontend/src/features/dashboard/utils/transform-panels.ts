import type {
  DashboardDeadlineItem,
  DashboardProjectItem,
  DashboardTaskItem,
  Deadline,
  Priority,
  Project,
  Task,
  TaskStatus,
} from "../types";

const MONTHS_ABBR = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

// Estados del backend (6) -> las 3 columnas del tablero del dashboard.
const STATUS_TO_COLUMN: Record<string, TaskStatus> = {
  pendiente_por_iniciar: "pending",
  devuelta: "pending",
  en_progreso: "in-progress",
  en_revision: "in-progress",
  completada: "completed",
  cancelada: "completed",
};

/** Parte una fecha ISO (YYYY-MM-DD) en componentes locales, sin saltos de zona. */
function parseISO(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

/**
 * "2026-06-14" -> "14 Jun" (etiqueta corta para los tags de tarea).
 * Sin fecha (tarea aún sin fecha límite) -> "Sin fecha".
 */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) {
    return "Sin fecha";
  }
  const { month, day } = parseISO(iso);
  const abbr = MONTHS_ABBR[month - 1] ?? "";
  return `${String(day)} ${abbr}`;
}

/** Días entre hoy y la fecha de fin (negativo = vencida). */
function daysUntil(iso: string, today: Date): number {
  const { year, month, day } = parseISO(iso);
  const due = Date.UTC(year, month - 1, day);
  const ref = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due - ref) / 86_400_000);
}

/**
 * Prioridad visual de un vencimiento, derivada de la cercanía de la fecha.
 * Vencida -> "high" (rojo/urgente); hoy -> "today"; pronto -> "medium"; resto -> "low".
 * Es presentación pura, por eso vive en el front (el backend solo decide CUÁLES
 * tareas mostrar, que es la parte costosa).
 */
export function deadlinePriority(dueISO: string, today: Date): Priority {
  const diff = daysUntil(dueISO, today);
  if (diff < 0) {
    return "high";
  }
  if (diff === 0) {
    return "today";
  }
  if (diff <= 3) {
    return "medium";
  }
  return "low";
}

export function toTask(item: DashboardTaskItem): Task {
  const status = STATUS_TO_COLUMN[item.status] ?? "pending";
  const tags = [];
  if (item.project_name) {
    tags.push({ label: item.project_name, variant: "project" as const });
  }
  tags.push({ label: formatShortDate(item.due_date), variant: "date" as const });
  return { id: item.id, title: item.title, status, tags };
}

export function toProject(item: DashboardProjectItem): Project {
  return {
    id: item.id,
    name: item.name,
    // El dominio no tiene "tech badge"; usamos el cliente como etiqueta real.
    techBadge: item.client_name ?? "General",
    status: item.status,
    coordinator: item.coordinator ?? "Sin coordinador",
    tasksTotal: item.tasks_total,
    tasksCompleted: item.tasks_completed,
    progressPercent: item.progress_pct,
  };
}

export function toDeadline(item: DashboardDeadlineItem, today: Date): Deadline {
  const { month, day } = parseISO(item.due_date);
  return {
    id: item.id,
    day,
    month: MONTHS_ABBR[month - 1] ?? "",
    title: item.title,
    project: item.project_name ?? "Sin proyecto",
    priority: deadlinePriority(item.due_date, today),
  };
}
