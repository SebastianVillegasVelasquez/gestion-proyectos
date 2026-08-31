/**
 * Reordenar tareas entre hermanas (misma ubicación en el árbol y misma tarea
 * padre). Es la "prioridad / orden de cumplimiento" que se fija a mano; no
 * tiene nada que ver con las fechas.
 *
 * El backend (`PATCH /tasks/{id}/reorder`) recibe un `after_id`: la hermana
 * tras la cual queda la tarea, o `null` para dejarla primera. Estas funciones
 * calculan ese `after_id` a partir de la lista de hermanas ya ordenada por
 * `orden`.
 */

export interface Reorderable {
  id: string;
  work_item_id: string | null;
  parent_task_id: string | null;
  orden: number;
}

/** Un árbol de tareas: la tarea y sus subtareas, ya ordenadas por `orden`. */
export interface TaskNode<T extends Reorderable = Reorderable> {
  task: T;
  children: TaskNode<T>[];
}

/**
 * Arma el bosque de tareas de un elemento a partir de su lista plana.
 *
 * - Las subtareas (`parent_task_id` apuntando a otra tarea de la lista) cuelgan
 *   de su madre; el resto son raíces.
 * - `excludeId` saca una tarea del bosque (típicamente la que ES el elemento):
 *   sus subtareas quedan como raíces y se siguen distinguiendo como subtareas
 *   porque conservan su `parent_task_id`.
 * - Todo nivel va ordenado por `orden` (la prioridad / orden de cumplimiento).
 */
export function buildTaskForest<T extends Reorderable>(
  tasks: T[],
  excludeId?: string,
): TaskNode<T>[] {
  const alive = tasks.filter((t) => t.id !== excludeId);
  const byId = new Map(alive.map((t) => [t.id, t]));
  const childrenOf = new Map<string, T[]>();
  const roots: T[] = [];

  for (const t of alive) {
    if (t.parent_task_id && byId.has(t.parent_task_id)) {
      const bucket = childrenOf.get(t.parent_task_id);
      if (bucket) {
        bucket.push(t);
      } else {
        childrenOf.set(t.parent_task_id, [t]);
      }
    } else {
      roots.push(t);
    }
  }

  const byOrden = (a: T, b: T) => a.orden - b.orden;
  const build = (t: T): TaskNode<T> => ({
    task: t,
    children: [...(childrenOf.get(t.id) ?? [])].sort(byOrden).map(build),
  });
  return [...roots].sort(byOrden).map(build);
}

/** Las hermanas de `task` (ella incluida), ordenadas por `orden`. Hermanas =
 * mismo `work_item_id` y mismo `parent_task_id`. */
export function siblingsOf<T extends Reorderable>(task: T, all: T[]): T[] {
  return all
    .filter((t) => t.work_item_id === task.work_item_id && t.parent_task_id === task.parent_task_id)
    .sort((a, b) => a.orden - b.orden);
}

/** `after_id` para subir `task` una posición. `undefined` = ya es la primera
 * (no hay nada que hacer); `null` = debe quedar la primera. */
export function moveUpAfterId<T extends Reorderable>(
  task: T,
  siblings: T[],
): string | null | undefined {
  const i = siblings.findIndex((s) => s.id === task.id);
  if (i <= 0) {
    return undefined;
  }
  return i - 2 >= 0 ? siblings[i - 2].id : null;
}

/** `after_id` para bajar `task` una posición. `undefined` = ya es la última. */
export function moveDownAfterId<T extends Reorderable>(task: T, siblings: T[]): string | undefined {
  const i = siblings.findIndex((s) => s.id === task.id);
  if (i === -1 || i >= siblings.length - 1) {
    return undefined;
  }
  return siblings[i + 1].id;
}

/** `after_id` para soltar `dragged` en la posición de `target` (drag & drop
 * dentro de la misma lista de hermanas). `pos` indica si se soltó en la mitad
 * superior ("before") o inferior ("after") de `target`. `null` = al principio.
 * `undefined` = el movimiento no cambia nada. */
export function dropAfterId<T extends Reorderable>(
  dragged: T,
  target: T,
  pos: "before" | "after",
  siblings: T[],
): string | null | undefined {
  if (dragged.id === target.id) {
    return undefined;
  }
  const withoutDragged = siblings.filter((s) => s.id !== dragged.id);
  const targetIndex = withoutDragged.findIndex((s) => s.id === target.id);
  if (targetIndex === -1) {
    return undefined;
  }
  const insertIndex = pos === "before" ? targetIndex : targetIndex + 1;
  const afterId = insertIndex === 0 ? null : withoutDragged[insertIndex - 1].id;
  // No-op: ya está justo ahí.
  const currentIndex = siblings.findIndex((s) => s.id === dragged.id);
  if (
    (afterId === null && currentIndex === 0) ||
    (afterId !== null && siblings[currentIndex - 1]?.id === afterId)
  ) {
    return undefined;
  }
  return afterId;
}
