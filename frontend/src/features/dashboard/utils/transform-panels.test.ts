import { describe, it, expect } from "vitest";
import {
  deadlinePriority,
  formatShortDate,
  toDeadline,
  toProject,
  toTask,
} from "./transform-panels";
import type { DashboardDeadlineItem, DashboardProjectItem, DashboardTaskItem } from "../types";

const TODAY = new Date(2026, 5, 18); // 2026-06-18 (mes 0-indexado)

describe("formatShortDate", () => {
  it("formats an ISO date as 'day Mon'", () => {
    expect(formatShortDate("2026-06-14")).toBe("14 Jun");
    expect(formatShortDate("2026-01-03")).toBe("3 Ene");
  });
});

describe("deadlinePriority", () => {
  it("marks past dates as high (overdue)", () => {
    expect(deadlinePriority("2026-06-10", TODAY)).toBe("high");
  });
  it("marks today as 'today'", () => {
    expect(deadlinePriority("2026-06-18", TODAY)).toBe("today");
  });
  it("marks within three days as medium", () => {
    expect(deadlinePriority("2026-06-20", TODAY)).toBe("medium");
    expect(deadlinePriority("2026-06-21", TODAY)).toBe("medium");
  });
  it("marks far dates as low", () => {
    expect(deadlinePriority("2026-07-01", TODAY)).toBe("low");
  });
});

describe("toTask", () => {
  const base: DashboardTaskItem = {
    id: "t1",
    title: "Maquetar unidad",
    status: "en_progreso",
    project_name: "Diplomado",
    project_id: "p1",
    due_date: "2026-06-14",
  };

  it("maps backend statuses to the three board columns", () => {
    expect(toTask({ ...base, status: "en_progreso" }).status).toBe("in-progress");
    expect(toTask({ ...base, status: "en_revision" }).status).toBe("in-progress");
    expect(toTask({ ...base, status: "devuelta" }).status).toBe("pending");
    expect(toTask({ ...base, status: "pendiente_por_iniciar" }).status).toBe("pending");
    expect(toTask({ ...base, status: "completada" }).status).toBe("completed");
  });

  it("builds project + date tags", () => {
    const task = toTask(base);
    expect(task.tags).toEqual([
      { label: "Diplomado", variant: "project" },
      { label: "14 Jun", variant: "date" },
    ]);
  });

  it("omits the project tag when there is no project", () => {
    const task = toTask({ ...base, project_name: null });
    expect(task.tags).toEqual([{ label: "14 Jun", variant: "date" }]);
  });
});

describe("toProject", () => {
  const item: DashboardProjectItem = {
    id: "p1",
    name: "Diplomado",
    client_name: "Universidad OBJ",
    coordinator: "Ana García",
    tasks_total: 10,
    tasks_completed: 4,
    progress_pct: 40,
    status: "at-risk",
  };

  it("maps to the view model and uses client_name as the badge", () => {
    const p = toProject(item);
    expect(p).toMatchObject({
      name: "Diplomado",
      techBadge: "Universidad OBJ",
      coordinator: "Ana García",
      tasksTotal: 10,
      tasksCompleted: 4,
      progressPercent: 40,
      status: "at-risk",
    });
  });

  it("falls back when client and coordinator are missing", () => {
    const p = toProject({ ...item, client_name: null, coordinator: null });
    expect(p.techBadge).toBe("General");
    expect(p.coordinator).toBe("Sin coordinador");
  });
});

describe("toDeadline", () => {
  it("splits the date and derives the priority", () => {
    const item: DashboardDeadlineItem = {
      id: "d1",
      title: "Entrega",
      project_name: "Diplomado",
      due_date: "2026-06-10",
    };
    expect(toDeadline(item, TODAY)).toEqual({
      id: "d1",
      day: 10,
      month: "Jun",
      title: "Entrega",
      project: "Diplomado",
      priority: "high",
    });
  });
});
