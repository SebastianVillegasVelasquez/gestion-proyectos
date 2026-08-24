// Helpers de drag & drop del árbol de estructura, compartidos entre el panel
// de Estructura y el panel izquierdo del Gantt: ambos recolocan nodos sobre
// el mismo árbol (WorkItemTree) y deben resolver ciclos/orden igual.
import type { WorkItemTree } from "../types/api.types";

/** Zona de suelta dentro de una fila: reordenar como hermano (antes/después) o
 * anidar dentro del nodo destino. */
export type DropPos = "before" | "inside" | "after";

/** Deriva la zona de suelta según dónde cae el puntero en la fila destino:
 * tercio superior = antes, inferior = después, centro = dentro. */
export function dropPosFromEvent(e: { clientY: number; currentTarget: Element }): DropPos {
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  if (y < rect.height * 0.3) {
    return "before";
  }
  if (y > rect.height * 0.7) {
    return "after";
  }
  return "inside";
}

/** Encuentra un nodo por id en el árbol (DFS). */
export function findNode(nodes: WorkItemTree[], id: string): WorkItemTree | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const found = findNode(node.children, id);
    if (found) {
      return found;
    }
  }
  return null;
}

/** Ids del nodo y todos sus descendientes: destinos inválidos para soltarlo
 * (no puede anidarse dentro de sí mismo ni de un descendiente → ciclo). */
export function subtreeIds(node: WorkItemTree, acc = new Set<string>()): Set<string> {
  acc.add(node.id);
  for (const child of node.children) {
    subtreeIds(child, acc);
  }
  return acc;
}

export interface MovePayload {
  new_parent_id: string | null;
  orden?: number;
}

/** Resuelve el payload de `/work-items/:id/move` a partir de dónde se soltó el
 * nodo arrastrado, igual que lo calcula el backend (índice EXCLUYENDO al
 * movido), para que antes/después/dentro caigan en la posición exacta. */
export function computeMovePayload(
  tree: WorkItemTree[],
  itemId: string,
  targetId: string,
  pos: DropPos,
): MovePayload | null {
  const target = findNode(tree, targetId);
  if (!target) {
    return null;
  }
  if (pos === "inside") {
    return { new_parent_id: targetId };
  }
  const parentId = target.parent_id ?? null;
  const siblings = (parentId ? (findNode(tree, parentId)?.children ?? []) : tree).filter(
    (s) => s.id !== itemId,
  );
  let index = siblings.findIndex((s) => s.id === targetId);
  if (index < 0) {
    index = siblings.length;
  }
  if (pos === "after") {
    index += 1;
  }
  return { new_parent_id: parentId, orden: index };
}
