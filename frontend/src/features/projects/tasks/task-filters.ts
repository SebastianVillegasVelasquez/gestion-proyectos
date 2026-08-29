import type { Task, TaskPriority, TaskStatus, WorkItemTree } from "../types/api.types";
import { collectItemPaths } from "../utils/work-item-path";

/**
 * Filtros de la pantalla de tareas.
 *
 * Van todos en un solo objeto, y no en un `useState` por control, porque casi
 * todos comparten una consecuencia: al cambiar cualquiera hay que volver a la
 * página 1. Con estados sueltos ese reset se olvida en el filtro nuevo; con uno
 * solo se hace en un único sitio (ver `taskFiltersReducer`).
 */
export interface TaskFilters {
  search: string;
  status: TaskStatus | "todos";
  priority: TaskPriority | "todas";
  /** Equipo al que está delegada la tarea. */
  teamId: string | null;
  /** Id de la persona responsable, o el centinela `UNASSIGNED` para aislar lo
   * que no está repartido (ni a persona ni a equipo). */
  assigneeId: string | null;
  /**
   * Elemento de la estructura. Incluye TODO lo que cuelga de él: al elegir un
   * módulo se quiere ver su trabajo entero, no solo las tareas colgadas
   * literalmente del módulo (que suelen ser ninguna).
   */
  locationId: string | null;
  /** Lapso de tiempo, en ISO (YYYY-MM-DD). Extremos incluidos. */
  from: string | null;
  to: string | null;
  page: number;
}

/** Valor especial del filtro de responsable: "sin repartir". Es un centinela y
 * no un `boolean` aparte porque ocupa el mismo hueco de la interfaz que elegir
 * a una persona: son opciones excluyentes del mismo desplegable. */
export const UNASSIGNED = "nadie";

export const EMPTY_TASK_FILTERS: TaskFilters = {
  search: "",
  status: "todos",
  priority: "todas",
  teamId: null,
  assigneeId: null,
  locationId: null,
  from: null,
  to: null,
  page: 1,
};

export type TaskFiltersAction =
  | { type: "set"; change: Partial<Omit<TaskFilters, "page">> }
  | { type: "page"; page: number }
  | { type: "reset" };

/**
 * Cualquier cambio de filtro devuelve a la página 1: si estabas en la página 4
 * y filtras hasta dejar 12 resultados, seguir en la 4 muestra una tabla vacía
 * que parece un error. Solo `page` conserva la paginación, que es su trabajo.
 */
export function taskFiltersReducer(state: TaskFilters, action: TaskFiltersAction): TaskFilters {
  switch (action.type) {
    case "set":
      return { ...state, ...action.change, page: 1 };
    case "page":
      return { ...state, page: action.page };
    case "reset":
      return EMPTY_TASK_FILTERS;
  }
}

/** Cuántos filtros hay puestos (sin contar la paginación). Sirve para decidir
 * si merece la pena ofrecer "limpiar" y para explicar un resultado vacío. */
export function activeFilterCount(filters: TaskFilters): number {
  let count = 0;
  if (filters.search.trim()) {
    count += 1;
  }
  if (filters.status !== "todos") {
    count += 1;
  }
  if (filters.priority !== "todas") {
    count += 1;
  }
  if (filters.teamId) {
    count += 1;
  }
  if (filters.assigneeId) {
    count += 1;
  }
  if (filters.locationId) {
    count += 1;
  }
  if (filters.from ?? filters.to) {
    count += 1;
  }
  return count;
}

/** Ids de un elemento y de todo lo que cuelga de él. */
export function subtreeIds(nodes: WorkItemTree[], rootId: string): Set<string> {
  const ids = new Set<string>();
  const collect = (item: WorkItemTree) => {
    ids.add(item.id);
    item.children.forEach(collect);
  };
  const find = (items: WorkItemTree[]): boolean =>
    items.some((item) => {
      if (item.id === rootId) {
        collect(item);
        return true;
      }
      return find(item.children);
    });
  find(nodes);
  return ids;
}

export interface LocationOption {
  id: string;
  label: string;
  depth: number;
}

/**
 * Elementos que pueden usarse como filtro de ubicación: solo los que CONTIENEN
 * algo. Filtrar por una hoja equivale a filtrar por una sola tarea, así que
 * ofrecerlas convertiría el desplegable en una lista de cientos de entradas sin
 * ganar nada.
 */
export function parentLocationOptions(nodes: WorkItemTree[], depth = 0): LocationOption[] {
  return nodes.flatMap((item) =>
    item.children.length > 0
      ? [
          { id: item.id, label: item.nombre, depth },
          ...parentLocationOptions(item.children, depth + 1),
        ]
      : [],
  );
}

/**
 * ¿Cae la tarea dentro del lapso pedido?
 *
 * Se compara por SOLAPE del intervalo de la tarea con la ventana, no por fecha
 * de vencimiento: una tarea que empieza en agosto y vence en octubre está en
 * marcha durante septiembre, y quien pregunta "qué hay en septiembre" espera
 * verla. Una tarea sin fechas nunca entra en un filtro por fechas: no se sabe
 * cuándo ocurre, y colarla en cualquier ventana sería inventarse el dato.
 */
export function withinRange(task: Task, from: string | null, to: string | null): boolean {
  if (!from && !to) {
    return true;
  }
  const start = task.start_date ?? task.due_date;
  const end = task.due_date ?? task.start_date;
  if (!start || !end) {
    return false;
  }
  if (from && end < from) {
    return false;
  }
  if (to && start > to) {
    return false;
  }
  return true;
}

/** Aplica todos los filtros. Pura: la pantalla solo decide qué pintar. */
export function filterTasks(tasks: Task[], filters: TaskFilters, tree: WorkItemTree[]): Task[] {
  const needle = filters.search.trim().toLowerCase();
  const locationIds = filters.locationId ? subtreeIds(tree, filters.locationId) : null;
  // Con nombres de tarea repetidos (p. ej. "guion de video" ×480), lo que
  // distingue una de otra es su rama: el buscador también mira los ancestros.
  const pathById = needle ? collectItemPaths(tree) : new Map<string, string[]>();

  return tasks.filter((task) => {
    if (needle) {
      const path = task.work_item_id ? (pathById.get(task.work_item_id) ?? []) : [];
      const haystack = `${task.title} ${task.description ?? ""} ${path.join(" ")}`.toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }
    if (filters.status !== "todos" && task.status !== filters.status) {
      return false;
    }
    if (filters.priority !== "todas" && task.priority !== filters.priority) {
      return false;
    }
    if (filters.teamId && task.team_id !== filters.teamId) {
      return false;
    }
    if (filters.assigneeId === UNASSIGNED) {
      if (task.assignee_id ?? task.team_id) {
        return false;
      }
    } else if (filters.assigneeId && task.assignee_id !== filters.assigneeId) {
      return false;
    }
    if (locationIds && !(task.work_item_id && locationIds.has(task.work_item_id))) {
      return false;
    }
    return withinRange(task, filters.from, filters.to);
  });
}

export interface TaskCounters {
  total: number;
  unassigned: number;
  overdue: number;
  inReview: number;
  done: number;
}

/**
 * Cifras de cabecera. Se calculan sobre las tareas YA filtradas: si estás
 * mirando un equipo, "3 vencidas" tiene que ser 3 vencidas de ese equipo, no
 * del proyecto entero — si no, el número contradice lo que se ve debajo.
 */
export function countTasks(tasks: Task[], today: string): TaskCounters {
  let unassigned = 0;
  let overdue = 0;
  let inReview = 0;
  let done = 0;
  for (const task of tasks) {
    if (!task.assignee_id && !task.team_id) {
      unassigned += 1;
    }
    if (task.status === "en_revision") {
      inReview += 1;
    }
    if (task.status === "completada") {
      done += 1;
    }
    // Una tarea cerrada que venció en su día ya no es un problema pendiente.
    const closed = task.status === "completada" || task.status === "cancelada";
    if (!closed && task.due_date && task.due_date < today) {
      overdue += 1;
    }
  }
  return { total: tasks.length, unassigned, overdue, inReview, done };
}
