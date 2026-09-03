import { describe, it, expect } from "vitest";
import { daysUntil, deliveryStatus, dueStatus } from "./due-status";

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

describe("daysUntil", () => {
  it("futuro → positivo, hoy → 0, pasado → negativo", () => {
    expect(daysUntil("2026-09-03", TODAY)).toBe(3);
    expect(daysUntil(TODAY, TODAY)).toBe(0);
    expect(daysUntil("2026-08-28", TODAY)).toBe(-3);
  });

  it("sin fecha → null", () => {
    expect(daysUntil(null, TODAY)).toBeNull();
  });
});

describe("deliveryStatus", () => {
  const open = { status: "pendiente_por_iniciar" as const };

  it("marca como entregada lo que ya está cerrado", () => {
    expect(
      deliveryStatus(
        { status: "completada", start_date: "2026-01-01", due_date: "2026-01-02" },
        "2026-03-01",
      ),
    ).toBe("entregada");
  });

  it("distingue retraso, por vencer y a tiempo por la fecha de fin", () => {
    expect(deliveryStatus({ ...open, due_date: "2026-02-28" }, "2026-03-01")).toBe("retraso");
    expect(deliveryStatus({ ...open, due_date: "2026-03-03" }, "2026-03-01")).toBe("por_vencer");
    expect(deliveryStatus({ ...open, due_date: "2026-03-20" }, "2026-03-01")).toBe("a_tiempo");
  });

  it("marca en riesgo lo que debió arrancar y sigue sin empezar", () => {
    expect(
      deliveryStatus({ ...open, start_date: "2026-02-20", due_date: "2026-03-20" }, "2026-03-01"),
    ).toBe("en_riesgo");
  });

  it("no marca en riesgo lo que ya está en progreso", () => {
    expect(
      deliveryStatus(
        { status: "en_progreso", start_date: "2026-02-20", due_date: "2026-03-20" },
        "2026-03-01",
      ),
    ).toBe("a_tiempo");
  });

  it("sin fecha de fin no se puede juzgar", () => {
    expect(deliveryStatus({ ...open, due_date: null }, "2026-03-01")).toBe("sin_fecha");
  });
});
