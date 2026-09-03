import { describe, it, expect } from "vitest";
import { previewKind } from "./preview";

describe("previewKind", () => {
  it("reconoce lo que el navegador sí pinta", () => {
    expect(previewKind("image/png")).toBe("image");
    expect(previewKind("application/pdf")).toBe("pdf");
    expect(previewKind("text/csv")).toBe("text");
    expect(previewKind("application/json")).toBe("text");
    expect(previewKind("video/mp4")).toBe("video");
  });

  it("marca como no soportado lo de ofimática (Word, Excel)", () => {
    expect(
      previewKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBe("unsupported");
    expect(previewKind(undefined)).toBe("unsupported");
  });
});
