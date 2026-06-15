import { describe, it, expect } from "vitest";
import { greetingForHour, initialsFromName } from "./greeting";

describe("greetingForHour", () => {
  it("says 'Buenos días' in the morning", () => {
    expect(greetingForHour(0)).toBe("Buenos días");
    expect(greetingForHour(11)).toBe("Buenos días");
  });

  it("says 'Buenas tardes' in the afternoon", () => {
    expect(greetingForHour(12)).toBe("Buenas tardes");
    expect(greetingForHour(18)).toBe("Buenas tardes");
  });

  it("says 'Buenas noches' at night", () => {
    expect(greetingForHour(19)).toBe("Buenas noches");
    expect(greetingForHour(23)).toBe("Buenas noches");
  });
});

describe("initialsFromName", () => {
  it("takes first and last initial for full names", () => {
    expect(initialsFromName("Sebastian Villegas")).toBe("SV");
    expect(initialsFromName("Ana María García")).toBe("AG");
  });

  it("handles a single name", () => {
    expect(initialsFromName("Sebastian")).toBe("SE");
  });

  it("falls back to ? for empty input", () => {
    expect(initialsFromName("   ")).toBe("?");
  });
});
