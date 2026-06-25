import { describe, it, expect } from "vitest";
import { completionTone, totalPages, personInitials, HISTORY_ACTION_LABELS } from "./completion";

describe("completionTone", () => {
  it("uses rose for low completion (< 34%)", () => {
    expect(completionTone(0).bar).toBe("bg-rose-500");
    expect(completionTone(33).bar).toBe("bg-rose-500");
  });

  it("uses amber for mid completion (34–66%)", () => {
    expect(completionTone(34).bar).toBe("bg-amber-500");
    expect(completionTone(66).bar).toBe("bg-amber-500");
  });

  it("uses emerald for high completion (>= 67%)", () => {
    expect(completionTone(67).bar).toBe("bg-emerald-500");
    expect(completionTone(100).bar).toBe("bg-emerald-500");
  });
});

describe("totalPages", () => {
  it("returns at least one page even with no items", () => {
    expect(totalPages(0, 10)).toBe(1);
  });

  it("rounds up partial pages", () => {
    expect(totalPages(25, 10)).toBe(3);
    expect(totalPages(20, 10)).toBe(2);
  });

  it("guards against a non-positive page size", () => {
    expect(totalPages(50, 0)).toBe(1);
  });
});

describe("personInitials", () => {
  it("combines first letters of name and last name", () => {
    expect(personInitials("Ana", "García")).toBe("AG");
  });

  it("falls back to ? when empty", () => {
    expect(personInitials("", "")).toBe("?");
  });
});

describe("HISTORY_ACTION_LABELS", () => {
  it("maps every history action to a readable label", () => {
    expect(HISTORY_ACTION_LABELS.creacion).toBe("Creó la tarea");
    expect(HISTORY_ACTION_LABELS.cambio_estado).toBe("Cambió el estado");
    expect(HISTORY_ACTION_LABELS.reasignacion).toBe("Reasignó");
    expect(HISTORY_ACTION_LABELS.comentario).toBe("Comentó");
  });
});
