import { describe, it, expect } from "vitest";
import { groupTeamMembersByRole, teamMemberInitials } from "./group-team-members";
import type { TeamMember } from "../types/api.types";

const members: TeamMember[] = [
  {
    user_id: "1",
    name: "Ana",
    last_name: "García",
    position: "desarrollador",
    team_role: "integrante",
  },
  {
    user_id: "2",
    name: "Beto",
    last_name: "López",
    position: "project_manager",
    team_role: "lider",
  },
  {
    user_id: "3",
    name: "Cata",
    last_name: "Ruiz",
    position: "desarrollador",
    team_role: "integrante",
  },
];

describe("groupTeamMembersByRole", () => {
  it("orders groups with leaders first and drops empty roles", () => {
    const groups = groupTeamMembersByRole(members);
    expect(groups.map((g) => g.role)).toEqual(["lider", "integrante"]);
    expect(groups[0].members).toHaveLength(1);
    expect(groups[1].members.map((m) => m.name)).toEqual(["Ana", "Cata"]);
  });

  it("returns an empty array when there are no members", () => {
    expect(groupTeamMembersByRole([])).toEqual([]);
  });
});

describe("teamMemberInitials", () => {
  it("combines first and last name initials", () => {
    expect(teamMemberInitials(members[0])).toBe("AG");
  });
});
