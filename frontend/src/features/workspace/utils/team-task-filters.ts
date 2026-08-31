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
}

export const EMPTY_TEAM_TASK_FILTERS: TeamTaskFilters = {
  text: "",
  status: "all",
  assignee: "all",
  onlyBlocked: false,
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

export function filterTeamTasks(tasks: ApiTeamTask[], filters: TeamTaskFilters): ApiTeamTask[] {
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
  return n;
}
