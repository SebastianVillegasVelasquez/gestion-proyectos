import { describe, it, expect } from "vitest";
import { computeRange, barMetrics, toDayNumber, dayOffsetPct, axisTicks } from "./timeline";

describe("toDayNumber", () => {
  it("produces consecutive integers for consecutive days", () => {
    expect(toDayNumber("2026-06-02") - toDayNumber("2026-06-01")).toBe(1);
  });
});

describe("computeRange", () => {
  it("returns null when there are no tasks", () => {
    expect(computeRange([])).toBeNull();
  });

  it("spans from the earliest start to the latest due", () => {
    const range = computeRange([
      { start_date: "2026-06-01", due_date: "2026-06-05" },
      { start_date: "2026-06-03", due_date: "2026-06-10" },
    ]);
    expect(range).not.toBeNull();
    expect(range!.totalDays).toBe(toDayNumber("2026-06-10") - toDayNumber("2026-06-01"));
  });
});

describe("barMetrics", () => {
  const range = computeRange([{ start_date: "2026-06-01", due_date: "2026-06-11" }])!;

  it("places a task at the start at offset 0", () => {
    const { offsetPct } = barMetrics({ start_date: "2026-06-01", due_date: "2026-06-02" }, range);
    expect(offsetPct).toBe(0);
  });

  it("offsets a later task proportionally", () => {
    const { offsetPct } = barMetrics({ start_date: "2026-06-06", due_date: "2026-06-08" }, range);
    expect(offsetPct).toBeCloseTo(50, 0);
  });

  it("clamps width so it never overflows the track", () => {
    const { offsetPct, widthPct } = barMetrics(
      { start_date: "2026-06-11", due_date: "2026-06-11" },
      range,
    );
    expect(offsetPct + widthPct).toBeLessThanOrEqual(100);
  });

  it("gives a single-day task a minimum visible width", () => {
    const { widthPct } = barMetrics({ start_date: "2026-06-01", due_date: "2026-06-01" }, range);
    expect(widthPct).toBeGreaterThanOrEqual(2);
  });
});

describe("dayOffsetPct", () => {
  const range = computeRange([{ start_date: "2026-06-01", due_date: "2026-06-11" }])!;

  it("returns the proportional position for a date inside the range", () => {
    expect(dayOffsetPct("2026-06-06", range)).toBeCloseTo(50, 0);
  });

  it("returns null for a date outside the range", () => {
    expect(dayOffsetPct("2026-05-01", range)).toBeNull();
    expect(dayOffsetPct("2026-07-01", range)).toBeNull();
  });
});

describe("axisTicks", () => {
  it("uses weekly ticks for short ranges (<= 45 days)", () => {
    const range = computeRange([{ start_date: "2026-06-01", due_date: "2026-06-15" }])!;
    const ticks = axisTicks(range);
    // 14 días → ticks en 0, 7, 14 → 3 marcas, la primera en offset 0.
    expect(ticks).toHaveLength(3);
    expect(ticks[0].offsetPct).toBe(0);
    expect(ticks[0].label).toBe("1 jun");
    expect(ticks[1].label).toBe("8 jun");
  });

  it("uses monthly ticks for long ranges and marks month starts", () => {
    const range = computeRange([{ start_date: "2026-01-15", due_date: "2026-04-10" }])!;
    const ticks = axisTicks(range);
    // Inicio + inicios de feb, mar, abr.
    expect(ticks[0].offsetPct).toBe(0);
    expect(ticks.map((t) => t.label)).toEqual(["ene 26", "feb 26", "mar 26", "abr 26"]);
  });

  it("keeps every tick within 0–100%", () => {
    const range = computeRange([{ start_date: "2026-01-01", due_date: "2026-12-31" }])!;
    for (const t of axisTicks(range)) {
      expect(t.offsetPct).toBeGreaterThanOrEqual(0);
      expect(t.offsetPct).toBeLessThanOrEqual(100);
    }
  });
});
