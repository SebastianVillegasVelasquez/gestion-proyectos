import { describe, expect, it } from "vitest";
import { formatFileSize } from "./format-size";

describe("formatFileSize", () => {
  it("muestra los bytes sin decimales", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(812)).toBe("812 B");
  });

  it("sube de unidad al pasar de 1024", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1_500_000)).toBe("1.4 MB");
  });

  it("se queda en GB como unidad máxima", () => {
    expect(formatFileSize(5 * 1024 ** 4)).toBe("5120.0 GB");
  });
});
