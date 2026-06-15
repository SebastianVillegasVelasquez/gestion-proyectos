import type { ProjectNode } from "@/features/projects/types/api.types";

export interface NodeTreeItem extends ProjectNode {
  children: NodeTreeItem[];
  depth: number;
}

/** Construye un árbol a partir de la lista plana de nodos (por parent_id). */
export function buildNodeTree(nodes: ProjectNode[]): NodeTreeItem[] {
  const byId = new Map<string, NodeTreeItem>();
  for (const node of nodes) {
    byId.set(node.id, { ...node, children: [], depth: 0 });
  }

  const roots: NodeTreeItem[] = [];
  for (const item of byId.values()) {
    if (item.parent_id && byId.has(item.parent_id)) {
      const parent = byId.get(item.parent_id)!;
      item.depth = parent.depth + 1;
      parent.children.push(item);
    } else {
      roots.push(item);
    }
  }

  // Propagar depth correctamente tras el armado (los hijos pudieron procesarse
  // antes que su padre, dejando depth desactualizado).
  const fix = (item: NodeTreeItem, depth: number) => {
    item.depth = depth;
    item.children.forEach((c) => {
      fix(c, depth + 1);
    });
  };
  roots.forEach((r) => {
    fix(r, 0);
  });

  return roots;
}

/** Aplana un árbol en orden de profundidad (para render lineal con indentación). */
export function flattenTree(roots: NodeTreeItem[]): NodeTreeItem[] {
  const out: NodeTreeItem[] = [];
  const walk = (item: NodeTreeItem) => {
    out.push(item);
    item.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}
