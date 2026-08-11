// Desempeño de entregas en el tiempo: agrupa las tareas completadas por periodo
// (semana o mes) y separa las que se entregaron a tiempo de las tardías. A
// diferencia de `task-metrics.ts` (una foto del estado actual), esto mide una
// tendencia — cómo se ha ido comportando el equipo entrega tras entrega.

import type { Task } from "../types/api.types";

export type DeliveryGranularity = "semana" | "mes";

export interface DeliveryBucket {
  key: string;
  label: string;
  onTime: number;
  late: number;
  total: number;
}

const MONTHS_SHORT = [
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

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day; // lleva al lunes
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function weekKey(d: Date): string {
  return startOfWeek(d).toISOString().slice(0, 10);
}

function weekLabel(d: Date): string {
  const s = startOfWeek(d);
  return `${String(s.getDate()).padStart(2, "0")} ${MONTHS_SHORT[s.getMonth()]}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date, currentYear: number): string {
  const abbr = MONTHS_SHORT[d.getMonth()];
  return d.getFullYear() === currentYear ? abbr : `${abbr} '${String(d.getFullYear()).slice(2)}`;
}

/**
 * Últimos `count` periodos (semanas o meses) hasta hoy, con conteo de entregas
 * a tiempo vs. tardías. Una tarea cuenta como "entregada" si está `completada`
 * y tiene `completed_at`; es a tiempo si no tenía fecha límite o si se completó
 * en o antes de `due_date`.
 */
export function buildDeliveryBuckets(
  tasks: Task[],
  granularity: DeliveryGranularity,
  count: number,
): DeliveryBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Arma los últimos `count` periodos vacíos, del más antiguo al más reciente,
  // para que se vean aunque no haya entregas (la ausencia también informa).
  const buckets = new Map<string, DeliveryBucket>();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    if (granularity === "semana") {
      d.setDate(d.getDate() - i * 7);
      const key = weekKey(d);
      buckets.set(key, { key, label: weekLabel(d), onTime: 0, late: 0, total: 0 });
    } else {
      d.setMonth(d.getMonth() - i);
      const key = monthKey(d);
      buckets.set(key, {
        key,
        label: monthLabel(d, today.getFullYear()),
        onTime: 0,
        late: 0,
        total: 0,
      });
    }
  }

  for (const task of tasks) {
    if (task.status !== "completada" || !task.completed_at) {
      continue;
    }
    const completedDate = toDate(task.completed_at.slice(0, 10));
    const key = granularity === "semana" ? weekKey(completedDate) : monthKey(completedDate);
    const bucket = buckets.get(key);
    if (!bucket) {
      continue; // fuera del rango visible
    }
    const onTime = !task.due_date || task.completed_at.slice(0, 10) <= task.due_date;
    if (onTime) {
      bucket.onTime += 1;
    } else {
      bucket.late += 1;
    }
    bucket.total += 1;
  }

  return Array.from(buckets.values());
}

export interface DeliverySummary {
  totalDelivered: number;
  onTimePct: number;
  trend: "up" | "down" | "flat";
}

/** Compara la primera vs. la segunda mitad del rango visible para un veredicto rápido. */
export function summarizeDelivery(buckets: DeliveryBucket[]): DeliverySummary {
  const totalDelivered = buckets.reduce((acc, b) => acc + b.total, 0);
  const totalOnTime = buckets.reduce((acc, b) => acc + b.onTime, 0);
  const onTimePct = totalDelivered ? Math.round((totalOnTime / totalDelivered) * 100) : 0;

  const mid = Math.floor(buckets.length / 2);
  const firstHalf = buckets.slice(0, mid);
  const secondHalf = buckets.slice(mid);
  const rate = (bs: DeliveryBucket[]) => {
    const total = bs.reduce((acc, b) => acc + b.total, 0);
    const onTime = bs.reduce((acc, b) => acc + b.onTime, 0);
    return total ? onTime / total : null;
  };
  const first = rate(firstHalf);
  const second = rate(secondHalf);
  let trend: DeliverySummary["trend"] = "flat";
  if (first != null && second != null) {
    if (second - first >= 0.08) {
      trend = "up";
    } else if (first - second >= 0.08) {
      trend = "down";
    }
  }

  return { totalDelivered, onTimePct, trend };
}
