import { describe, it, expect } from "vitest";
import { groupMembersByRole, memberInitials } from "./group-members";
import type { ProjectMember, ProjectRole } from "../types/api.types";

function member(name: string, last: string, role: ProjectRole): ProjectMember {
  return {
    id: `id-${name}-${role}`,
    user_id: `${name}-${role}`,
    name,
    last_name: last,
    email: `${name.toLowerCase()}@acme.com`,
    position: "sin_cargo",
    project_role: role,
  };
}

describe("groupMembersByRole", () => {
  it("orders groups with leader first and omits empty roles", () => {
    const groups = groupMembersByRole([
      member("Ana", "García", "integrante"),
      member("Beto", "López", "coordinador"),
      member("Caro", "Ruiz", "integrante"),
    ]);

    expect(groups.map((g) => g.role)).toEqual(["coordinador", "integrante"]);
    expect(groups[0].members).toHaveLength(1);
    expect(groups[1].members).toHaveLength(2);
  });

  it("returns an empty array when there are no members", () => {
    expect(groupMembersByRole([])).toEqual([]);
  });
});

describe("memberInitials", () => {
  it("combines first letters of name and last name", () => {
    expect(memberInitials(member("Sebastian", "Villegas", "integrante"))).toBe("SV");
  });
});
