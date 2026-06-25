import { describe, it, expect } from "vitest";
import { statusProgressPct, isOverdue, summarize, daysRemaining } from "./metrics";
import type { Task, TaskStatus } from "../types/api.types";

function task(status: TaskStatus, due_date: string): Pick<Task, "status" | "due_date"> {
  return { status, due_date };
}

describe("statusProgressPct", () => {
  it("maps terminal and intermediate states", () => {
    expect(statusProgressPct("pendiente_por_iniciar")).toBe(0);
    expect(statusProgressPct("en_progreso")).toBe(35);
    expect(statusProgressPct("en_revision")).toBe(70);
    expect(statusProgressPct("completada")).toBe(100);
    expect(statusProgressPct("cancelada")).toBe(0);
  });
});

describe("isOverdue", () => {
  const today = "2026-06-18";

  it("is overdue when due date passed and not closed", () => {
    expect(isOverdue(task("en_progreso", "2026-06-10"), today)).toBe(true);
  });

  it("is not overdue when completed or cancelled", () => {
    expect(isOverdue(task("completada", "2026-06-10"), today)).toBe(false);
    expect(isOverdue(task("cancelada", "2026-06-10"), today)).toBe(false);
  });

  it("is not overdue when the due date is in the future", () => {
    expect(isOverdue(task("en_progreso", "2026-06-30"), today)).toBe(false);
  });
});

describe("summarize", () => {
  const today = "2026-06-18";

  it("counts totals, completed, in-progress and overdue, and computes %", () => {
    const tasks = [
      task("completada", "2026-06-01"),
      task("completada", "2026-06-02"),
      task("en_progreso", "2026-06-10"), // vencida
      task("en_revision", "2026-06-30"),
      task("pendiente_por_iniciar", "2026-07-01"),
    ];
    const s = summarize(tasks, today);
    expect(s.total).toBe(5);
    expect(s.completed).toBe(2);
    expect(s.inProgress).toBe(2); // en_progreso + en_revision
    expect(s.overdue).toBe(1);
    expect(s.progressPct).toBe(40); // 2/5
  });

  it("returns zero progress for an empty list", () => {
    expect(summarize([], today).progressPct).toBe(0);
  });
});

describe("daysRemaining", () => {
  it("returns positive days when the end date is ahead", () => {
    expect(daysRemaining("2026-06-28", "2026-06-18")).toBe(10);
  });

  it("returns negative days when overdue", () => {
    expect(daysRemaining("2026-06-10", "2026-06-18")).toBe(-8);
  });

  it("returns null when there is no end date", () => {
    expect(daysRemaining(null, "2026-06-18")).toBeNull();
  });
});
