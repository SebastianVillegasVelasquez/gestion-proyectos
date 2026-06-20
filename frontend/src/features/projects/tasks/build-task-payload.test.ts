import { describe, it, expect } from "vitest";
import { buildTaskPayload, validateTaskForm, emptyTaskForm } from "./build-task-payload";

describe("buildTaskPayload", () => {
  it("attaches to a work item and uses duration", () => {
    const payload = buildTaskPayload({
      ...emptyTaskForm("wi1"),
      title: "Tarea",
      startDate: "2026-07-01",
      dateMode: "duration",
      durationDays: "5",
    });
    expect(payload.work_item_id).toBe("wi1");
    expect(payload.duration_days).toBe(5);
    expect(payload.due_date).toBeUndefined();
  });

  it("uses an end date when chosen", () => {
    const payload = buildTaskPayload({
      ...emptyTaskForm("wi1"),
      title: "Tarea",
      startDate: "2026-07-01",
      dateMode: "end",
      dueDate: "2026-07-10",
    });
    expect(payload.due_date).toBe("2026-07-10");
    expect(payload.duration_days).toBeUndefined();
  });

  it("nulls empty optional fields", () => {
    const payload = buildTaskPayload({
      ...emptyTaskForm("wi1"),
      title: "Tarea",
      startDate: "2026-07-01",
      durationDays: "3",
    });
    expect(payload.assignee_id).toBeNull();
    expect(payload.depends_on_id).toBeNull();
  });
});

describe("validateTaskForm", () => {
  const base = {
    ...emptyTaskForm("wi1"),
    title: "Tarea válida",
    startDate: "2026-07-01",
    dateMode: "duration" as const,
    durationDays: "5",
  };

  it("passes a complete form", () => {
    expect(validateTaskForm(base)).toBeNull();
  });

  it("requires a title", () => {
    expect(validateTaskForm({ ...base, title: "x" })).toMatch(/título/i);
  });

  it("requires a work item", () => {
    expect(validateTaskForm({ ...base, workItemId: "" })).toMatch(/nodo/i);
  });

  it("requires positive duration", () => {
    expect(validateTaskForm({ ...base, durationDays: "0" })).toMatch(/duración/i);
  });
});
