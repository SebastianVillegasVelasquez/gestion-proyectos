import type { TaskStatus } from "@/features/projects/types/api.types";

/** Estado de vencimiento de una tarea, para el aviso de «Mis tareas». */
export type DueStatus = "done" | "overdue" | "due_soon" | "on_track" | "no_date";

const DONE_STATES: TaskStatus[] = ["completada", "cancelada"];

/** Días (inclusive) dentro de los que una fecha cuenta como «por vencer». */
export const DUE_SOON_DAYS = 3;

function toDay(value: string): number {
  // Fecha ISO (YYYY-MM-DD) → días desde epoch, sin husos horarios de por medio.
  return Math.floor(Date.parse(`${value}T00:00:00`) / 86_400_000);
}

/**
 * Clasifica una tarea por su fecha límite. `today` se inyecta (ISO YYYY-MM-DD)
 * para que sea puro y testeable.
 *
 * - `done`      la tarea ya está completada o cancelada (el vencimiento no aplica)
 * - `overdue`   venció y sigue abierta
 * - `due_soon`  vence hoy o dentro de los próximos DUE_SOON_DAYS días
 * - `on_track`  vence más adelante
 * - `no_date`   sin fecha límite
 */
export function dueStatus(
  task: { status: TaskStatus; due_date: string | null },
  today: string,
): DueStatus {
  if (DONE_STATES.includes(task.status)) {
    return "done";
  }
  if (!task.due_date) {
    return "no_date";
  }
  const diff = toDay(task.due_date) - toDay(today);
  if (diff < 0) {
    return "overdue";
  }
  if (diff <= DUE_SOON_DAYS) {
    return "due_soon";
  }
  return "on_track";
}

/**
 * Días de calendario entre hoy y la fecha límite: positivo = faltan N días,
 * 0 = vence hoy, negativo = venció hace N días. `null` si no hay fecha.
 * Reusa el mismo cómputo en días-epoch que `dueStatus` para que nunca
 * discrepen a medianoche.
 */
export function daysUntil(dueDate: string | null, today: string): number | null {
  if (!dueDate) {
    return null;
  }
  return toDay(dueDate) - toDay(today);
}

export const DUE_STATUS_LABELS: Record<DueStatus, string> = {
  done: "Completada",
  overdue: "Vencida",
  due_soon: "Por vencer",
  on_track: "En plazo",
  no_date: "Sin fecha",
};

export const DUE_STATUS_CLASSES: Record<DueStatus, string> = {
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  overdue: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  due_soon: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  on_track: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  no_date: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};
