import http from "@/features/auth/api/http";
import type {
  AddMemberPayload,
  DirectoryUser,
  DirectorySearchParams,
  IdentityUser,
  PaginatedDirectory,
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

  // Búsqueda paginada por nombre/correo/cargo (para selectores con muchos usuarios).
  search: ({ search, position, page = 1, pageSize = 8 }: DirectorySearchParams) => {
    // Solo enviamos los filtros que tienen valor (evita ?search=&position=).
    const params: Record<string, string | number> = { page, page_size: pageSize };
    if (search) {
      params.search = search;
    }
    if (position) {
      params.position = position;
    }
    return http.get<PaginatedDirectory>("/identity/users/search", { params }).then((r) => r.data);
  },
};
