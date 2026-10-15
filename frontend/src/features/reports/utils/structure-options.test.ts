import { describe, it, expect } from "vitest";
import type { WorkItemTree } from "@/features/projects/types/api.types";
import { filterStructure, flattenStructure } from "./structure-options";

function node(id: string, nombre: string, children: WorkItemTree[] = []): WorkItemTree {
  return { id, nombre, children } as WorkItemTree;
}

const TREE = [
  node("c", "Curso de Turismo", [
    node("m1", "Módulo 1", [node("l1", "Lección A")]),
    node("m2", "Módulo 2"),
  ]),
];

describe("flattenStructure", () => {
  it("lists every element, leaves included, in tree order with its path", () => {
    const flat = flattenStructure(TREE);
    expect(flat.map((o) => o.id)).toEqual(["c", "m1", "l1", "m2"]);
    expect(flat[2]).toMatchObject({
      path: ["Curso de Turismo", "Módulo 1", "Lección A"],
      depth: 2,
    });
  });
});

describe("filterStructure", () => {
  const flat = flattenStructure(TREE);

  it("returns everything without text", () => {
    expect(filterStructure(flat, "  ")).toHaveLength(4);
  });

  it("ignores case and accents", () => {
    expect(filterStructure(flat, "modulo").map((o) => o.id)).toEqual(["m1", "l1", "m2"]);
  });

  it("matches against the whole path, every word in any order", () => {
    expect(filterStructure(flat, "leccion modulo 1").map((o) => o.id)).toEqual(["l1"]);
  });
});
