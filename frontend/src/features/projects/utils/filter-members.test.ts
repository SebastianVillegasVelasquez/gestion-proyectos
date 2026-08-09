import { describe, it, expect } from "vitest";
import { filterMembers } from "./filter-members";
import type { ProjectMember, ProjectRole } from "../types/api.types";

function member(
  name: string,
  last: string,
  email: string,
  position: string,
  role: ProjectRole = "integrante",
): ProjectMember {
  return {
    id: `id-${name}-${email}`,
    user_id: `${name}-${email}`,
    name,
    last_name: last,
    email,
    position,
    project_role: role,
  };
}

const people: ProjectMember[] = [
  member("Ana", "García", "ana@acme.com", "desarrollador"),
  member("Beto", "López", "beto@acme.com", "experto_tematico"),
  member("Caro", "Ruiz", "caro@otra.com", "diseñador_grafico"),
];

describe("filterMembers", () => {
  it("returns every member when the query is blank", () => {
    expect(filterMembers(people, "   ")).toHaveLength(3);
  });

  it("matches by full name regardless of case", () => {
    const result = filterMembers(people, "ana gar");
    expect(result.map((m) => m.name)).toEqual(["Ana"]);
  });

  it("matches by email", () => {
    const result = filterMembers(people, "beto@acme");
    expect(result.map((m) => m.name)).toEqual(["Beto"]);
  });

  it("matches by the readable position label", () => {
    // "experto_tematico" se muestra como "Experto temático".
    const result = filterMembers(people, "temático");
    expect(result.map((m) => m.name)).toEqual(["Beto"]);
  });

  it("matches by the raw position value", () => {
    const result = filterMembers(people, "diseñador_grafico");
    expect(result.map((m) => m.name)).toEqual(["Caro"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterMembers(people, "zzz")).toEqual([]);
  });
});
