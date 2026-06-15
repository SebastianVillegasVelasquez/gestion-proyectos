import { describe, it, expect } from "vitest";
import { computeRange, barMetrics, toDayNumber } from "./timeline";

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
