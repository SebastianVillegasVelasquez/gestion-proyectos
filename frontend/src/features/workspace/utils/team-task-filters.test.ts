import { describe, it, expect } from "vitest";
import type { ApiTeamTask } from "../api/workspace.api";
import {
  EMPTY_TEAM_TASK_FILTERS,
  UNASSIGNED,
  activeTeamTaskFilterCount,
  filterTeamTasks,
} from "./team-task-filters";

function t(over: Partial<ApiTeamTask>): ApiTeamTask {
  return {
    id: "t",
    title: "Tarea",
    status: "en_progreso",
    priority: "media",
    work_item_id: null,
    work_item_name: null,
    project_id: "p1",
    project_name: "Proyecto",
    assignee_id: "u1",
    assignee_name: "Ana",
    parent_task_id: null,
    start_date: null,
    due_date: null,
    requires_approval: false,
    progress_pct: 0,
    blocked_by: [],
    depends_on_third_party: false,
    delivery_blocked_reason: null,
    ...over,
  };
}

const tasks = [
  t({ id: "a", title: "Guion del módulo", assignee_id: "u1", status: "en_progreso" }),
  t({ id: "b", title: "Montaje", assignee_id: "u2", status: "completada" }),
  t({
    id: "c",
    title: "Locución",
    assignee_id: null,
    status: "en_revision",
    blocked_by: [{ id: "a", title: "Guion del módulo", status: "en_progreso" }],
  }),
];

describe("filterTeamTasks", () => {
  it("sin filtros devuelve todo", () => {
    expect(filterTeamTasks(tasks, EMPTY_TEAM_TASK_FILTERS)).toHaveLength(3);
  });

  it("filtra por texto", () => {
    const r = filterTeamTasks(tasks, { ...EMPTY_TEAM_TASK_FILTERS, text: "mont" });
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });

  it("filtra por estado", () => {
    const r = filterTeamTasks(tasks, { ...EMPTY_TEAM_TASK_FILTERS, status: "completada" });
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });

  it("filtra por responsable y por 'sin responsable'", () => {
    expect(
      filterTeamTasks(tasks, { ...EMPTY_TEAM_TASK_FILTERS, assignee: "u2" }).map((x) => x.id),
    ).toEqual(["b"]);
    expect(
      filterTeamTasks(tasks, { ...EMPTY_TEAM_TASK_FILTERS, assignee: UNASSIGNED }).map((x) => x.id),
    ).toEqual(["c"]);
  });

  it("solo bloqueadas: descarta las que no tienen dependencia pendiente", () => {
    const r = filterTeamTasks(tasks, { ...EMPTY_TEAM_TASK_FILTERS, onlyBlocked: true });
    expect(r.map((x) => x.id)).toEqual(["c"]);
  });

  it("filtra por elemento (work_item_id exacto)", () => {
    const scoped = [
      t({ id: "x", work_item_id: "wi-1" }),
      t({ id: "y", work_item_id: "wi-2" }),
      t({ id: "z", work_item_id: null }),
    ];
    const r = filterTeamTasks(scoped, { ...EMPTY_TEAM_TASK_FILTERS, elementId: "wi-1" });
    expect(r.map((x) => x.id)).toEqual(["x"]);
  });

  it("filtra por rama: incluye las tareas de cualquier descendiente del ancestro", () => {
    const scoped = [
      t({ id: "x", work_item_id: "wi-hijo" }),
      t({ id: "y", work_item_id: "wi-nieto" }),
      t({ id: "z", work_item_id: "wi-otra-rama" }),
    ];
    // wi-hijo y wi-nieto cuelgan de "rama-A"; wi-otra-rama no.
    const ancestorsOf = (id: string | null) =>
      id === "wi-hijo"
        ? new Set(["wi-hijo", "rama-A"])
        : id === "wi-nieto"
          ? new Set(["wi-nieto", "wi-hijo", "rama-A"])
          : new Set(id ? [id] : []);
    const r = filterTeamTasks(
      scoped,
      { ...EMPTY_TEAM_TASK_FILTERS, branchId: "rama-A" },
      ancestorsOf,
    );
    expect(r.map((x) => x.id)).toEqual(["x", "y"]);
  });

  it("cuenta filtros activos", () => {
    expect(activeTeamTaskFilterCount(EMPTY_TEAM_TASK_FILTERS)).toBe(0);
    expect(
      activeTeamTaskFilterCount({
        text: "x",
        status: "completada",
        assignee: "u1",
        onlyBlocked: true,
        elementId: "wi-1",
        branchId: "rama-A",
      }),
    ).toBe(6);
  });
});
