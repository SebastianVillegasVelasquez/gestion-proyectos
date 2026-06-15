import { describe, it, expect } from "vitest";
import { cloneSubtree, collectSubtree, removeSubtree, childrenOf } from "./tree-ops";
import type { DraftNode } from "./draft.types";

function node(
  tempId: string,
  parentTempId: string | null,
  phaseTempId: string | null = "ph1",
): DraftNode {
  return {
    tempId,
    name: tempId,
    node_type: "MODULO",
    type_label: "",
    phaseTempId,
    parentTempId,
    end_date: "",
  };
}

// Programa A → Curso 1 → Módulo 1.1 ; Curso 1 → Módulo 1.2
const tree: DraftNode[] = [node("A", null), node("c1", "A"), node("m11", "c1"), node("m12", "c1")];

describe("childrenOf", () => {
  it("returns direct children only", () => {
    expect(childrenOf(tree, "c1").map((n) => n.tempId)).toEqual(["m11", "m12"]);
    expect(childrenOf(tree, null).map((n) => n.tempId)).toEqual(["A"]);
  });
});

describe("collectSubtree", () => {
  it("returns the root plus all descendants", () => {
    expect(collectSubtree(tree, "A").map((n) => n.tempId)).toEqual(["A", "c1", "m11", "m12"]);
    expect(collectSubtree(tree, "c1").map((n) => n.tempId)).toEqual(["c1", "m11", "m12"]);
  });
});

describe("removeSubtree", () => {
  it("removes the node and all its descendants", () => {
    expect(removeSubtree(tree, "c1").map((n) => n.tempId)).toEqual(["A"]);
  });
});

describe("cloneSubtree", () => {
  it("assigns fresh ids and preserves internal parent links", () => {
    let counter = 0;
    const clones = cloneSubtree(tree, "A", {
      newParentTempId: null,
      newPhaseTempId: "ph2",
      genId: () => `new-${(counter += 1)}`,
    });

    // 4 nodes cloned with brand-new ids
    expect(clones).toHaveLength(4);
    expect(clones.every((n) => n.tempId.startsWith("new-"))).toBe(true);

    // Root re-parented and re-phased
    const root = clones[0];
    expect(root.parentTempId).toBeNull();
    expect(clones.every((n) => n.phaseTempId === "ph2")).toBe(true);

    // Internal structure preserved: the cloned course points to the cloned root
    const course = clones[1];
    expect(course.parentTempId).toBe(root.tempId);
    // The two modules point to the cloned course
    expect(clones[2].parentTempId).toBe(course.tempId);
    expect(clones[3].parentTempId).toBe(course.tempId);
  });

  it("attaches the clone under a given parent", () => {
    const clones = cloneSubtree(tree, "c1", {
      newParentTempId: "other-root",
      newPhaseTempId: "ph1",
      genId: (() => {
        let c = 0;
        return () => `x${(c += 1)}`;
      })(),
    });
    expect(clones[0].parentTempId).toBe("other-root");
  });
});
