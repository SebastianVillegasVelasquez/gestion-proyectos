import http from "@/lib/http";
import type {
  AddMemberPayload,
  DirectorySearchParams,
  DirectoryUser,
  IdentityUser,
  PaginatedDirectory,
  ProjectMember,
  ProjectRole,
  UserPosition,
} from "@/features/projects/types/api.types";

export const membersApi = {
  list: (projectId: string) =>
    http.get<ProjectMember[]>(`/projects/${projectId}/members`).then((r) => r.data),

  add: (payload: AddMemberPayload) =>
    http.post<ProjectMember>("/projects/members/", payload).then((r) => r.data),

  updateRole: (memberId: string, projectRole: ProjectRole) =>
    http
      .patch<ProjectMember>(`/projects/members/${memberId}`, { project_role: projectRole })
      .then((r) => r.data),

  remove: (memberId: string) => http.delete(`/projects/members/${memberId}`),
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

  // Búsqueda paginada por nombre/correo/cargo (para selectores con muchos usuarios).
  search: async ({ search, position, page = 1, pageSize = 8 }: DirectorySearchParams) => {
    // Solo enviamos los filtros que tienen valor (evita ?search=&position=).
    const params: Record<string, string | number> = { page, page_size: pageSize };
    if (search) {
      params.search = search;
    }
    if (position) {
      params.position = position;
    }
    const r = await http.get<PaginatedDirectory>("/identity/users/search", { params });
    return r.data;
  },
};
