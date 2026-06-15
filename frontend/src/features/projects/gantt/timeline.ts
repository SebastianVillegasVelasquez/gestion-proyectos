// Matemática pura para posicionar barras en el Gantt. Trabaja con strings
// YYYY-MM-DD convertidos a "número de día" para evitar problemas de zona horaria.

export interface TimelineRange {
  startDay: number;
  endDay: number;
  totalDays: number;
}

export interface BarMetrics {
  offsetPct: number;
  widthPct: number;
}

export function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Rango total que abarca todas las tareas, o null si no hay fechas válidas. */
export function computeRange(
  tasks: { start_date: string; due_date: string }[],
): TimelineRange | null {
  const days: number[] = [];
  for (const t of tasks) {
    if (t.start_date) {
      days.push(toDayNumber(t.start_date));
    }
    if (t.due_date) {
      days.push(toDayNumber(t.due_date));
    }
  }
  if (days.length === 0) {
    return null;
  }
  const startDay = Math.min(...days);
  const endDay = Math.max(...days);
  return { startDay, endDay, totalDays: Math.max(1, endDay - startDay) };
}

/** Posición (offset) y ancho de la barra de una tarea, en porcentaje [0..100]. */
export function barMetrics(
  task: { start_date: string; due_date: string },
  range: TimelineRange,
): BarMetrics {
  const MIN_WIDTH = 2;
  const start = toDayNumber(task.start_date);
  const due = toDayNumber(task.due_date);
  const rawOffset = ((start - range.startDay) / range.totalDays) * 100;
  // +1 para que una tarea de un solo día tenga ancho visible.
  const rawWidth = (Math.max(1, due - start + 1) / range.totalDays) * 100;
  // Reservamos al menos MIN_WIDTH de espacio para que la barra nunca desborde.
  const offsetPct = Math.max(0, Math.min(100 - MIN_WIDTH, rawOffset));
  const widthPct = Math.max(MIN_WIDTH, Math.min(100 - offsetPct, rawWidth));
  return { offsetPct, widthPct };
}
