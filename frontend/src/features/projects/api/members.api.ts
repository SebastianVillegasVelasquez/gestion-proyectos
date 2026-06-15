import http from "@/features/auth/api/http";
import type {
  AddMemberPayload,
  IdentityUser,
  ProjectMember,
} from "@/features/projects/types/api.types";

export const membersApi = {
  list: (projectId: string) =>
    http.get<ProjectMember[]>(`/projects/${projectId}/members`).then((r) => r.data),

  add: (payload: AddMemberPayload) =>
    http.post<ProjectMember>("/projects/members/", payload).then((r) => r.data),
};

export const usersApi = {
  list: () => http.get<IdentityUser[]>("/identity/users").then((r) => r.data),
};
