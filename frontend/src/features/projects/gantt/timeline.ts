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

/**
 * Expande el rango `before` días hacia atrás y `after` hacia adelante.
 * Da "aire" visual en los bordes para que las barras nunca toquen el límite
 * del área de tiempo (evita cortes y deja espacio a etiquetas).
 */
export function padRange(range: TimelineRange, before: number, after: number): TimelineRange {
  const startDay = range.startDay - before;
  const endDay = range.endDay + after;
  return { startDay, endDay, totalDays: Math.max(1, endDay - startDay) };
}

// Día de la semana de un "número de día" (0=domingo … 6=sábado).
// El día 0 (1970-01-01) fue jueves, de ahí el +4.
function weekday(day: number): number {
  return (day + 4) % 7;
}

const WEEKDAY_INITIALS_ES = ["D", "L", "M", "X", "J", "V", "S"];

/** Banda horizontal dentro del rango (mes o fin de semana), en % [0..100]. */
export interface TimeBand {
  key: string;
  label?: string;
  startPct: number;
  widthPct: number;
}

const pctOf = (day: number, range: TimelineRange) =>
  ((day - range.startDay) / range.totalDays) * 100;

/** Una banda por mes calendario que intersecta el rango (encabezado superior). */
export function monthBands(range: TimelineRange): TimeBand[] {
  const bands: TimeBand[] = [];
  const endDay = range.startDay + range.totalDays;
  let day = range.startDay;
  while (day < endDay) {
    const { y, m } = dayParts(day);
    const nextMonth = Date.UTC(y, m + 1, 1) / 86_400_000;
    const bandEnd = Math.min(nextMonth, endDay);
    bands.push({
      key: `mb${day}`,
      label: `${MONTHS_ES[m]} ${y}`,
      startPct: pctOf(day, range),
      widthPct: pctOf(bandEnd, range) - pctOf(day, range),
    });
    day = bandEnd;
  }
  return bands;
}

/** Bandas sábado–domingo dentro del rango (sombreado en zoom de día). */
export function weekendBands(range: TimelineRange): TimeBand[] {
  const bands: TimeBand[] = [];
  const endDay = range.startDay + range.totalDays;
  // Primer sábado cuyo fin de semana toca el rango (si empezamos en domingo,
  // el sábado "anterior" sigue aportando su domingo).
  let sat = range.startDay + ((6 - weekday(range.startDay) + 7) % 7);
  if (weekday(range.startDay) === 0) {
    sat = range.startDay - 1;
  }
  for (; sat < endDay; sat += 7) {
    const from = Math.max(sat, range.startDay);
    const to = Math.min(sat + 2, endDay);
    if (to <= from) {
      continue;
    }
    bands.push({
      key: `we${sat}`,
      startPct: pctOf(from, range),
      widthPct: pctOf(to, range) - pctOf(from, range),
    });
  }
  return bands;
}

export type TickUnit = "day" | "week" | "month";

/**
 * Marcas del eje según el nivel de zoom. A diferencia de `axisTicks`, las
 * marcas caen en límites naturales (días, lunes, inicios de mes) para que la
 * rejilla se lea como un calendario y no como divisiones arbitrarias.
 */
export function ticksForZoom(range: TimelineRange, unit: TickUnit): AxisTick[] {
  const endDay = range.startDay + range.totalDays;

  if (unit === "day") {
    // Demasiados días → una marca por día sería ruido; degradamos a semanas.
    if (range.totalDays > 180) {
      return ticksForZoom(range, "week");
    }
    const ticks: AxisTick[] = [];
    for (let day = range.startDay; day <= endDay; day += 1) {
      const { d } = dayParts(day);
      ticks.push({
        key: `d${day}`,
        label: `${WEEKDAY_INITIALS_ES[weekday(day)]} ${d}`,
        offsetPct: pctOf(day, range),
      });
    }
    return ticks;
  }

  if (unit === "week") {
    const ticks: AxisTick[] = [];
    let monday = range.startDay + ((1 - weekday(range.startDay) + 7) % 7);
    for (; monday <= endDay; monday += 7) {
      const { d, m } = dayParts(monday);
      ticks.push({
        key: `w${monday}`,
        label: `${d} ${MONTHS_ES[m]}`,
        offsetPct: pctOf(monday, range),
      });
    }
    return ticks;
  }

  // month: inicios de mes dentro del rango. Si el rango cabe en un solo mes,
  // caemos a semanas para no dejar el eje vacío.
  const ticks: AxisTick[] = [];
  let { y, m } = dayParts(range.startDay);
  let next = Date.UTC(y, m, 1) / 86_400_000;
  if (next < range.startDay) {
    next = Date.UTC(y, m + 1, 1) / 86_400_000;
  }
  while (next <= endDay) {
    const parts = dayParts(next);
    ticks.push({
      key: `m${next}`,
      label: `${MONTHS_ES[parts.m]} ${String(parts.y).slice(2)}`,
      offsetPct: pctOf(next, range),
    });
    ({ y, m } = parts);
    next = Date.UTC(y, m + 1, 1) / 86_400_000;
  }
  return ticks.length > 0 ? ticks : ticksForZoom(range, "week");
}

/** Etiqueta corta "12 jun" para fechas ISO (rótulos dentro de las barras). */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_ES[m - 1]}`;
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
