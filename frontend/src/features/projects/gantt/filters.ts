import type { Task, TaskStatus, UserPosition } from "../types/api.types";
import { taskRisk } from "../utils/task-dates";

export interface GanttFilters {
  /** Estados activos: una tarea se muestra si su estado está en el conjunto. */
  statuses: Set<TaskStatus>;
  /** Responsable a filtrar (null = todos). */
  assigneeId: string | null;
  /** Equipo delegado a filtrar (null = todos). */
  teamId: string | null;
  /** Cargo/responsabilidad a filtrar (null = todos). Requiere `positionByUser`. */
  position: UserPosition | null;
  /** Mostrar solo tareas en riesgo (abiertas, vencidas o por vencer). */
  onlyAtRisk: boolean;
}

/**
 * Filtra las tareas del cronograma por estado, responsable, equipo, cargo y
 * riesgo. Pura: sin React ni red, fácil de testear y de razonar.
 */
export function filterGanttTasks<
  T extends Pick<Task, "status" | "assignee_id" | "team_id" | "due_date">,
>(
  tasks: T[],
  filters: GanttFilters,
  today: string,
  positionByUser = new Map<string, UserPosition>(),
): T[] {
  return tasks.filter((task) => {
    if (!filters.statuses.has(task.status)) {
      return false;
    }
    if (filters.assigneeId && task.assignee_id !== filters.assigneeId) {
      return false;
    }
    if (filters.teamId && task.team_id !== filters.teamId) {
      return false;
    }
    if (filters.position) {
      // Sin responsable no podemos derivar cargo → excluir cuando el filtro está activo.
      if (!task.assignee_id) {
        return false;
      }
      if (positionByUser.get(task.assignee_id) !== filters.position) {
        return false;
      }
    }
    if (filters.onlyAtRisk && taskRisk(task, today) === null) {
      return false;
    }
    return true;
  });
}
