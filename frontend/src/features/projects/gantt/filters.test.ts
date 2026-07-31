import { describe, it, expect } from "vitest";
import { filterGanttTasks, type GanttFilters } from "./filters";
import type { Task, TaskStatus } from "../types/api.types";

const ALL: TaskStatus[] = [
  "pendiente_por_iniciar",
  "en_progreso",
  "en_revision",
  "devuelta",
  "completada",
  "cancelada",
];

function task(
  over: Partial<Pick<Task, "status" | "assignee_id" | "team_id" | "due_date">> = {},
): Pick<Task, "status" | "assignee_id" | "team_id" | "due_date"> {
  return {
    status: "en_progreso",
    assignee_id: "u1",
    team_id: null,
    due_date: "2026-06-30",
    ...over,
  };
}

function filters(over: Partial<GanttFilters> = {}): GanttFilters {
  return {
    statuses: new Set(ALL),
    assigneeId: null,
    teamId: null,
    position: null,
    onlyAtRisk: false,
    ...over,
  };
}

const today = "2026-06-18";

describe("filterGanttTasks", () => {
  it("returns all tasks with default filters", () => {
    const tasks = [task(), task({ status: "completada" })];
    expect(filterGanttTasks(tasks, filters(), today)).toHaveLength(2);
  });

  it("filters by active status set", () => {
    const tasks = [task({ status: "en_progreso" }), task({ status: "completada" })];
    const result = filterGanttTasks(tasks, filters({ statuses: new Set(["completada"]) }), today);
    expect(result.map((t) => t.status)).toEqual(["completada"]);
  });

  it("filters by assignee", () => {
    const tasks = [task({ assignee_id: "u1" }), task({ assignee_id: "u2" })];
    const result = filterGanttTasks(tasks, filters({ assigneeId: "u2" }), today);
    expect(result.map((t) => t.assignee_id)).toEqual(["u2"]);
  });

  it("filters by delegated team", () => {
    const tasks = [task({ team_id: "t1" }), task({ team_id: "t2" }), task({ team_id: null })];
    const result = filterGanttTasks(tasks, filters({ teamId: "t2" }), today);
    expect(result.map((t) => t.team_id)).toEqual(["t2"]);
  });

  it("keeps only at-risk tasks when requested", () => {
    const tasks = [
      task({ status: "en_progreso", due_date: "2026-06-10" }), // vencida
      task({ status: "en_progreso", due_date: "2026-06-30" }), // a tiempo
      task({ status: "completada", due_date: "2026-06-01" }), // cerrada
    ];
    const result = filterGanttTasks(tasks, filters({ onlyAtRisk: true }), today);
    expect(result).toHaveLength(1);
    expect(result[0].due_date).toBe("2026-06-10");
  });

  it("filters by cargo/position of the assignee", () => {
    const tasks = [
      task({ assignee_id: "u1" }),
      task({ assignee_id: "u2" }),
      task({ assignee_id: null }), // sin responsable → fuera cuando se filtra por cargo
    ];
    const positions = new Map<string, "desarrollador" | "diseñador_grafico">([
      ["u1", "desarrollador"],
      ["u2", "diseñador_grafico"],
    ]);
    const result = filterGanttTasks(
      tasks,
      filters({ position: "desarrollador" }),
      today,
      positions,
    );
    expect(result).toHaveLength(1);
    expect(result[0].assignee_id).toBe("u1");
  });

  it("combines filters (AND)", () => {
    const tasks = [
      task({ status: "en_progreso", assignee_id: "u1", due_date: "2026-06-10" }),
      task({ status: "en_progreso", assignee_id: "u2", due_date: "2026-06-10" }),
    ];
    const result = filterGanttTasks(tasks, filters({ assigneeId: "u1", onlyAtRisk: true }), today);
    expect(result).toHaveLength(1);
    expect(result[0].assignee_id).toBe("u1");
  });
});
