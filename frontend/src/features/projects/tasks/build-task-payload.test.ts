import { describe, it, expect } from "vitest";
import { buildTaskPayload, validateTaskForm, emptyTaskForm } from "./build-task-payload";

describe("buildTaskPayload", () => {
  it("attaches to a work item and uses duration", () => {
    const payload = buildTaskPayload(
      {
        ...emptyTaskForm("wi1"),
        title: "Tarea",
        startDate: "2026-07-01",
        dateMode: "duration",
        durationDays: "5",
      },
      "p1",
    );
    expect(payload.work_item_id).toBe("wi1");
    expect(payload.project_id).toBeUndefined();
    expect(payload.duration_days).toBe(5);
    expect(payload.due_date).toBeUndefined();
  });

  it("uses an end date when chosen", () => {
    const payload = buildTaskPayload(
      {
        ...emptyTaskForm("wi1"),
        title: "Tarea",
        startDate: "2026-07-01",
        dateMode: "end",
        dueDate: "2026-07-10",
      },
      "p1",
    );
    expect(payload.due_date).toBe("2026-07-10");
    expect(payload.duration_days).toBeUndefined();
  });

  it("nulls empty optional fields", () => {
    const payload = buildTaskPayload(
      {
        ...emptyTaskForm("wi1"),
        title: "Tarea",
        startDate: "2026-07-01",
        durationDays: "3",
      },
      "p1",
    );
    expect(payload.assignee_id).toBeNull();
    expect(payload.depends_on_id).toBeNull();
  });

  it("anchors a task without a work item to the project", () => {
    const payload = buildTaskPayload(
      {
        ...emptyTaskForm(),
        title: "Suelta",
        startDate: "2026-07-01",
        durationDays: "2",
      },
      "p1",
    );
    expect(payload.work_item_id).toBeNull();
    expect(payload.project_id).toBe("p1");
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

  it("allows a task without a work item (standalone)", () => {
    expect(validateTaskForm({ ...base, workItemId: "" })).toBeNull();
  });

  it("requires positive duration", () => {
    expect(validateTaskForm({ ...base, durationDays: "0" })).toMatch(/duración/i);
  });
});
