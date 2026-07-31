import { describe, it, expect } from "vitest";
import { commonPrefix, replaceInTitle } from "./bulk-title";

describe("commonPrefix", () => {
  it("returns the shared prefix of several titles", () => {
    expect(commonPrefix(["C1 - Guion", "C1 - Locución", "C1 - Edición"])).toBe("C1 - ");
  });

  it("returns empty string when there is no common prefix", () => {
    expect(commonPrefix(["Guion", "Locución"])).toBe("");
  });

  it("handles a single title and an empty list", () => {
    expect(commonPrefix(["C1 - Guion"])).toBe("C1 - Guion");
    expect(commonPrefix([])).toBe("");
  });
});

describe("replaceInTitle", () => {
  it("replaces the first occurrence of the fragment", () => {
    expect(replaceInTitle("C1 - Guion", "C1", "C2")).toBe("C2 - Guion");
  });

  it("leaves the title untouched when the fragment is missing or empty", () => {
    expect(replaceInTitle("C1 - Guion", "X9", "Z")).toBe("C1 - Guion");
    expect(replaceInTitle("C1 - Guion", "", "Z")).toBe("C1 - Guion");
  });
});
