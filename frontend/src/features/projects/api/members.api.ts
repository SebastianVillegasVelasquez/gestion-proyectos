import http from "@/features/auth/api/http";
import type {
  AddMemberPayload,
  DirectoryUser,
  IdentityUser,
  ProjectMember,
  UserPosition,
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

export const directoryApi = {
  // Usuarios asignables, opcionalmente filtrados por cargo.
  list: (position?: UserPosition) =>
    http
      .get<DirectoryUser[]>("/identity/directory", {
        params: position ? { position } : undefined,
      })
      .then((r) => r.data),
};
