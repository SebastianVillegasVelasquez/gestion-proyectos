import { describe, it, expect } from "vitest";
import { buildTaskPayload, validateTaskForm, emptyTaskForm } from "./build-task-payload";

describe("buildTaskPayload", () => {
  it("targets a phase and uses duration", () => {
    const payload = buildTaskPayload({
      ...emptyTaskForm(),
      title: "Tarea",
      target: "phase",
      phaseId: "ph1",
      startDate: "2026-07-01",
      dateMode: "duration",
      durationDays: "5",
    });
    expect(payload.phase_id).toBe("ph1");
    expect(payload.node_id).toBeUndefined();
    expect(payload.duration_days).toBe(5);
    expect(payload.due_date).toBeUndefined();
  });

  it("targets a node and uses end date", () => {
    const payload = buildTaskPayload({
      ...emptyTaskForm(),
      title: "Tarea",
      target: "node",
      nodeId: "n1",
      startDate: "2026-07-01",
      dateMode: "end",
      dueDate: "2026-07-10",
    });
    expect(payload.node_id).toBe("n1");
    expect(payload.phase_id).toBeUndefined();
    expect(payload.due_date).toBe("2026-07-10");
    expect(payload.duration_days).toBeUndefined();
  });

  it("nulls empty optional fields", () => {
    const payload = buildTaskPayload({
      ...emptyTaskForm(),
      title: "Tarea",
      target: "phase",
      phaseId: "ph1",
      startDate: "2026-07-01",
      durationDays: "3",
    });
    expect(payload.assignee_id).toBeNull();
    expect(payload.depends_on_id).toBeNull();
  });
});

describe("validateTaskForm", () => {
  const base = {
    ...emptyTaskForm(),
    title: "Tarea válida",
    target: "phase" as const,
    phaseId: "ph1",
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

  it("requires a phase when targeting phase", () => {
    expect(validateTaskForm({ ...base, phaseId: "" })).toMatch(/fase/i);
  });

  it("requires positive duration", () => {
    expect(validateTaskForm({ ...base, durationDays: "0" })).toMatch(/duración/i);
  });
});
