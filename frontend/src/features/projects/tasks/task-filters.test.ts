import { describe, it, expect } from "vitest";
import {
  EMPTY_TASK_FILTERS,
  activeFilterCount,
  countTasks,
  filterTasks,
  parentLocationOptions,
  subtreeIds,
  taskFiltersReducer,
  withinRange,
  type TaskFilters,
} from "./task-filters";
import type { Task, WorkItemTree } from "../types/api.types";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    project_id: "p1",
    work_item_id: null,
    parent_task_id: null,
    title: "Tarea",
    description: null,
    status: "pendiente_por_iniciar",
    priority: "media",
    assignee_id: null,
    team_id: null,
    start_date: null,
    due_date: null,
    completed_at: null,
    estimated_hours: null,
    logged_hours: 0,
    ...overrides,
  } as Task;
}

function node(id: string, nombre: string, children: WorkItemTree[] = []): WorkItemTree {
  return {
    id,
    proyecto_id: "p1",
    parent_id: null,
    tipo_id: "tipo-1",
    nombre,
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
  } as WorkItemTree;
}

const tree: WorkItemTree[] = [
  node("curso", "Curso", [
    node("modulo-1", "Módulo 1", [node("unidad-1", "Unidad 1"), node("unidad-2", "Unidad 2")]),
    node("modulo-2", "Módulo 2", [node("unidad-3", "Unidad 3")]),
  ]),
];

function filters(overrides: Partial<TaskFilters> = {}): TaskFilters {
  return { ...EMPTY_TASK_FILTERS, ...overrides };
}

describe("taskFiltersReducer", () => {
  it("returns to page 1 whenever a filter changes", () => {
    const state = { ...EMPTY_TASK_FILTERS, page: 4 };
    expect(taskFiltersReducer(state, { type: "set", change: { search: "guion" } }).page).toBe(1);
  });

  it("keeps the filters when only the page changes", () => {
    const state = filters({ search: "guion", page: 1 });
    const next = taskFiltersReducer(state, { type: "page", page: 3 });
    expect(next).toEqual({ ...state, page: 3 });
  });

  it("clears everything on reset", () => {
    const state = filters({ search: "x", teamId: "team-1", page: 5 });
    expect(taskFiltersReducer(state, { type: "reset" })).toEqual(EMPTY_TASK_FILTERS);
  });
});

describe("activeFilterCount", () => {
  it("ignores the page and counts a date range as one filter", () => {
    expect(activeFilterCount(filters({ page: 7 }))).toBe(0);
    expect(activeFilterCount(filters({ from: "2026-09-01", to: "2026-09-30" }))).toBe(1);
    expect(activeFilterCount(filters({ search: "  " }))).toBe(0);
    expect(activeFilterCount(filters({ search: "guion", teamId: "t" }))).toBe(2);
  });
});

describe("subtreeIds", () => {
  it("includes the element itself and everything under it", () => {
    expect([...subtreeIds(tree, "modulo-1")].sort()).toEqual(
      ["modulo-1", "unidad-1", "unidad-2"].sort(),
    );
  });

  it("returns an empty set for an unknown element", () => {
    expect(subtreeIds(tree, "no-existe").size).toBe(0);
  });
});

describe("parentLocationOptions", () => {
  it("offers only elements that contain something", () => {
    expect(parentLocationOptions(tree).map((o) => o.id)).toEqual(["curso", "modulo-1", "modulo-2"]);
  });

  it("keeps the depth so the list can be indented", () => {
    expect(parentLocationOptions(tree).map((o) => o.depth)).toEqual([0, 1, 1]);
  });
});

describe("withinRange", () => {
  const t = task({ start_date: "2026-08-01", due_date: "2026-10-31" });

  it("accepts everything when no range is given", () => {
    expect(withinRange(t, null, null)).toBe(true);
  });

  it("matches by overlap, not by due date", () => {
    // La tarea no vence en septiembre, pero está en marcha durante septiembre.
    expect(withinRange(t, "2026-09-01", "2026-09-30")).toBe(true);
  });

  it("rejects a task that finished before the window", () => {
    expect(withinRange(t, "2026-11-01", "2026-11-30")).toBe(false);
  });

  it("rejects a task that starts after the window", () => {
    expect(withinRange(t, "2026-06-01", "2026-07-01")).toBe(false);
  });

  it("leaves out tasks with no dates at all", () => {
    expect(withinRange(task(), "2026-09-01", null)).toBe(false);
  });

  it("uses the single known date when only one is set", () => {
    expect(withinRange(task({ due_date: "2026-09-15" }), "2026-09-01", "2026-09-30")).toBe(true);
  });
});

describe("filterTasks", () => {
  const tasks = [
    task({ id: "a", title: "Guion Unidad 1", work_item_id: "unidad-1", assignee_id: "u1" }),
    task({ id: "b", title: "Montaje Unidad 3", work_item_id: "unidad-3", team_id: "team-1" }),
    task({ id: "c", title: "Revisión general", status: "en_revision" }),
    task({ id: "d", title: "Grabación", work_item_id: "unidad-2", due_date: "2026-09-10" }),
  ];

  it("returns everything with no filters", () => {
    expect(filterTasks(tasks, EMPTY_TASK_FILTERS, tree)).toHaveLength(4);
  });

  it("searches title and description, ignoring case", () => {
    expect(filterTasks(tasks, filters({ search: "GUION" }), tree).map((t) => t.id)).toEqual(["a"]);
  });

  it("includes the whole subtree when filtering by a parent element", () => {
    // Módulo 1 contiene Unidad 1 y Unidad 2: sus dos tareas, aunque ninguna
    // cuelgue literalmente del módulo.
    expect(filterTasks(tasks, filters({ locationId: "modulo-1" }), tree).map((t) => t.id)).toEqual([
      "a",
      "d",
    ]);
  });

  it("isolates unassigned work with the 'nadie' option", () => {
    expect(filterTasks(tasks, filters({ assigneeId: "nadie" }), tree).map((t) => t.id)).toEqual([
      "c",
      "d",
    ]);
  });

  it("filters by team", () => {
    expect(filterTasks(tasks, filters({ teamId: "team-1" }), tree).map((t) => t.id)).toEqual(["b"]);
  });

  it("combines filters without losing any condition", () => {
    const result = filterTasks(
      tasks,
      filters({ locationId: "curso", from: "2026-09-01", to: "2026-09-30" }),
      tree,
    );
    expect(result.map((t) => t.id)).toEqual(["d"]);
  });
});

describe("countTasks", () => {
  it("counts unassigned, overdue, in review and done", () => {
    const tasks = [
      task({ id: "a", due_date: "2026-01-01" }),
      task({ id: "b", assignee_id: "u1", status: "en_revision" }),
      task({ id: "c", team_id: "t1", status: "completada", due_date: "2026-01-01" }),
    ];
    expect(countTasks(tasks, "2026-08-26")).toEqual({
      total: 3,
      unassigned: 1,
      overdue: 1, // la completada venció, pero ya no es un pendiente
      inReview: 1,
      done: 1,
    });
  });
});
