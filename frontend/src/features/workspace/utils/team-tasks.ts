import type { ApiTeamTask, ProjectTaskStatus } from "../api/workspace.api";
import type { TaskPriority } from "@/features/projects/types/api.types";

// ── Estado ──────────────────────────────────────────────────────────────────
// Una sola fuente de verdad para etiqueta, badge y color de barra por estado.
// La vista Lista y la Kanban leen de aquí, así no divergen.

export interface StatusMeta {
  label: string;
  /** Clases del pill de estado. */
  badge: string;
  /** Clase de fondo de la barra de progreso. */
  bar: string;
}

export const STATUS_META: Record<ProjectTaskStatus, StatusMeta> = {
  pendiente_por_iniciar: {
    label: "Por iniciar",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    bar: "bg-slate-400",
  },
  en_progreso: {
    label: "En progreso",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    bar: "bg-blue-500",
  },
  en_revision: {
    label: "En revisión",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    bar: "bg-violet-500",
  },
  devuelta: {
    label: "Devuelta",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    bar: "bg-rose-500",
  },
  completada: {
    label: "Completada",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  cancelada: {
    label: "Cancelada",
    badge: "bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500",
    bar: "bg-slate-300",
  },
};

/**
 * Avance derivado del estado. El modelo NO guarda un % por tarea, así que la
 * barra comunica "qué tan hecha está" con la misma escala que el cronograma
 * (ver `gantt/metrics.ts`): si las dos vistas usaran escalas distintas, la
 * misma tarea se vería con dos avances diferentes.
 */
const STATUS_PROGRESS: Record<ProjectTaskStatus, number> = {
  pendiente_por_iniciar: 0,
  en_progreso: 35,
  en_revision: 70,
  devuelta: 50,
  completada: 100,
  cancelada: 0,
};

export function taskProgressPct(status: ProjectTaskStatus): number {
  return STATUS_PROGRESS[status];
}

// ── Urgencia ────────────────────────────────────────────────────────────────
// La urgencia del diseño es la `priority` real de la tarea: no inventamos un
// campo nuevo, solo le damos nombre y color de negocio.

export interface UrgencyMeta {
  label: string;
  badge: string;
}

export const URGENCY_META: Record<TaskPriority, UrgencyMeta> = {
  no_definida: {
    label: "Sin definir",
    badge: "bg-slate-50 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500",
  },
  baja: {
    label: "Baja",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  media: {
    label: "Media",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  alta: {
    label: "Alta",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  urgente: {
    label: "Crítica",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
};

/**
 * `priority` llega del backend como string: si algun dia el enum crece, esta
 * vista debe degradar a "Sin definir" en vez de romperse con `undefined`.
 */
export function urgencyMeta(priority: string): UrgencyMeta {
  const known: Record<string, UrgencyMeta | undefined> = URGENCY_META;
  return known[priority] ?? URGENCY_META.no_definida;
}

// ── Estados abiertos / vencimiento ──────────────────────────────────────────

const CLOSED_STATUSES: ReadonlySet<ProjectTaskStatus> = new Set<ProjectTaskStatus>([
  "completada",
  "cancelada",
]);

export function isOpen(task: Pick<ApiTeamTask, "status">): boolean {
  return !CLOSED_STATUSES.has(task.status);
}

/** Una tarea está vencida si sigue abierta y su fecha de entrega ya pasó. */
export function isOverdue(task: Pick<ApiTeamTask, "status" | "due_date">, today: string): boolean {
  return isOpen(task) && task.due_date !== null && task.due_date < today;
}

/**
 * Días que faltan (negativo si ya venció). `null` cuando la tarea aún no tiene
 * fecha: una tarea delegada puede estar todavía sin planificar.
 */
export function daysUntilDue(dueDate: string | null, today: string): number | null {
  if (!dueDate) {
    return null;
  }
  const MS_PER_DAY = 86_400_000;
  return Math.round((Date.parse(dueDate) - Date.parse(today)) / MS_PER_DAY);
}

/** "12/03/2026" desde el ISO corto del backend, sin construir Date (evita el desfase de zona horaria). */
export function formatDueDate(iso: string | null): string {
  if (!iso) {
    return "Sin fecha";
  }
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Bloqueos ────────────────────────────────────────────────────────────────

/**
 * Solo bloquean las dependencias que aún NO están completadas: una dependencia
 * ya cumplida es historia, no un impedimento, y mostrarla haría ruido en la fila.
 */
export function activeBlockers(task: ApiTeamTask) {
  return task.blocked_by.filter((b) => b.status !== "completada");
}

// ── Entrega: cuándo una fila ofrece "Comenzar", "Entregar" o "Marcar como
//    realizada" ────────────────────────────────────────────────────────────
//
// Una tarea PADRE es el entregable: su avance sale del promedio de sus
// subtareas (ver `compute_task_progress` en el backend), así que solo llega a
// 100 cuando TODAS están completadas — recién ahí se puede entregar. Una
// SUBTAREA nunca es un entregable en sí misma: cuando su responsable la da por
// hecha, basta "Marcar como realizada" (crea un entregable "sin adjunto" que
// sigue el mismo flujo de revisión que cualquier otra entrega).

/** Una tarea padre es un entregable: cuando su avance llega al 100% (todas las
 *  subtareas hechas y, si hacía falta, ya aprobada) queda lista para entregarse
 *  como tal. Las subtareas nunca son entregables. */
export function isDeliverableReady(
  task: Pick<ApiTeamTask, "parent_task_id" | "progress_pct" | "status">,
): boolean {
  return (
    task.parent_task_id === null &&
    (task.progress_pct ?? 0) >= 100 &&
    task.status !== "completada" &&
    task.status !== "cancelada"
  );
}

/** Una subtarea EN PROGRESO (ya se le dio "Comenzar") que su responsable puede
 *  dar por hecha. */
export function isSubtaskReadyToComplete(
  task: Pick<ApiTeamTask, "parent_task_id" | "status">,
): boolean {
  return task.parent_task_id !== null && task.status === "en_progreso";
}

// ── Jerarquía padre → subtarea ──────────────────────────────────────────────

export interface TaskTreeRow {
  task: ApiTeamTask;
  /** 0 = raíz dentro de su grupo; 1+ = subtarea anidada bajo su padre. */
  depth: number;
  /**
   * Título del padre cuando el padre NO está en este grupo. Agrupando por
   * estado o por integrante, padre e hija caen casi siempre en grupos
   * distintos: sin esta pista la subtarea aparecería suelta y sin contexto.
   */
  detachedParentTitle: string | null;
}

/**
 * Ordena las tareas de un grupo como un árbol: cada subtarea va justo debajo
 * de su padre e indentada. Es la misma lectura que la estructura del proyecto,
 * que es donde el equipo ya sabe buscar "de qué cuelga esto".
 *
 * @param groupTasks tareas del grupo, en el orden que trae el backend.
 * @param allTasks   todas las del equipo, para resolver el título de un padre
 *                   que quedó fuera del grupo.
 */
export function buildTaskRows(groupTasks: ApiTeamTask[], allTasks: ApiTeamTask[]): TaskTreeRow[] {
  const inGroup = new Set(groupTasks.map((t) => t.id));
  const titleById = new Map(allTasks.map((t) => [t.id, t.title]));

  // Hijas cuyo padre también está en el grupo: esas sí se anidan.
  const childrenOf = new Map<string, ApiTeamTask[]>();
  const roots: ApiTeamTask[] = [];
  for (const t of groupTasks) {
    if (t.parent_task_id !== null && inGroup.has(t.parent_task_id)) {
      const siblings = childrenOf.get(t.parent_task_id);
      if (siblings) {
        siblings.push(t);
      } else {
        childrenOf.set(t.parent_task_id, [t]);
      }
    } else {
      roots.push(t);
    }
  }

  const rows: TaskTreeRow[] = [];
  // `seen` corta ciclos: un padre corrupto que apunte a su propia descendencia
  // colgaría el render en vez de mostrar datos incompletos.
  const seen = new Set<string>();

  const walk = (task: ApiTeamTask, depth: number) => {
    if (seen.has(task.id)) {
      return;
    }
    seen.add(task.id);
    rows.push({
      task,
      depth,
      detachedParentTitle:
        depth === 0 && task.parent_task_id !== null
          ? (titleById.get(task.parent_task_id) ?? "otra tarea")
          : null,
    });
    for (const child of childrenOf.get(task.id) ?? []) {
      walk(child, depth + 1);
    }
  };

  roots.forEach((r) => {
    walk(r, 0);
  });
  return rows;
}

/**
 * Poda un árbol plano de filas (de `buildTaskRows`) ocultando las que cuelgan
 * de una tarea plegada. Las filas van en orden DFS con `depth`, así que basta
 * con arrastrar el nivel bajo el que hay que esconder hasta volver a él.
 */
export function visibleRows(rows: TaskTreeRow[], collapsed: Set<string>): TaskTreeRow[] {
  const out: TaskTreeRow[] = [];
  let hideDeeperThan: number | null = null;
  for (const row of rows) {
    if (hideDeeperThan !== null && row.depth > hideDeeperThan) {
      continue;
    }
    hideDeeperThan = null;
    out.push(row);
    if (collapsed.has(row.task.id)) {
      hideDeeperThan = row.depth;
    }
  }
  return out;
}

// ── Agrupación ──────────────────────────────────────────────────────────────

// Solo dos ejes: "¿cómo va Ana?" y "¿qué está en revisión?". La lectura por
// elemento vive ahora en el cronograma, que ya cuelga de la estructura.
export type TaskGrouping = "integrante" | "estado";

export interface TaskGroup {
  /** Identidad estable del grupo (id de usuario o estado). */
  key: string;
  label: string;
  tasks: ApiTeamTask[];
  doneCount: number;
}

const UNASSIGNED_KEY = "__sin_responsable__";

/** Orden del tablero: refleja el recorrido real de una tarea, de izquierda a derecha. */
export const BOARD_STATUSES: ProjectTaskStatus[] = [
  "pendiente_por_iniciar",
  "en_progreso",
  "en_revision",
  "devuelta",
  "completada",
];

function toGroup(key: string, label: string, tasks: ApiTeamTask[]): TaskGroup {
  return {
    key,
    label,
    tasks,
    doneCount: tasks.filter((t) => t.status === "completada").length,
  };
}

function groupByAssignee(tasks: ApiTeamTask[]): TaskGroup[] {
  // Map preserva el orden de inserción; recorremos las tareas ya ordenadas por
  // el backend, así que los integrantes salen en un orden estable entre renders.
  const buckets = new Map<string, ApiTeamTask[]>();
  for (const t of tasks) {
    const key = t.assignee_id ?? UNASSIGNED_KEY;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(t);
    } else {
      buckets.set(key, [t]);
    }
  }
  return [...buckets.entries()].map(([key, items]) =>
    toGroup(key, items[0].assignee_name ?? "Sin responsable", items),
  );
}

/**
 * Por estado devolvemos SIEMPRE las columnas del tablero, incluso vacías: una
 * columna "En revisión" vacía también es información (nadie espera revisión) y
 * evita que el tablero cambie de ancho al mover una tarjeta. "Cancelada" solo
 * aparece si hay alguna: es un estado excepcional.
 */
function groupByStatus(tasks: ApiTeamTask[]): TaskGroup[] {
  const statuses: ProjectTaskStatus[] = [...BOARD_STATUSES];
  if (tasks.some((t) => t.status === "cancelada")) {
    statuses.push("cancelada");
  }
  return statuses.map((status) =>
    toGroup(
      status,
      STATUS_META[status].label,
      tasks.filter((t) => t.status === status),
    ),
  );
}

export function groupTeamTasks(tasks: ApiTeamTask[], grouping: TaskGrouping): TaskGroup[] {
  return grouping === "estado" ? groupByStatus(tasks) : groupByAssignee(tasks);
}

// ── Carga de trabajo ────────────────────────────────────────────────────────

export interface MemberWorkload {
  /** Tareas abiertas (ni completadas ni canceladas) asignadas a la persona. */
  openTasks: number;
  overdueTasks: number;
  /**
   * Carga RELATIVA al integrante más cargado del equipo (0-100). El modelo no
   * guarda capacidad por persona, así que un % absoluto sería inventado: esto
   * responde "¿quién está más cargado?", que es la pregunta real del líder.
   */
  pct: number;
}

export function workloadByMember(
  tasks: ApiTeamTask[],
  memberIds: string[],
  today: string,
): Record<string, MemberWorkload> {
  const open: Record<string, number> = {};
  const overdue: Record<string, number> = {};
  for (const id of memberIds) {
    open[id] = 0;
    overdue[id] = 0;
  }

  for (const t of tasks) {
    const id = t.assignee_id;
    // Ignoramos tareas de gente que ya no está en el equipo: la lista de
    // integrantes es la fuente de verdad de quién aparece.
    if (id === null || !(id in open) || !isOpen(t)) {
      continue;
    }
    open[id] += 1;
    if (isOverdue(t, today)) {
      overdue[id] += 1;
    }
  }

  const busiest = Math.max(0, ...Object.values(open));
  const result: Record<string, MemberWorkload> = {};
  for (const id of memberIds) {
    result[id] = {
      openTasks: open[id],
      overdueTasks: overdue[id],
      pct: busiest === 0 ? 0 : Math.round((open[id] / busiest) * 100),
    };
  }
  return result;
}

// ── Rendimiento por integrante ──────────────────────────────────────────────

export interface MemberPerformance {
  userId: string;
  /** Tareas asignadas a la persona, sin contar las canceladas. */
  total: number;
  completed: number;
  /** Abiertas y ya vencidas: la señal de "va atrasado". */
  overdue: number;
  /** Abiertas (ni completadas ni canceladas). */
  open: number;
  inReview: number;
  /** completed / total (0-100). "Quién va mejor" se lee de aquí. */
  completionPct: number;
}

/**
 * Métricas por persona para el gráfico de rendimiento del equipo. A diferencia
 * de `workloadByMember` (solo carga abierta), aquí importa lo YA hecho y lo
 * atrasado, para comparar integrantes entre sí.
 */
export function performanceByMember(
  tasks: ApiTeamTask[],
  memberIds: string[],
  today: string,
): Record<string, MemberPerformance> {
  const acc: Record<string, MemberPerformance> = {};
  for (const id of memberIds) {
    acc[id] = {
      userId: id,
      total: 0,
      completed: 0,
      overdue: 0,
      open: 0,
      inReview: 0,
      completionPct: 0,
    };
  }

  for (const t of tasks) {
    const id = t.assignee_id;
    if (id === null || !(id in acc) || t.status === "cancelada") {
      continue;
    }
    const m = acc[id];
    m.total += 1;
    if (t.status === "completada") {
      m.completed += 1;
      continue;
    }
    m.open += 1;
    if (t.status === "en_revision") {
      m.inReview += 1;
    }
    if (isOverdue(t, today)) {
      m.overdue += 1;
    }
  }

  for (const id of memberIds) {
    const m = acc[id];
    m.completionPct = m.total === 0 ? 0 : Math.round((m.completed / m.total) * 100);
  }
  return acc;
}

/** Verde <60, ámbar 60-84, rojo ≥85 — los umbrales del diseño de referencia. */
export function workloadBarClass(pct: number): string {
  if (pct >= 85) {
    return "bg-rose-500";
  }
  if (pct >= 60) {
    return "bg-amber-500";
  }
  return "bg-emerald-500";
}
