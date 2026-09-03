import type { ApiMyTask, ApiWorkItemCrumb } from "../api/personal.api";

export interface ElementOption extends ApiWorkItemCrumb {
  /** Cuántas tareas cuelgan de este elemento o de algo dentro de él. */
  count: number;
}

/**
 * Los elementos que aparecen en las tareas dadas, cada uno con las tareas que
 * cuelgan de él o de su subárbol. Se recorre la cadena RAÍZ→elemento completa
 * (no solo el elemento hoja) para que filtrar por una rama traiga todo lo que
 * hay debajo, que es como se lee la estructura.
 */
export function elementOptionsFrom(tasks: ApiMyTask[]): ElementOption[] {
  const byId = new Map<string, ElementOption>();
  for (const task of tasks) {
    for (const crumb of task.work_item_ancestors) {
      const found = byId.get(crumb.id);
      if (found) {
        found.count += 1;
      } else {
        byId.set(crumb.id, { ...crumb, count: 1 });
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
