import type { NodeType } from "@/features/projects/types/api.types";
import type { DraftNode } from "./draft.types";

// Tipo de hijo sugerido al agregar dentro de un nodo (Programa → Curso → Módulo).
// Bajo un Módulo se permite anidar otro Módulo (cortes/unidades flexibles).
export const SUGGESTED_CHILD_TYPE: Record<NodeType, NodeType> = {
  PROGRAMA: "CURSO",
  CURSO: "MODULO",
  MODULO: "MODULO",
};

export function childrenOf(nodes: DraftNode[], parentTempId: string | null): DraftNode[] {
  return nodes.filter((n) => n.parentTempId === parentTempId);
}

/** El nodo raíz más sus descendientes (en orden de aparición). */
export function collectSubtree(nodes: DraftNode[], rootTempId: string): DraftNode[] {
  const result: DraftNode[] = [];
  const walk = (id: string) => {
    const node = nodes.find((n) => n.tempId === id);
    if (!node) {
      return;
    }
    result.push(node);
    nodes
      .filter((n) => n.parentTempId === id)
      .forEach((child) => {
        walk(child.tempId);
      });
  };
  walk(rootTempId);
  return result;
}

/** Devuelve la lista sin el subárbol indicado. */
export function removeSubtree(nodes: DraftNode[], rootTempId: string): DraftNode[] {
  const toRemove = new Set(collectSubtree(nodes, rootTempId).map((n) => n.tempId));
  return nodes.filter((n) => !toRemove.has(n.tempId));
}

/**
 * Clona un subárbol asignando nuevos tempIds. El nodo raíz clonado cuelga de
 * `newParentTempId` y todo el subárbol se reasigna a `newPhaseTempId`.
 * Los enlaces padre-hijo internos se preservan vía el mapa de ids.
 */
export function cloneSubtree(
  nodes: DraftNode[],
  rootTempId: string,
  options: {
    newParentTempId: string | null;
    newPhaseTempId: string | null;
    genId: () => string;
  },
): DraftNode[] {
  const subtree = collectSubtree(nodes, rootTempId);
  const idMap = new Map<string, string>();
  for (const node of subtree) {
    idMap.set(node.tempId, options.genId());
  }

  return subtree.map((node) => ({
    ...node,
    tempId: idMap.get(node.tempId)!,
    phaseTempId: options.newPhaseTempId,
    parentTempId:
      node.tempId === rootTempId
        ? options.newParentTempId
        : (idMap.get(node.parentTempId ?? "") ?? null),
  }));
}
