import type { ApiTeamTask } from "../api/workspace.api";

export interface NestedTask {
  task: ApiTeamTask;
  children: ApiTeamTask[];
}

/**
 * Convierte una lista plana de tareas del equipo en tareas raíz con sus
 * subtareas hijas (dos niveles). Ignora la profundidad más allá: en el
 * workspace, el líder reparte una tarea general en subtareas concretas,
 * un árbol más profundo no aporta valor y complica la lectura.
 *
 * Puro y O(n): construye un índice por id y hace una sola pasada.
 */
export function nestTasks(tasks: ApiTeamTask[]): NestedTask[] {
  const byId = new Map<string, NestedTask>();
  const roots: NestedTask[] = [];

  // Primero indexamos las tareas raíz (parent_task_id === null). Si una
  // subtarea aparece antes que su padre en la lista, aún así la ubicamos bien.
  for (const t of tasks) {
    if (t.parent_task_id === null) {
      const node = { task: t, children: [] as ApiTeamTask[] };
      byId.set(t.id, node);
      roots.push(node);
    }
  }
  for (const t of tasks) {
    if (t.parent_task_id !== null) {
      const parent = byId.get(t.parent_task_id);
      // Si el padre no está en esta vista (raro: filtro por equipo) la
      // subtarea se promueve a raíz para no perderla.
      if (parent) {
        parent.children.push(t);
      } else {
        roots.push({ task: t, children: [] });
      }
    }
  }
  return roots;
}
