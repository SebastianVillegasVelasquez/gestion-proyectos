import type { Task, TaskStatus } from "../types/api.types";

// Avance proxy por estado (el modelo no guarda % por tarea). Mismo criterio que
// el cronograma, replicado aquí para que el helper sea autónomo y testeable.
const STATUS_PROGRESS: Record<TaskStatus, number> = {
  pendiente_por_iniciar: 0,
  en_progreso: 35,
  en_revision: 70,
  devuelta: 50,
  completada: 100,
  cancelada: 0,
};

/** `YYYY-MM-DD` → número de día (UTC), para restar fechas sin objetos Date. */
const dayNum = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

export type ScheduleStatus = "on_track" | "behind" | "delayed" | "idle";

/**
 * Etiqueta + clases de color de cada estado de calendario. Vive aquí (junto al
 * tipo) para que lo compartan la vista de Integrantes y el panel de equipo sin
 * que uno importe del otro.
 */
export const SCHEDULE_BADGE: Record<ScheduleStatus, { label: string; cls: string }> = {
  on_track: {
    label: "A tiempo",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  behind: {
    label: "Sin margen",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  delayed: {
    label: "Atrasado",
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
  idle: { label: "Sin carga", cls: "bg-muted text-muted-foreground" },
};

/** Orden de peor a mejor, para poder ordenar una tabla por salud de calendario. */
export const SCHEDULE_RANK: Record<ScheduleStatus, number> = {
  delayed: 0,
  behind: 1,
  on_track: 2,
  idle: 3,
};

export interface MemberSchedule {
  status: ScheduleStatus;
  /** Avance que "debería" llevar si cada tarea progresara lineal entre sus fechas. */
  expectedPct: number;
  /** Avance real, proxy por estado de cada tarea. */
  actualPct: number;
  /** Tareas abiertas cuya fecha de entrega ya pasó. */
  overdue: number;
  /** Tareas abiertas que vencen dentro de 3 días. */
  dueSoon: number;
}

/**
 * Salud de calendario de una persona a partir de SUS tareas: cruza el avance
 * real contra el esperado por fechas y cuenta lo vencido / por vencer. Ponderado
 * por duración (una tarea larga pesa más). Puro: recibe `today`, no lo lee.
 */
export function memberSchedule(tasks: Task[], today: string): MemberSchedule {
  const t = dayNum(today);
  let weight = 0;
  let actSum = 0;
  let expSum = 0;
  let expWeight = 0;
  let overdue = 0;
  let dueSoon = 0;

  for (const task of tasks) {
    if (task.status === "cancelada") {
      continue;
    }
    const open = task.status !== "completada";
    if (open && task.due_date && task.due_date < today) {
      overdue += 1;
    } else if (open && task.due_date && dayNum(task.due_date) - t <= 3) {
      dueSoon += 1;
    }
    const days =
      task.start_date && task.due_date
        ? Math.max(1, dayNum(task.due_date) - dayNum(task.start_date) + 1)
        : 1;
    weight += days;
    actSum += STATUS_PROGRESS[task.status] * days;
    if (task.start_date && task.due_date) {
      const span = dayNum(task.due_date) - dayNum(task.start_date);
      const frac = span <= 0 ? 1 : (t - dayNum(task.start_date)) / span;
      expSum += Math.max(0, Math.min(1, frac)) * 100 * days;
      expWeight += days;
    }
  }

  const actualPct = weight === 0 ? 0 : Math.round(actSum / weight);
  const expectedPct = expWeight === 0 ? 0 : Math.round(expSum / expWeight);
  const status: ScheduleStatus =
    weight === 0
      ? "idle"
      : overdue > 0
        ? "delayed"
        : actualPct + 8 < expectedPct
          ? "behind"
          : "on_track";

  return { status, expectedPct, actualPct, overdue, dueSoon };
}
