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

/** Posición en % de una fecha dentro del rango, o null si cae fuera. */
export function dayOffsetPct(iso: string, range: TimelineRange): number | null {
  const day = toDayNumber(iso);
  if (day < range.startDay || day > range.startDay + range.totalDays) {
    return null;
  }
  return ((day - range.startDay) / range.totalDays) * 100;
}

const MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function dayParts(day: number): { y: number; m: number; d: number } {
  const date = new Date(day * 86_400_000);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate() };
}

export interface AxisTick {
  key: string;
  label: string;
  offsetPct: number;
}

/**
 * Marcas del eje de tiempo. Para rangos cortos (≤ 45 días) marca cada semana;
 * para los más largos, el inicio de cada mes. Devuelve etiqueta + posición en %.
 */
export function axisTicks(range: TimelineRange): AxisTick[] {
  const ticks: AxisTick[] = [];
  const endDay = range.startDay + range.totalDays;

  if (range.totalDays <= 45) {
    for (let offset = 0; offset <= range.totalDays; offset += 7) {
      const { d, m } = dayParts(range.startDay + offset);
      ticks.push({
        key: `w${range.startDay + offset}`,
        label: `${d} ${MONTHS_ES[m]}`,
        offsetPct: (offset / range.totalDays) * 100,
      });
    }
    return ticks;
  }

  const monthLabel = (day: number) => {
    const { y, m } = dayParts(day);
    return `${MONTHS_ES[m]} ${String(y).slice(2)}`;
  };
  // Primer tick en el inicio del rango.
  ticks.push({ key: `m${range.startDay}`, label: monthLabel(range.startDay), offsetPct: 0 });
  // Luego, el primer día de cada mes siguiente dentro del rango.
  let { y, m } = dayParts(range.startDay);
  let next = Date.UTC(y, m + 1, 1) / 86_400_000;
  while (next <= endDay) {
    ticks.push({
      key: `m${next}`,
      label: monthLabel(next),
      offsetPct: ((next - range.startDay) / range.totalDays) * 100,
    });
    ({ y, m } = dayParts(next));
    next = Date.UTC(y, m + 1, 1) / 86_400_000;
  }
  return ticks;
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
