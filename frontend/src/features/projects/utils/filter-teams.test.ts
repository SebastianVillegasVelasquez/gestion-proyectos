import { describe, it, expect } from "vitest";
import { filterTeams, teamInitials } from "./filter-teams";
import type { Team } from "../types/api.types";

const PROJECT_ID = "p1";

const teams: Team[] = [
  {
    id: "1",
    project_id: PROJECT_ID,
    name: "Equipo de Desarrollo",
    description: "Backend y frontend",
    member_count: 5,
  },
  {
    id: "2",
    project_id: PROJECT_ID,
    name: "Diseño",
    description: "Identidad visual",
    member_count: 3,
  },
  { id: "3", project_id: PROJECT_ID, name: "Soporte", description: null, member_count: 0 },
];

describe("filterTeams", () => {
  it("returns every team when the query is empty", () => {
    expect(filterTeams(teams, "")).toHaveLength(3);
    expect(filterTeams(teams, "   ")).toHaveLength(3);
  });

  it("matches by name, case-insensitively", () => {
    const result = filterTeams(teams, "desarrollo");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Equipo de Desarrollo");
  });

  it("matches by description", () => {
    const result = filterTeams(teams, "visual");
    expect(result.map((t) => t.name)).toEqual(["Diseño"]);
  });

  it("handles teams without description without crashing", () => {
    expect(filterTeams(teams, "soporte").map((t) => t.id)).toEqual(["3"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterTeams(teams, "marketing")).toEqual([]);
  });
});

describe("teamInitials", () => {
  it("takes the first and last word initials", () => {
    expect(teamInitials("Equipo de Desarrollo")).toBe("ED");
  });

  it("uses a single letter for one-word names", () => {
    expect(teamInitials("Diseño")).toBe("D");
  });

  it("falls back to ? for empty names", () => {
    expect(teamInitials("   ")).toBe("?");
  });
});
