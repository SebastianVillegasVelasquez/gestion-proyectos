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

  it("creates a draft task without dates", () => {
    const payload = buildTaskPayload({ ...emptyTaskForm("wi1"), title: "Borrador" }, "p1");
    expect(payload.start_date).toBeNull();
    expect(payload.due_date).toBeUndefined();
    expect(payload.duration_days).toBeUndefined();
  });

  it("omits duration but keeps the estimate when there is no start date", () => {
    const payload = buildTaskPayload(
      { ...emptyTaskForm("wi1"), title: "Sin inicio", dateMode: "duration", durationDays: "5" },
      "p1",
    );
    expect(payload.start_date).toBeNull();
    expect(payload.duration_days).toBeUndefined();
    // La duración se conserva como estimación de esfuerzo.
    expect(payload.estimated_days).toBe("5");
  });

  it("keeps the duration as the estimate when there IS a start date too", () => {
    const payload = buildTaskPayload(
      {
        ...emptyTaskForm("wi1"),
        title: "Con inicio",
        startDate: "2026-07-01",
        dateMode: "duration",
        durationDays: "3",
      },
      "p1",
    );
    expect(payload.duration_days).toBe(3);
    expect(payload.estimated_days).toBe("3");
  });

  it("does not set an estimate from an explicit end date", () => {
    const payload = buildTaskPayload(
      {
        ...emptyTaskForm("wi1"),
        title: "Con fin",
        startDate: "2026-07-01",
        dateMode: "end",
        dueDate: "2026-07-10",
      },
      "p1",
    );
    expect(payload.estimated_days).toBeUndefined();
  });

  it("no exige aprobación por defecto", () => {
    const payload = buildTaskPayload({ ...emptyTaskForm("wi1"), title: "Tarea" }, "p1");
    expect(payload.requires_approval).toBe(false);
  });

  it("envía requires_approval cuando se marca explícitamente", () => {
    const payload = buildTaskPayload(
      { ...emptyTaskForm("wi1"), title: "Tarea", requiresApproval: true },
      "p1",
    );
    expect(payload.requires_approval).toBe(true);
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

  it("validates the duration even without a start date", () => {
    expect(
      validateTaskForm({
        ...emptyTaskForm("wi1"),
        title: "Sin inicio",
        dateMode: "duration",
        durationDays: "-2",
      }),
    ).toMatch(/duración/i);
  });

  it("allows a task with no dates (draft)", () => {
    expect(validateTaskForm({ ...emptyTaskForm("wi1"), title: "Borrador" })).toBeNull();
  });

  it("rejects an end date before the start date", () => {
    expect(
      validateTaskForm({
        ...base,
        dateMode: "end",
        dueDate: "2026-06-01",
      }),
    ).toMatch(/fin/i);
  });
});
