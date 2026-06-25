import type { TeamMember, TeamRole } from "@/features/projects/types/api.types";
import { TEAM_ROLE_ORDER } from "@/features/projects/types/labels";

export interface TeamMemberGroup {
  role: TeamRole;
  members: TeamMember[];
}

/** Agrupa los integrantes de un equipo por rol, en orden (Líder primero). */
export function groupTeamMembersByRole(members: TeamMember[]): TeamMemberGroup[] {
  return TEAM_ROLE_ORDER.map((role) => ({
    role,
    members: members.filter((m) => m.team_role === role),
  })).filter((group) => group.members.length > 0);
}

export function teamMemberInitials(member: TeamMember): string {
  const first = member.name.trim()[0] ?? "";
  const last = member.last_name.trim()[0] ?? "";
  return (first + last).toUpperCase() || "?";
}
