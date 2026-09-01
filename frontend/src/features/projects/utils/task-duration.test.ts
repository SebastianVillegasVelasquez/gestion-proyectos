import { describe, it, expect } from "vitest";
import { durationBucket, fmtDays } from "./task-duration";

describe("durationBucket", () => {
  it("clasifica por tramos de días", () => {
    expect(durationBucket(1).label).toBe("muy corta");
    expect(durationBucket(2).label).toBe("muy corta");
    expect(durationBucket(5).label).toBe("corta");
    expect(durationBucket(10).label).toBe("media");
    expect(durationBucket(20).label).toBe("larga");
    expect(durationBucket(21).label).toBe("muy larga");
    expect(durationBucket(120).label).toBe("muy larga");
  });
});

describe("fmtDays", () => {
  it("enteros sin decimales, fraccionarios recortados", () => {
    expect(fmtDays(8)).toBe("8");
    expect(fmtDays(2.5)).toBe("2.5");
    expect(fmtDays(2.25)).toBe("2.25");
  });
});
