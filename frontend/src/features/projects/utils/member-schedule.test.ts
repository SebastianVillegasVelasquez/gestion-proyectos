import { describe, expect, it } from "vitest";
import type { Task } from "../types/api.types";
import { memberSchedule } from "./member-schedule";

const task = (over: Partial<Task>): Task => ({
  id: "t",
  project_id: "p",
  work_item_id: null,
  parent_task_id: null,
  title: "T",
  description: null,
  priority: "media",
  assignee_id: "u",
  team_id: null,
  start_date: null,
  due_date: null,
  status: "pendiente_por_iniciar",
  completed_at: null,
  created_at: "",
  updated_at: null,
  estimated_days: null,
  logged_days: "0",
  requires_approval: false,
  ...over,
});

describe("memberSchedule", () => {
  it("marca 'idle' sin tareas", () => {
    expect(memberSchedule([], "2026-06-15").status).toBe("idle");
  });

  it("marca 'delayed' si hay una tarea abierta vencida", () => {
    const r = memberSchedule(
      [task({ start_date: "2026-06-01", due_date: "2026-06-10", status: "en_progreso" })],
      "2026-06-15",
    );
    expect(r.status).toBe("delayed");
    expect(r.overdue).toBe(1);
  });

  it("marca 'behind' cuando el avance real va por detrás del esperado", () => {
    const r = memberSchedule(
      [task({ start_date: "2026-06-01", due_date: "2026-06-30", status: "pendiente_por_iniciar" })],
      "2026-06-20",
    );
    expect(r.status).toBe("behind");
    expect(r.expectedPct).toBeGreaterThan(r.actualPct);
  });

  it("marca 'on_track' cuando el avance real alcanza al esperado", () => {
    const r = memberSchedule(
      [task({ start_date: "2026-06-01", due_date: "2026-06-30", status: "completada" })],
      "2026-06-10",
    );
    expect(r.status).toBe("on_track");
  });
});
