import type { DashboardTaskItem } from "../types";

/** Tareas pendientes de una persona en un proyecto concreto. */
export interface MyProjectTasks {
  projectId: string | null;
  projectName: string;
  tasks: DashboardTaskItem[];
  /** Cuántas están vencidas respecto de hoy: ordena y tiñe la tarjeta. */
  overdue: number;
}

// Estados que ya no requieren trabajo: no son "pendientes" de nadie.
const DONE_STATUSES = new Set(["completada", "cancelada"]);

/**
 * Agrupa las tareas asignadas a una persona por proyecto, dejando fuera las
 * que ya están cerradas.
 *
 * La vista de una persona mezcla tareas de varios proyectos, y en una lista
 * plana no se distingue "tengo tres cosas de un proyecto" de "tengo una de
 * tres proyectos distintos" —que es justo lo que decide por dónde empezar—.
 *
 * Orden: primero los proyectos con tareas vencidas (y más vencidas antes), y a
 * igualdad, más tareas primero. Dentro de cada proyecto, por fecha de fin.
 */
export function groupMyTasksByProject(tasks: DashboardTaskItem[], today: string): MyProjectTasks[] {
  const groups = new Map<string, MyProjectTasks>();

  for (const task of tasks) {
    if (DONE_STATUSES.has(task.status)) {
      continue;
    }
    // Sin proyecto identificable, todas caen en el mismo grupo (no inventamos
    // uno por tarea): el nombre es lo único que la persona puede reconocer.
    const key = task.project_id ?? task.project_name ?? "__sin_proyecto__";
    const group = groups.get(key) ?? {
      projectId: task.project_id,
      projectName: task.project_name ?? "Sin proyecto",
      tasks: [],
      overdue: 0,
    };
    group.tasks.push(task);
    // Sin fecha límite no es "vencida": no cuenta como atrasada.
    if (task.due_date !== null && task.due_date < today) {
      group.overdue += 1;
    }
    groups.set(key, group);
  }

  const result = [...groups.values()];
  for (const group of result) {
    // Por fecha de fin ascendente; las tareas sin fecha van al final.
    group.tasks.sort((a, b) =>
      (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31"),
    );
  }
  return result.sort((a, b) => b.overdue - a.overdue || b.tasks.length - a.tasks.length);
}
