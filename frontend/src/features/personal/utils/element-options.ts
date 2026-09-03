import type { ApiMyTask, ApiWorkItemCrumb } from "../api/personal.api";

export interface ElementOption extends Omit<ApiWorkItemCrumb, "id"> {
  /** Clave del GRUPO (nombre + tipo), no de un elemento concreto. */
  key: string;
  /** Los elementos reales que caen bajo ese nombre. */
  ids: Set<string>;
  /** Cuántas tareas cuelgan de alguno de ellos (o de su subárbol). */
  count: number;
}

/** Mismo nombre y mismo tipo = misma entrada del filtro. */
function groupKey(crumb: ApiWorkItemCrumb): string {
  return `${crumb.tipo_id ?? ""}|${crumb.name}`;
}

/**
 * Los elementos que aparecen en las tareas dadas, cada uno con las tareas que
 * cuelgan de él o de su subárbol. Se recorre la cadena RAÍZ→elemento completa
 * (no solo el elemento hoja) para que filtrar por una rama traiga todo lo que
 * hay debajo, que es como se lee la estructura.
 *
 * La lista es un CONJUNTO POR NOMBRE, no por id: una estructura repite el mismo
 * elemento en cada rama («Aprobación CTS» bajo cada curso), y veinte entradas
 * idénticas no dejan elegir nada —son indistinguibles a la vista—. Elegir una
 * filtra por TODOS los elementos que comparten nombre y tipo, que es lo que
 * quiere decir quien pide «lo de Aprobación CTS».
 */
export function elementOptionsFrom(tasks: ApiMyTask[]): ElementOption[] {
  const byKey = new Map<string, ElementOption>();
  for (const task of tasks) {
    // Una tarea cuenta UNA vez por grupo aunque su cadena de ancestros repita
    // el nombre (un elemento y su hijo homónimo).
    const counted = new Set<string>();
    for (const crumb of task.work_item_ancestors) {
      const key = groupKey(crumb);
      const found = byKey.get(key);
      if (!found) {
        byKey.set(key, { ...crumb, key, ids: new Set([crumb.id]), count: 1 });
      } else {
        found.ids.add(crumb.id);
        if (!counted.has(key)) {
          found.count += 1;
        }
      }
      counted.add(key);
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** ¿La tarea cuelga del elemento elegido (o de cualquiera de sus homónimos)? */
export function taskMatchesElement(task: ApiMyTask, option: ElementOption): boolean {
  return task.work_item_ancestors.some((a) => option.ids.has(a.id));
}
