import { describe, expect, it } from "vitest";
import { routeDependencyArrows, type BarBox } from "./arrows";

const ROW = 36;
const box = (row: number, left: number, width: number): BarBox => ({
  yTop: row * ROW,
  left,
  width,
});

describe("routeDependencyArrows", () => {
  it("routes a forward dependency straight down to the successor", () => {
    const positions = new Map([
      ["a", box(0, 0, 100)],
      ["b", box(1, 200, 80)],
    ]);
    const [arrow] = routeDependencyArrows([{ id: "d", fromKey: "a", toKey: "b" }], positions, ROW);
    expect(arrow?.conflict).toBe(false);
    expect(arrow?.d).toBe("M 100 18 H 112 V 54 H 197");
  });

  it("flags a successor that starts before its predecessor ends", () => {
    const positions = new Map([
      ["a", box(0, 100, 100)],
      ["b", box(2, 50, 80)],
    ]);
    const [arrow] = routeDependencyArrows([{ id: "d", fromKey: "a", toKey: "b" }], positions, ROW);
    expect(arrow?.conflict).toBe(true);
    // Rodea por el borde superior de la fila destino, no por su centro.
    expect(arrow?.d).toContain("V 72 H");
  });

  it("separates arrows sharing the same predecessor into lanes", () => {
    const positions = new Map([
      ["a", box(0, 0, 100)],
      ["b", box(1, 300, 50)],
      ["c", box(2, 300, 50)],
    ]);
    const [first, second] = routeDependencyArrows(
      [
        { id: "1", fromKey: "a", toKey: "b" },
        { id: "2", fromKey: "a", toKey: "c" },
      ],
      positions,
      ROW,
    );
    expect(first?.d.split(" ")[4]).toBe("112");
    expect(second?.d.split(" ")[4]).toBe("119");
  });

  it("skips edges whose bars are not visible", () => {
    const positions = new Map([["a", box(0, 0, 10)]]);
    expect(routeDependencyArrows([{ id: "d", fromKey: "a", toKey: "x" }], positions, ROW)).toEqual(
      [],
    );
  });
});
