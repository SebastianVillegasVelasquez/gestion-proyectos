// Métricas derivadas de las tareas de un proyecto. Se calculan en el frontend a
// partir de `GET /projects/{id}/tasks` (que ya trae todas las tareas con estado
// y fechas), así el detalle del proyecto no depende de endpoints nuevos ni de la
// guardia de membresía del dashboard del usuario. Una sola fuente de verdad para
// el progreso, la distribución por estado, los atrasos y los vencimientos.

import type { Task, TaskStatus } from "../types/api.types";

// Estados abiertos (cuentan como "por hacer" para atrasos): todo lo que no está
// completado ni cancelado.
const OPEN_STATUSES: TaskStatus[] = [
  "pendiente_por_iniciar",
  "en_progreso",
  "en_revision",
  "devuelta",
];

export type ProjectStatus = "active" | "at-risk" | "in-review";

/** Un segmento del desglose por estado, con su etiqueta y color de marca. */
export interface StatusSegment {
  status: TaskStatus;
  label: string;
  count: number;
  /** Color sólido para la barra/donut (usa la paleta de marca vía CSS vars). */
  color: string;
  /** Clase de fondo tenue para leyendas/badges. */
  soft: string;
}

export interface TaskMetrics {
  total: number;
  completed: number;
  inProgress: number;
  inReview: number;
  pending: number;
  returned: number;
  cancelled: number;
  /** Tareas abiertas cuya fecha de fin ya pasó. */
  overdue: number;
  /** % completado = completadas / total (0 si no hay tareas). */
  progress: number;
  /** Estado global del proyecto, misma regla que el backend. */
  status: ProjectStatus;
  /** Segmentos con conteo > 0, en orden de ciclo de vida, para donut/leyenda. */
  segments: StatusSegment[];
}

// Orden de ciclo de vida + presentación de cada estado. Los colores se toman de
// los tokens de marca (definidos en App.css) para no introducir una paleta nueva.
const STATUS_META: Record<TaskStatus, { label: string; color: string; soft: string }> = {
  completada: {
    label: "Completadas",
    color: "var(--color-brand-teal)",
    soft: "bg-brand-teal/10 text-brand-teal-dark dark:text-brand-teal",
  },
  en_progreso: {
    label: "En progreso",
    color: "var(--color-brand-blue)",
    soft: "bg-brand-blue/10 text-brand-blue",
  },
  en_revision: {
    label: "En revisión",
    color: "var(--color-brand-gold)",
    soft: "bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold",
  },
  pendiente_por_iniciar: {
    label: "Por iniciar",
    color: "var(--color-muted-foreground)",
    soft: "bg-muted text-muted-foreground",
  },
  devuelta: {
    label: "Devueltas",
    color: "#f43f5e", // rose-500: señal de reproceso, fuera de la paleta de marca a propósito
    soft: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  cancelada: {
    label: "Canceladas",
    color: "#94a3b8", // slate-400
    soft: "bg-slate-400/15 text-slate-500 dark:text-slate-400",
  },
};

// Orden en que se muestran los segmentos (ciclo de vida, no alfabético).
const SEGMENT_ORDER: TaskStatus[] = [
  "completada",
  "en_revision",
  "en_progreso",
  "pendiente_por_iniciar",
  "devuelta",
  "cancelada",
];

function isOverdue(task: Task, today: string): boolean {
  return task.due_date != null && task.due_date < today && OPEN_STATUSES.includes(task.status);
}

export function deriveTaskMetrics(tasks: Task[]): TaskMetrics {
  const today = new Date().toISOString().slice(0, 10);
  const by = (s: TaskStatus) => tasks.filter((t) => t.status === s).length;

  const completed = by("completada");
  const inProgress = by("en_progreso");
  const inReview = by("en_revision");
  const pending = by("pendiente_por_iniciar");
  const returned = by("devuelta");
  const cancelled = by("cancelada");
  const total = tasks.length;
  const overdue = tasks.filter((t) => isOverdue(t, today)).length;

  const counts: Record<TaskStatus, number> = {
    completada: completed,
    en_progreso: inProgress,
    en_revision: inReview,
    pendiente_por_iniciar: pending,
    devuelta: returned,
    cancelada: cancelled,
  };

  const segments: StatusSegment[] = SEGMENT_ORDER.filter((s) => counts[s] > 0).map((status) => ({
    status,
    label: STATUS_META[status].label,
    count: counts[status],
    color: STATUS_META[status].color,
    soft: STATUS_META[status].soft,
  }));

  const status: ProjectStatus = overdue > 0 ? "at-risk" : inReview > 0 ? "in-review" : "active";

  // El avance del proyecto se mide sobre las tareas PADRE (cada una es un
  // entregable). El backend ya da a cada tarea su `progress_pct` —promedio de
  // sus subtareas para las padre, por estado para el resto—; aquí solo
  // promediamos el de las padre no canceladas. Las subtareas no cuentan aparte:
  // ya están dentro del porcentaje de su padre.
  const parents = tasks.filter((t) => t.parent_task_id === null && t.status !== "cancelada");
  const progress = parents.length
    ? Math.round(parents.reduce((sum, t) => sum + (t.progress_pct || 0), 0) / parents.length)
    : 0;

  return {
    total,
    completed,
    inProgress,
    inReview,
    pending,
    returned,
    cancelled,
    overdue,
    progress,
    status,
    segments,
  };
}

// Presentación del estado global (badge). Mismos tres valores que el backend.
export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; className: string; dot: string }
> = {
  active: {
    label: "En marcha",
    className: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  "at-risk": {
    label: "En riesgo",
    className: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  "in-review": {
    label: "En revisión",
    className: "bg-brand-gold/15 text-brand-gold-dark ring-brand-gold/25 dark:text-brand-gold",
    dot: "bg-brand-gold",
  },
};
