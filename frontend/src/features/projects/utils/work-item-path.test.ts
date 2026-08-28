import { describe, it, expect } from "vitest";
import { collectItemPaths } from "./work-item-path";
import type { WorkItemTree } from "../types/api.types";

const node = (id: string, nombre: string, children: WorkItemTree[] = []): WorkItemTree =>
  ({ id, nombre, children }) as WorkItemTree;

describe("collectItemPaths", () => {
  it("devuelve la ruta raíz→nodo de cada elemento en una sola pasada", () => {
    const tree = [
      node("f", "Facultad", [
        node("m", "Módulo 2", [node("u", "Unidad 3")]),
        node("m2", "Módulo 3"),
      ]),
    ];
    const paths = collectItemPaths(tree);

    expect(paths.get("f")).toEqual(["Facultad"]);
    expect(paths.get("m")).toEqual(["Facultad", "Módulo 2"]);
    expect(paths.get("u")).toEqual(["Facultad", "Módulo 2", "Unidad 3"]);
    expect(paths.get("m2")).toEqual(["Facultad", "Módulo 3"]);
  });

  it("no comparte el array de rastro entre ramas hermanas", () => {
    const paths = collectItemPaths([node("r", "R", [node("a", "A"), node("b", "B")])]);
    expect(paths.get("a")).toEqual(["R", "A"]);
    expect(paths.get("b")).toEqual(["R", "B"]);
  });
});
