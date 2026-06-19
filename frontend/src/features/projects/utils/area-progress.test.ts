import { describe, it, expect } from "vitest";
import { areaTone } from "./area-progress";

describe("areaTone", () => {
  it("is rose below 34%", () => {
    expect(areaTone(0).bar).toBe("bg-rose-500");
    expect(areaTone(33).bar).toBe("bg-rose-500");
  });

  it("is amber from 34% to 66%", () => {
    expect(areaTone(34).bar).toBe("bg-amber-500");
    expect(areaTone(66).bar).toBe("bg-amber-500");
  });

  it("is emerald from 67%", () => {
    expect(areaTone(67).bar).toBe("bg-emerald-500");
    expect(areaTone(100).bar).toBe("bg-emerald-500");
  });
});
