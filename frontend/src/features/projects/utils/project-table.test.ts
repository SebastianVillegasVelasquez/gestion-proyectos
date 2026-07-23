import { describe, it, expect } from "vitest";
import { filterProjects, monogram, monogramTone, shortId } from "./project-table";
import type { Project } from "../types/api.types";

function project(over: Partial<Project> = {}): Project {
  return {
    id: "a1b2c3d4-0000-0000-0000-000000000000",
    name: "Diplomado en Analítica",
    description: null,
    client_name: "Unicafam",
    start_date: null,
    end_date: null,
    progress_pct: 40,
    ...over,
  };
}

describe("shortId", () => {
  it("takes the first UUID block in uppercase", () => {
    expect(shortId("a1b2c3d4-0000-0000-0000-000000000000")).toBe("A1B2C3D4");
  });
});

describe("monogram", () => {
  it("uses the initials of the first two words", () => {
    expect(monogram("Diplomado en Analítica")).toBe("DE");
  });

  it("handles single-word names", () => {
    expect(monogram("Onboarding")).toBe("O");
  });

  it("falls back for empty names", () => {
    expect(monogram("   ")).toBe("?");
  });
});

describe("monogramTone", () => {
  it("is deterministic for the same name", () => {
    expect(monogramTone("Proyecto X")).toBe(monogramTone("Proyecto X"));
  });
});

describe("filterProjects", () => {
  const projects = [
    project({ id: "aaaa1111-0000-0000-0000-000000000000", name: "Diplomado en Analítica" }),
    project({
      id: "bbbb2222-0000-0000-0000-000000000000",
      name: "Curso de Liderazgo",
      client_name: "Acme",
    }),
  ];

  it("returns everything when the query is blank", () => {
    expect(filterProjects(projects, "  ")).toHaveLength(2);
  });

  it("matches by name, case-insensitive", () => {
    expect(filterProjects(projects, "liderazgo")).toHaveLength(1);
  });

  it("matches by client", () => {
    expect(filterProjects(projects, "acme")[0].name).toBe("Curso de Liderazgo");
  });

  it("matches by short id", () => {
    expect(filterProjects(projects, "AAAA1111")).toHaveLength(1);
  });

  it("returns empty when nothing matches", () => {
    expect(filterProjects(projects, "zzz")).toHaveLength(0);
  });
});
