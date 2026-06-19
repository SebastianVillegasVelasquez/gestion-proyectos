import { describe, it, expect } from "vitest";
import { NOTIFICATION_TYPE_LABELS, formatBadgeCount, formatRelativeTime } from "./notifications";
import type { NotificationType } from "../types";

describe("formatBadgeCount", () => {
  it("is empty for zero or negative", () => {
    expect(formatBadgeCount(0)).toBe("");
    expect(formatBadgeCount(-2)).toBe("");
  });

  it("shows the number up to 9", () => {
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(9)).toBe("9");
  });

  it("caps at 9+", () => {
    expect(formatBadgeCount(10)).toBe("9+");
    expect(formatBadgeCount(120)).toBe("9+");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-06-18T12:00:00Z").getTime();

  it("says 'ahora' for under a minute", () => {
    expect(formatRelativeTime("2026-06-18T11:59:30Z", now)).toBe("ahora");
  });

  it("formats minutes, hours and days", () => {
    expect(formatRelativeTime("2026-06-18T11:45:00Z", now)).toBe("hace 15 min");
    expect(formatRelativeTime("2026-06-18T09:00:00Z", now)).toBe("hace 3 h");
    expect(formatRelativeTime("2026-06-16T12:00:00Z", now)).toBe("hace 2 d");
  });

  it("falls back to weeks past a week", () => {
    expect(formatRelativeTime("2026-06-01T12:00:00Z", now)).toBe("hace 2 sem");
  });

  it("returns empty for an invalid date", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("");
  });
});

describe("NOTIFICATION_TYPE_LABELS", () => {
  it("has a label for every notification type", () => {
    const types: NotificationType[] = [
      "tarea_asignada",
      "tarea_entregada",
      "tarea_rechazada",
      "tarea_atrasada",
      "proyecto_miembro_agregado",
      "proyecto_cerrado",
      "proyecto_iniciado",
      "proyecto_pausado",
      "proyecto_finalizado",
      "comentario_publicado",
      "comentario_respuesta",
      "mencion",
    ];
    for (const t of types) {
      expect(NOTIFICATION_TYPE_LABELS[t]).toBeTruthy();
    }
  });
});
