import { describe, it, expect } from "vitest";
import type { Deliverable } from "../types";
import {
  EMPTY_DELIVERABLE_FILTERS,
  activeDeliverableFilterCount,
  filterDeliverables,
} from "./deliverable-filters";

function d(over: Partial<Deliverable>): Deliverable {
  return {
    id: "d",
    taskTitle: "Prototipo",
    assigneeId: "u1",
    taskId: null,
    status: "en_revision",
    versions: [],
    comments: [],
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  };
}

const items = [
  d({ id: "a", taskTitle: "Guion del módulo 1", assigneeId: "u1", status: "borrador" }),
  d({ id: "b", taskTitle: "Montaje final", assigneeId: "u2", status: "aprobado" }),
  d({ id: "c", taskTitle: "Guion del módulo 2", assigneeId: "u2", status: "en_revision" }),
];

describe("filterDeliverables", () => {
  it("sin filtros devuelve todo", () => {
    expect(filterDeliverables(items, EMPTY_DELIVERABLE_FILTERS)).toHaveLength(3);
  });

  it("filtra por texto en el título (insensible a mayúsculas)", () => {
    const r = filterDeliverables(items, { ...EMPTY_DELIVERABLE_FILTERS, text: "GUION" });
    expect(r.map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("filtra por estado", () => {
    const r = filterDeliverables(items, { ...EMPTY_DELIVERABLE_FILTERS, status: "aprobado" });
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });

  it("filtra por responsable y combina con texto", () => {
    const r = filterDeliverables(items, {
      ...EMPTY_DELIVERABLE_FILTERS,
      assignee: "u2",
      text: "guion",
    });
    expect(r.map((x) => x.id)).toEqual(["c"]);
  });

  it("cuenta los filtros activos", () => {
    expect(activeDeliverableFilterCount(EMPTY_DELIVERABLE_FILTERS)).toBe(0);
    expect(activeDeliverableFilterCount({ text: " x ", status: "borrador", assignee: "u1" })).toBe(
      3,
    );
  });
});
