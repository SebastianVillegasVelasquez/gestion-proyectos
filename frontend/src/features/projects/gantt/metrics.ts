import type { Task, TaskStatus } from "../types/api.types";
import { toDayNumber } from "./timeline";

// Avance derivado del estado (no hay % por tarea en el modelo). Coarse pero
// consistente: comunica "qué tan hecha" está cada tarea en la barra.
const STATUS_PROGRESS: Record<TaskStatus, number> = {
  pendiente_por_iniciar: 0,
  en_progreso: 35,
  en_revision: 70,
  devuelta: 50,
  completada: 100,
  cancelada: 0,
};

export function statusProgressPct(status: TaskStatus): number {
  return STATUS_PROGRESS[status];
}

/** Una tarea está vencida si no está cerrada y su entrega ya pasó. */
export function isOverdue(task: Pick<Task, "status" | "due_date">, today: string): boolean {
  return (
    task.status !== "completada" &&
    task.status !== "cancelada" &&
    Boolean(task.due_date) &&
    task.due_date < today
  );
}

export interface GanttSummary {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  /** % de tareas completadas sobre el total (0-100, redondeado). */
  progressPct: number;
}

export function summarize(tasks: Pick<Task, "status" | "due_date">[], today: string): GanttSummary {
  const total = tasks.length;
  let completed = 0;
  let inProgress = 0;
  let overdue = 0;
  for (const t of tasks) {
    if (t.status === "completada") {
      completed += 1;
    }
    if (t.status === "en_progreso" || t.status === "en_revision") {
      inProgress += 1;
    }
    if (isOverdue(t, today)) {
      overdue += 1;
    }
  }
  return {
    total,
    completed,
    inProgress,
    overdue,
    progressPct: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

/**
 * Días que faltan hasta `endDate` desde `today` (negativo si ya pasó). null si
 * no hay fecha de fin.
 */
export function daysRemaining(endDate: string | null, today: string): number | null {
  if (!endDate) {
    return null;
  }
  return toDayNumber(endDate) - toDayNumber(today);
}
