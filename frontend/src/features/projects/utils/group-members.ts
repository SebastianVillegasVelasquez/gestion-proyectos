import type { ProjectMember, ProjectRole } from "@/features/projects/types/api.types";
import { PROJECT_ROLE_ORDER } from "@/features/projects/types/labels";

export interface MemberGroup {
  role: ProjectRole;
  members: ProjectMember[];
}

/** Agrupa los integrantes por rol, en el orden definido (Líder primero). */
export function groupMembersByRole(members: ProjectMember[]): MemberGroup[] {
  return PROJECT_ROLE_ORDER.map((role) => ({
    role,
    members: members.filter((m) => m.project_role === role),
  })).filter((group) => group.members.length > 0);
}

export function memberInitials(member: ProjectMember): string {
  const first = member.name.trim()[0] ?? "";
  const last = member.last_name.trim()[0] ?? "";
  return (first + last).toUpperCase() || "?";
}
