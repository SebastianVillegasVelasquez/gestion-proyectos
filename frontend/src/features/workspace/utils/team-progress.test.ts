import { describe, it, expect } from "vitest";
import type { ApiTeamTask } from "../api/workspace.api";
import type { Deliverable } from "../types";
import { summarizeTeamProgress } from "./team-progress";

function task(over: Partial<ApiTeamTask>): ApiTeamTask {
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
    ...over,
  };
}

function deliverable(over: Partial<Deliverable>): Deliverable {
  return {
    id: "d",
    taskTitle: "Entregable",
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

const TODAY = "2026-08-28";

describe("summarizeTeamProgress", () => {
  it("calcula el % de avance excluyendo las canceladas del denominador", () => {
    const tasks = [
      task({ id: "a", status: "completada" }),
      task({ id: "b", status: "completada" }),
      task({ id: "c", status: "en_progreso" }),
      task({ id: "d", status: "cancelada" }),
    ];
    const s = summarizeTeamProgress(tasks, [], TODAY);
    expect(s.completedTasks).toBe(2);
    // 2 completadas / (4 - 1 cancelada) = 67%
    expect(s.completionPct).toBe(67);
    expect(s.totalTasks).toBe(4);
  });

  it("cuenta vencidas, bloqueadas y en revisión", () => {
    const tasks = [
      task({ id: "a", status: "en_progreso", due_date: "2026-08-01" }),
      task({ id: "b", status: "completada", due_date: "2026-08-01" }), // cerrada: no vencida
      task({
        id: "c",
        status: "en_progreso",
        blocked_by: [{ id: "z", title: "Otra", status: "en_progreso" }],
      }),
      task({ id: "e", status: "en_revision" }),
    ];
    const s = summarizeTeamProgress(tasks, [], TODAY);
    expect(s.overdueTasks).toBe(1);
    expect(s.blockedTasks).toBe(1);
    expect(s.awaitingReviewTasks).toBe(1);
  });

  it("resume los entregables por estado", () => {
    const dels = [
      deliverable({ id: "1", status: "en_revision" }),
      deliverable({ id: "2", status: "en_revision" }),
      deliverable({ id: "3", status: "aprobado" }),
      deliverable({ id: "4", status: "borrador" }),
    ];
    const s = summarizeTeamProgress([task({ id: "a" })], dels, TODAY);
    expect(s.deliverablesPendingReview).toBe(2);
    expect(s.deliverablesApproved).toBe(1);
    expect(s.deliverablesTotal).toBe(4);
  });

  it("no incluye la columna 'cancelada' si no hay ninguna", () => {
    const s = summarizeTeamProgress([task({ id: "a", status: "en_progreso" })], [], TODAY);
    expect(s.byStatus.some((x) => x.status === "cancelada")).toBe(false);
  });

  it("con cero tareas devuelve todo en cero sin dividir por cero", () => {
    const s = summarizeTeamProgress([], [], TODAY);
    expect(s.completionPct).toBe(0);
    expect(s.totalTasks).toBe(0);
  });
});
