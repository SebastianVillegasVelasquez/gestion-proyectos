import { describe, it, expect } from "vitest";
import { findNode, subtreeIds, computeMovePayload } from "./work-tree-dnd";
import type { WorkItemTree } from "../types/api.types";

function node(
  id: string,
  children: WorkItemTree[] = [],
  parent_id: string | null = null,
): WorkItemTree {
  return {
    id,
    proyecto_id: "p1",
    parent_id,
    tipo_id: "t1",
    nombre: id,
    orden: 0,
    prioridad: null,
    fecha_inicio_plan: null,
    fecha_fin_plan: null,
    duracion_valor: null,
    duracion_unidad: null,
    fecha_inicio_real: null,
    fecha_fin_real: null,
    porcentaje_completado: null,
    es_transversal: false,
    advertencia_fechas: false,
    children,
  };
}

// Árbol:
// A
//  ├─ B
//  └─ C
// D
function buildTree(): WorkItemTree[] {
  const b = node("B", [], "A");
  const c = node("C", [], "A");
  const a = node("A", [b, c], null);
  const d = node("D", [], null);
  return [a, d];
}

describe("findNode", () => {
  it("finds a nested node by id", () => {
    const tree = buildTree();
    expect(findNode(tree, "B")?.id).toBe("B");
    expect(findNode(tree, "D")?.id).toBe("D");
  });

  it("returns null when the id is not in the tree", () => {
    expect(findNode(buildTree(), "nope")).toBeNull();
  });
});

describe("subtreeIds", () => {
  it("collects a node and all of its descendants", () => {
    const tree = buildTree();
    const a = findNode(tree, "A")!;
    const ids = subtreeIds(a);
    expect(ids).toEqual(new Set(["A", "B", "C"]));
  });

  it("returns just the node id for a leaf", () => {
    const tree = buildTree();
    const d = findNode(tree, "D")!;
    expect(subtreeIds(d)).toEqual(new Set(["D"]));
  });
});

describe("computeMovePayload", () => {
  it("reparents inside the target node", () => {
    const tree = buildTree();
    const payload = computeMovePayload(tree, "D", "A", "inside");
    expect(payload).toEqual({ new_parent_id: "A" });
  });

  it("moves a child of one parent into another parent's children (before)", () => {
    const tree = buildTree();
    // Mover D antes de B (hijo de A): D pasa a ser hijo de A, en el índice de B.
    const payload = computeMovePayload(tree, "D", "B", "before");
    expect(payload).toEqual({ new_parent_id: "A", orden: 0 });
  });

  it("moves a nested child to become a sibling after another nested child", () => {
    const tree = buildTree();
    // Mover B después de C: sigue siendo hijo de A, pero al final.
    const payload = computeMovePayload(tree, "B", "C", "after");
    expect(payload).toEqual({ new_parent_id: "A", orden: 1 });
  });

  it("moves a child out to the root level, placed after a root sibling", () => {
    const tree = buildTree();
    // Mover B (hijo de A) después de D (raíz): B pasa a ser raíz, al final
    // (la raíz es [A, D]; tras D va el índice 2).
    const payload = computeMovePayload(tree, "B", "D", "after");
    expect(payload).toEqual({ new_parent_id: null, orden: 2 });
  });

  it("returns null when the target does not exist", () => {
    const tree = buildTree();
    expect(computeMovePayload(tree, "B", "missing", "inside")).toBeNull();
  });
});
