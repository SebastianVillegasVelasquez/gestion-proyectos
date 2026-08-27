import type { Task } from "../types/api.types";

// Fechas de tarea en formato corto y consistente. Las fechas del backend son
// `YYYY-MM-DD` (día, sin hora ni zona): se parten como texto a propósito, sin
// pasar por `new Date`, que las interpretaría en UTC y en Colombia mostraría
// el día anterior.

/** `2026-03-12` → `12/03/26`. Sin fecha → `—`. */
export function formatShortDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** Lapso legible de una tarea: `12/03/26 → 20/03/26`, o el aviso de que falta. */
export function formatDateRange(start: string | null, due: string | null): string {
  if (!start && !due) {
    return "Sin fechas";
  }
  return `${formatShortDate(start)} → ${formatShortDate(due)}`;
}

export interface DateRange {
  start: string | null;
  due: string | null;
}

/**
 * Lapso que abarca un conjunto de tareas: del primer inicio al último fin.
 *
 * Comparar con `<` sobre `YYYY-MM-DD` funciona porque el formato ISO ordena
 * igual como texto que como fecha; no hace falta construir objetos Date.
 */
export function rangeOfTasks(tasks: Task[]): DateRange {
  let start: string | null = null;
  let due: string | null = null;
  for (const task of tasks) {
    if (task.start_date && (start === null || task.start_date < start)) {
      start = task.start_date;
    }
    if (task.due_date && (due === null || task.due_date > due)) {
      due = task.due_date;
    }
  }
  return { start, due };
}

/** ¿Sigue abierta pasada su fecha de fin? (mismo criterio en toda la app). */
export function isOverdue(task: Task, today = new Date().toISOString().slice(0, 10)): boolean {
  return (
    task.due_date != null &&
    task.due_date < today &&
    task.status !== "completada" &&
    task.status !== "cancelada"
  );
}
