import type { HistoryAction } from "../types";

/**
 * Color del progreso según el porcentaje completado. Es una función pura
 * (mismo número → mismas clases), fácil de testear y reutilizar.
 *  - < 34%  → rojo (en riesgo)
 *  - < 67%  → ámbar (en marcha)
 *  - >= 67% → esmeralda (al día)
 */
export function completionTone(pct: number): { bar: string; text: string } {
  if (pct < 34) {
    return { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" };
  }
  if (pct < 67) {
    return { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
  }
  return { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
}

/** Número total de páginas para `total` elementos (mínimo 1). */
export function totalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Iniciales para el avatar (ej. "Ana", "García" → "AG"). */
export function personInitials(name: string, lastName: string): string {
  const first = name.trim()[0] ?? "";
  const last = lastName.trim()[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

export const HISTORY_ACTION_LABELS: Record<HistoryAction, string> = {
  creacion: "Creó la tarea",
  cambio_estado: "Cambió el estado",
  reasignacion: "Reasignó",
  comentario: "Comentó",
};
