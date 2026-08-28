import type { WorkItemTree } from "../types/api.types";

/**
 * Ruta de nombres de cada elemento de la estructura, de la raíz hasta él mismo
 * (`["Facultad", "Módulo 2", "Unidad 3"]`). Se construye en UNA pasada
 * arrastrando el rastro de ancestros hacia abajo, en vez de guardar el padre de
 * cada nodo y volver a subir por cada tarea al pintarla.
 */
export function collectItemPaths(
  nodes: WorkItemTree[],
  trail: readonly string[] = [],
  into = new Map<string, string[]>(),
): Map<string, string[]> {
  for (const node of nodes) {
    const path = [...trail, node.nombre];
    into.set(node.id, path);
    collectItemPaths(node.children, path, into);
  }
  return into;
}
