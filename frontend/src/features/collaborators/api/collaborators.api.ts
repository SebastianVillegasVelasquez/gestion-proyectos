import http from "@/features/auth/api/http";
import type {
  CollaboratorActivity,
  CollaboratorSearchParams,
  PaginatedCollaborators,
} from "../types";

// Cliente HTTP del read model de colaboradores. Solo traduce parámetros a la
// API; la lógica de negocio vive en el backend y en utils puras.
export const collaboratorsApi = {
  list: ({ search, page = 1, pageSize = 10 }: CollaboratorSearchParams = {}) => {
    // Enviamos solo los filtros con valor (evita ?search= en la URL).
    const params: Record<string, string | number> = { page, page_size: pageSize };
    if (search) {
      params.search = search;
    }
    return http.get<PaginatedCollaborators>("/collaborators/", { params }).then((r) => r.data);
  },

  activity: (userId: string) =>
    http.get<CollaboratorActivity>(`/collaborators/${userId}`).then((r) => r.data),
};
