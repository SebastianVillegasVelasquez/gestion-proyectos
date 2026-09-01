import { describe, it, expect } from "vitest";
import { dueStatus } from "./due-status";

const TODAY = "2026-08-31";

describe("dueStatus", () => {
  it("marca completada/cancelada como done sin mirar la fecha", () => {
    expect(dueStatus({ status: "completada", due_date: "2020-01-01" }, TODAY)).toBe("done");
    expect(dueStatus({ status: "cancelada", due_date: null }, TODAY)).toBe("done");
  });

  it("sin fecha límite → no_date", () => {
    expect(dueStatus({ status: "en_progreso", due_date: null }, TODAY)).toBe("no_date");
  });

  it("fecha pasada y abierta → overdue", () => {
    expect(dueStatus({ status: "en_progreso", due_date: "2026-08-30" }, TODAY)).toBe("overdue");
  });

  it("vence hoy o dentro de 3 días → due_soon", () => {
    expect(dueStatus({ status: "pendiente_por_iniciar", due_date: TODAY }, TODAY)).toBe("due_soon");
    expect(dueStatus({ status: "en_progreso", due_date: "2026-09-03" }, TODAY)).toBe("due_soon");
  });

  it("vence más adelante → on_track", () => {
    expect(dueStatus({ status: "en_progreso", due_date: "2026-09-10" }, TODAY)).toBe("on_track");
  });
});
