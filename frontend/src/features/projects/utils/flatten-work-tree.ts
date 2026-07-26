import type { WorkItemTree } from "../types/api.types";

/** Aplana el árbol a una lista con profundidad, para selectores de elemento. */
export function flattenWorkTree(nodes: WorkItemTree[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: `${"  ".repeat(depth)}${depth > 0 ? "└ " : ""}${n.nombre}` },
    ...flattenWorkTree(n.children, depth + 1),
  ]);
}
