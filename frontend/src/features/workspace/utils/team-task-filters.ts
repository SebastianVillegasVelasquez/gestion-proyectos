import type { ApiTeamTask, ProjectTaskStatus } from "../api/workspace.api";

/** Centinela para "tareas sin responsable" en el filtro por responsable. */
export const UNASSIGNED = "__unassigned__";

export interface TeamTaskFilters {
  /** Búsqueda por título (insensible a mayúsculas). */
  text: string;
  status: ProjectTaskStatus | "all";
  /** assignee_id, el centinela UNASSIGNED, o "all". */
  assignee: string;
  /** Solo tareas con una dependencia sin completar. */
  onlyBlocked: boolean;
  /**
   * Filtro por ELEMENTO padre: `work_item_id` exacto del elemento de la
   * estructura del que cuelga la tarea, o "all". Sirve para aislar las tareas de
   * un componente concreto cuando hay varios con el mismo nombre (p. ej. tras
   * clonar una rama).
   */
  elementId: string;
  /**
   * Filtro por RAMA (el "padre del padre" y más arriba): id de un elemento
   * ANCESTRO. Se conservan las tareas cuyo elemento es ese ancestro o cuelga de
   * él a cualquier profundidad. Es lo que separa "las tareas del original" de
   * "las tareas del clon" cuando el nombre del elemento inmediato coincide.
   */
  branchId: string;
}

export const EMPTY_TEAM_TASK_FILTERS: TeamTaskFilters = {
  text: "",
  status: "all",
  assignee: "all",
  onlyBlocked: false,
  elementId: "all",
  branchId: "all",
};

/**
 * Filtros con los que ABRE la vista de tareas del equipo: solo las tareas sin
 * asignar (la "bolsa" del equipo). Es lo primero que el líder necesita ver —
 * qué falta por repartir— y no el trabajo ya en curso de cada integrante.
 */
export const DEFAULT_TEAM_TASK_FILTERS: TeamTaskFilters = {
  ...EMPTY_TEAM_TASK_FILTERS,
  assignee: UNASSIGNED,
};

/**
 * Resuelve, para un `work_item_id`, el conjunto de sus ancestros en la
 * estructura INCLUYÉNDOSE a sí mismo. Lo arma la vista a partir del árbol del
 * proyecto y lo pasa aquí para poder filtrar por rama sin re-recorrer el árbol.
 */
export type AncestorResolver = (workItemId: string | null) => ReadonlySet<string>;

const EMPTY_SET: ReadonlySet<string> = new Set();

export function filterTeamTasks(
  tasks: ApiTeamTask[],
  filters: TeamTaskFilters,
  ancestorsOf: AncestorResolver = () => EMPTY_SET,
): ApiTeamTask[] {
  const needle = filters.text.trim().toLowerCase();
  return tasks.filter((t) => {
    if (needle && !t.title.toLowerCase().includes(needle)) {
      return false;
    }
    if (filters.status !== "all" && t.status !== filters.status) {
      return false;
    }
    if (filters.assignee === UNASSIGNED) {
      if (t.assignee_id !== null) {
        return false;
      }
    } else if (filters.assignee !== "all" && t.assignee_id !== filters.assignee) {
      return false;
    }
    if (filters.onlyBlocked && !t.blocked_by.some((b) => b.status !== "completada")) {
      return false;
    }
    if (filters.elementId !== "all" && t.work_item_id !== filters.elementId) {
      return false;
    }
    if (filters.branchId !== "all" && !ancestorsOf(t.work_item_id).has(filters.branchId)) {
      return false;
    }
    return true;
  });
}

export function activeTeamTaskFilterCount(filters: TeamTaskFilters): number {
  let n = 0;
  if (filters.text.trim()) {
    n += 1;
  }
  if (filters.status !== "all") {
    n += 1;
  }
  if (filters.assignee !== "all") {
    n += 1;
  }
  if (filters.onlyBlocked) {
    n += 1;
  }
  if (filters.elementId !== "all") {
    n += 1;
  }
  if (filters.branchId !== "all") {
    n += 1;
  }
  return n;
}
