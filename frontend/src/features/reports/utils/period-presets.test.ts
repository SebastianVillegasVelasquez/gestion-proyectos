import { describe, it, expect } from "vitest";
import { PERIOD_PRESETS, activePreset, toIsoDate } from "./period-presets";

const TODAY = new Date(2026, 9, 14); // 14 oct 2026
const preset = (key: string) => {
  const p = PERIOD_PRESETS.find((x) => x.key === key);
  if (!p) {
    throw new Error(key);
  }
  return p.range(TODAY);
};

describe("period presets", () => {
  it("formats local dates without going through UTC", () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("covers the calendar month, the previous one and the quarter", () => {
    expect(preset("mes")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(preset("mes-pasado")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(preset("trimestre")).toEqual({ from: "2026-10-01", to: "2026-12-31" });
  });

  it("counts 30 days including today, backwards and forwards", () => {
    expect(preset("ultimos-30")).toEqual({ from: "2026-09-15", to: "2026-10-14" });
    expect(preset("proximos-30")).toEqual({ from: "2026-10-14", to: "2026-11-12" });
  });

  it("recognises the preset that matches a range and none for a manual one", () => {
    expect(activePreset("2026-10-01", "2026-10-31", TODAY)).toBe("mes");
    expect(activePreset("2026-10-02", "2026-10-31", TODAY)).toBeNull();
    expect(activePreset(undefined, undefined, TODAY)).toBeNull();
  });
});
