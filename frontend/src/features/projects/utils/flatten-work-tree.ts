import type { WorkItemTree } from "../types/api.types";

/** Aplana el árbol a una lista con profundidad, para selectores de elemento. */
export function flattenWorkTree(nodes: WorkItemTree[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: `${"  ".repeat(depth)}${depth > 0 ? "└ " : ""}${n.nombre}` },
    ...flattenWorkTree(n.children, depth + 1),
  ]);
}

/**
 * Ruta legible de un elemento ("Curso / Módulo 2 / Unidad 3"), o `null` si no
 * hay elemento o ya no existe en el árbol.
 *
 * Lo que identifica a un elemento no es su nombre —hay quince "Unidad 3" en un
 * proyecto— sino de dónde cuelga, así que allí donde solo cabe una línea de
 * texto se enseña la ruta entera y no el nombre suelto.
 */
export function workItemPath(nodes: WorkItemTree[], id: string | null): string | null {
  if (!id) {
    return null;
  }
  const walk = (items: WorkItemTree[], trail: string[]): string | null => {
    for (const item of items) {
      const path = [...trail, item.nombre];
      if (item.id === id) {
        return path.join(" / ");
      }
      const found = walk(item.children, path);
      if (found) {
        return found;
      }
    }
    return null;
  };
  return walk(nodes, []);
}
