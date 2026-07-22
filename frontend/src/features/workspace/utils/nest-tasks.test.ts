import { describe, it, expect } from "vitest";
import { nestTasks } from "./nest-tasks";
import type { ApiTeamTask } from "../api/workspace.api";

function task(over: Partial<ApiTeamTask>): ApiTeamTask {
  return {
    id: "t",
    title: "T",
    status: "pendiente_por_iniciar",
    priority: "media",
    work_item_id: "wi",
    work_item_name: "Módulo 1",
    project_id: "p",
    project_name: "Proyecto",
    assignee_id: null,
    assignee_name: null,
    parent_task_id: null,
    start_date: "2026-01-01",
    due_date: "2026-01-05",
    ...over,
  };
}

describe("nestTasks", () => {
  it("nests children under their parent (two levels)", () => {
    const parent = task({ id: "p1", title: "Banner" });
    const child = task({ id: "c1", title: "Móvil", parent_task_id: "p1" });
    const result = nestTasks([parent, child]);
    expect(result).toHaveLength(1);
    expect(result[0].task.id).toBe("p1");
    expect(result[0].children.map((c) => c.id)).toEqual(["c1"]);
  });

  it("puts a subtask as root when its parent is missing from the view", () => {
    const orphan = task({ id: "o1", parent_task_id: "missing" });
    const result = nestTasks([orphan]);
    expect(result).toHaveLength(1);
    expect(result[0].task.id).toBe("o1");
    expect(result[0].children).toEqual([]);
  });

  it("keeps roots without children intact", () => {
    const solo = task({ id: "s" });
    expect(nestTasks([solo])).toEqual([{ task: solo, children: [] }]);
  });
});
