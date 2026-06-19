import type { Task, TaskStatus } from "../types/api.types";
import { isOverdue } from "./metrics";

export interface GanttFilters {
  /** Estados activos: una tarea se muestra si su estado está en el conjunto. */
  statuses: Set<TaskStatus>;
  /** Responsable a filtrar (null = todos). */
  assigneeId: string | null;
  /** Mostrar solo tareas en riesgo (vencidas y abiertas). */
  onlyAtRisk: boolean;
}

/**
 * Filtra las tareas del cronograma por estado, responsable y riesgo. Pura: sin
 * React ni red, fácil de testear y de razonar.
 */
export function filterGanttTasks<T extends Pick<Task, "status" | "assignee_id" | "due_date">>(
  tasks: T[],
  filters: GanttFilters,
  today: string,
): T[] {
  return tasks.filter((task) => {
    if (!filters.statuses.has(task.status)) {
      return false;
    }
    if (filters.assigneeId && task.assignee_id !== filters.assigneeId) {
      return false;
    }
    if (filters.onlyAtRisk && !isOverdue(task, today)) {
      return false;
    }
    return true;
  });
}
