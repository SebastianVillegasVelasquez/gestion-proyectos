// Helpers de drag & drop del árbol de estructura, compartidos entre el panel
// de Estructura y el panel izquierdo del Gantt: ambos recolocan nodos sobre
// el mismo árbol (WorkItemTree) y deben resolver ciclos/orden igual.
import type { WorkItemTree } from "../types/api.types";

/** Zona de suelta dentro de una fila: reordenar como hermano (antes/después) o
 * anidar dentro del nodo destino. */
export type DropPos = "before" | "inside" | "after";

/** Alto relativo de las bandas "antes"/"después" en los bordes de la fila. El
 * resto (la mitad central) anida DENTRO del destino.
 *
 * Anidar es la operación difícil de acertar —hay que caer justo en el centro de
 * una fila de ~44px—, mientras que reordenar entre hermanos también se consigue
 * soltando sobre la fila vecina. Por eso la banda de anidado es la ancha. */
const DROP_EDGE_RATIO = 0.25;

/** Deriva la zona de suelta según dónde cae el puntero en la fila destino:
 * borde superior = antes, borde inferior = después, centro = dentro. */
export function dropPosFromEvent(e: { clientY: number; currentTarget: Element }): DropPos {
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  if (y < rect.height * DROP_EDGE_RATIO) {
    return "before";
  }
  if (y > rect.height * (1 - DROP_EDGE_RATIO)) {
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

/** Movimiento para sacar un elemento un nivel hacia afuera: pasa a ser hermano
 * de quien lo contenía, colocado justo detrás de él.
 *
 * Es la salida rápida cuando algo acaba dentro de la rama equivocada: sin esto
 * habría que arrastrarlo hasta un destino concreto, que es incómodo justo
 * cuando la estructura es grande (que es cuando pasa). Devuelve null si ya está
 * en el nivel principal: ahí no hay nivel del que salir.
 */
export function computeOutdentPayload(tree: WorkItemTree[], itemId: string): MovePayload | null {
  const item = findNode(tree, itemId);
  if (item?.parent_id == null) {
    return null;
  }
  const parent = findNode(tree, item.parent_id);
  if (!parent) {
    return null;
  }
  const grandParentId = parent.parent_id ?? null;
  const siblings = (grandParentId ? (findNode(tree, grandParentId)?.children ?? []) : tree).filter(
    (s) => s.id !== itemId,
  );
  const parentIndex = siblings.findIndex((s) => s.id === parent.id);
  // Justo DETRÁS de su antiguo contenedor: es donde se espera encontrarlo tras
  // sacarlo, en vez de al final de una lista larga.
  const index = parentIndex < 0 ? siblings.length : parentIndex + 1;
  return { new_parent_id: grandParentId, orden: index };
}

/** Resultado de intentar soltar: o hay un movimiento que pedirle al backend, o
 * hay un motivo que explicarle a quien arrastró. */
export type DropDecision =
  | { ok: true; payload: MovePayload }
  | { ok: false; reason: string }
  | null;

/** Decide qué hacer al soltar `draggedId` sobre `targetId`.
 *
 * Vive aquí (y no en cada panel) porque la Estructura y el Gantt muestran el
 * mismo árbol y deben rechazar exactamente los mismos movimientos: si las
 * reglas se duplican, tarde o temprano una de las dos vistas deja pasar algo
 * que la otra bloquea.
 *
 * Se rechaza un único caso: meter un elemento dentro de sí mismo o de alguno de
 * sus descendientes, porque desconectaría esa rama del árbol (el padre pasaría
 * a colgar de su propio hijo). Cualquier otro movimiento está permitido: no
 * miramos tipos ni profundidad.
 */
export function resolveDrop(
  tree: WorkItemTree[],
  draggedId: string,
  targetId: string,
  pos: DropPos,
): DropDecision {
  const dragged = findNode(tree, draggedId);
  const target = findNode(tree, targetId);
  if (!dragged || !target) {
    return null;
  }
  if (draggedId === targetId) {
    return null;
  }

  const forbidden = subtreeIds(dragged);
  // Anidar dentro del propio subárbol.
  if (forbidden.has(targetId)) {
    return { ok: false, reason: cycleReason(dragged, target) };
  }
  // Colocarse como hermano de un nodo cuyo padre está dentro del subárbol
  // movido: el destino real seguiría siendo un descendiente propio.
  const parentId = target.parent_id ?? null;
  if (pos !== "inside" && parentId != null && forbidden.has(parentId)) {
    const parent = findNode(tree, parentId);
    return { ok: false, reason: cycleReason(dragged, parent ?? target) };
  }

  const payload = computeMovePayload(tree, draggedId, targetId, pos);
  return payload ? { ok: true, payload } : null;
}

function cycleReason(dragged: WorkItemTree, target: WorkItemTree): string {
  return (
    `No se puede mover «${dragged.nombre}» dentro de «${target.nombre}»: ` +
    `es parte de su propio contenido.`
  );
}
