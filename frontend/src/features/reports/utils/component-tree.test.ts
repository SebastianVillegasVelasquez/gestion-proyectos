import { describe, it, expect } from "vitest";
import type { ComponentStats } from "../api/analytics.api";
import {
  DEFAULT_CRITERIA,
  countByState,
  initialCollapsed,
  matchesCriteria,
  needsFlatList,
  sortComponents,
  visibleTree,
  type ComponentCriteria,
} from "./component-tree";

function row(over: Partial<ComponentStats> & { id: string; name: string }): ComponentStats {
  return {
    parent_id: null,
    tipo_id: null,
    tipo_nombre: "Módulo",
    depth: 0,
    path: [over.name],
    child_count: 0,
    direct_tasks: 0,
    total: 4,
    completed: 1,
    started: 1,
    not_started: 2,
    overdue: 0,
    at_risk: 0,
    completed_pct: 25,
    started_pct: 25,
    progress_pct: 30,
    started_progress_pct: 40,
    state: "en_curso",
    ...over,
  };
}

// Curso ─ Unidad 1 ─ Clase A
//       └ Unidad 2
const TREE: ComponentStats[] = [
  row({ id: "c", name: "Curso", tipo_nombre: "Curso", child_count: 2, state: "atrasada" }),
  row({
    id: "u1",
    name: "Unidad 1",
    parent_id: "c",
    depth: 1,
    path: ["Curso", "Unidad 1"],
    child_count: 1,
    progress_pct: 80,
  }),
  row({
    id: "a",
    name: "Clase A",
    parent_id: "u1",
    depth: 2,
    path: ["Curso", "Unidad 1", "Clase A"],
    tipo_nombre: "Clase",
    state: "completada",
    progress_pct: 100,
  }),
  row({
    id: "u2",
    name: "Unidad 2",
    parent_id: "c",
    depth: 1,
    path: ["Curso", "Unidad 2"],
    total: 0,
    state: "sin_tareas",
    progress_pct: 0,
  }),
];

const criteria = (over: Partial<ComponentCriteria> = {}): ComponentCriteria => ({
  ...DEFAULT_CRITERIA,
  ...over,
});

describe("visibleTree", () => {
  it("shows everything when nothing is collapsed", () => {
    expect(visibleTree(TREE, new Set()).map((r) => r.id)).toEqual(["c", "u1", "a", "u2"]);
  });

  it("hides every descendant of a collapsed branch but keeps its siblings", () => {
    expect(visibleTree(TREE, new Set(["u1"])).map((r) => r.id)).toEqual(["c", "u1", "u2"]);
    expect(visibleTree(TREE, new Set(["c"])).map((r) => r.id)).toEqual(["c"]);
  });

  it("starts with the deep branches folded when asked to keep a depth", () => {
    expect([...initialCollapsed(TREE, 1)]).toEqual(["u1"]);
  });
});

describe("matchesCriteria", () => {
  it("hides components without tasks by default", () => {
    expect(TREE.filter((r) => matchesCriteria(r, criteria())).map((r) => r.id)).toEqual([
      "c",
      "u1",
      "a",
    ]);
    expect(
      TREE.filter((r) => matchesCriteria(r, criteria({ hideEmpty: false }))).map((r) => r.id),
    ).toContain("u2");
  });

  it("filters by state, tipo, depth and by text over the whole path", () => {
    const ids = (c: ComponentCriteria) =>
      TREE.filter((r) => matchesCriteria(r, c)).map((r) => r.id);
    expect(ids(criteria({ states: new Set(["completada"]) }))).toEqual(["a"]);
    expect(ids(criteria({ tipos: new Set(["Clase"]) }))).toEqual(["a"]);
    expect(ids(criteria({ maxDepth: 1 }))).toEqual(["c", "u1"]);
    // El texto busca en la ruta: «unidad 1» trae también a su hija.
    expect(ids(criteria({ query: "unidad 1" }))).toEqual(["u1", "a"]);
  });
});

describe("sortComponents / needsFlatList", () => {
  it("keeps the structure order and sorts a copy otherwise", () => {
    expect(sortComponents(TREE, "estructura")).toBe(TREE);
    const worst = sortComponents(TREE, "menor-avance").map((r) => r.id);
    expect(worst[0]).toBe("u2");
    expect(TREE[0].id).toBe("c"); // la original no se toca
  });

  it("puts overdue components first when sorting by delay", () => {
    expect(sortComponents(TREE, "atraso")[0].id).toBe("c");
  });

  it("asks for a flat list as soon as a filter or a custom sort is active", () => {
    expect(needsFlatList(criteria(), "estructura")).toBe(false);
    expect(needsFlatList(criteria({ query: "x" }), "estructura")).toBe(true);
    expect(needsFlatList(criteria(), "atraso")).toBe(true);
    expect(needsFlatList(criteria({ states: new Set(["en_curso"]) }), "estructura")).toBe(true);
  });
});

describe("countByState", () => {
  it("counts components per state", () => {
    const counts = countByState(TREE);
    expect(counts.atrasada).toBe(1);
    expect(counts.completada).toBe(1);
    expect(counts.sin_tareas).toBe(1);
    expect(counts.en_curso).toBe(1);
  });
});
