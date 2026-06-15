import { describe, it, expect } from "vitest";
import { buildNodeTree, flattenTree } from "./node-tree";
import type { ProjectNode } from "../types/api.types";

function node(id: string, parent_id: string | null, name = id): ProjectNode {
  return {
    id,
    name,
    node_type: "MODULO",
    project_id: "p1",
    parent_id,
    phase_id: null,
    type_label: null,
    end_date: null,
  };
}

describe("buildNodeTree", () => {
  it("nests children under their parent and assigns depth", () => {
    const tree = buildNodeTree([node("a", null), node("b", "a"), node("c", "b")]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("a");
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children[0].id).toBe("b");
    expect(tree[0].children[0].depth).toBe(1);
    expect(tree[0].children[0].children[0].depth).toBe(2);
  });

  it("treats nodes with missing parent as roots", () => {
    const tree = buildNodeTree([node("a", "ghost")]);
    expect(tree).toHaveLength(1);
    expect(tree[0].depth).toBe(0);
  });

  it("assigns correct depth even when children come before parents", () => {
    const tree = buildNodeTree([node("c", "b"), node("b", "a"), node("a", null)]);
    const flat = flattenTree(tree);
    const depthById = Object.fromEntries(flat.map((n) => [n.id, n.depth]));
    expect(depthById).toEqual({ a: 0, b: 1, c: 2 });
  });
});

describe("flattenTree", () => {
  it("returns nodes in depth-first order", () => {
    const tree = buildNodeTree([node("a", null), node("a1", "a"), node("a2", "a")]);
    expect(flattenTree(tree).map((n) => n.id)).toEqual(["a", "a1", "a2"]);
  });
});
