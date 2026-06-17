import http from "@/features/auth/api/http";
import type {
  PaginatedTeams,
  Team,
  TeamMember,
  TeamSearchParams,
  UpdateTeamPayload,
} from "@/features/projects/types/api.types";

// Cliente HTTP del bounded context `teams`. Solo traduce parámetros a la API;
// no contiene lógica de negocio (esa vive en el backend y en utils puras).
export const teamsApi = {
  list: ({ search, page = 1, pageSize = 50 }: TeamSearchParams = {}) => {
    // Enviamos solo los filtros con valor para no ensuciar la URL (?search=).
    const params: Record<string, string | number> = { page, page_size: pageSize };
    if (search) {
      params.search = search;
    }
    return http.get<PaginatedTeams>("/teams/", { params }).then((r) => r.data);
  },

  get: (teamId: string) => http.get<Team>(`/teams/${teamId}`).then((r) => r.data),

  update: (teamId: string, payload: UpdateTeamPayload) =>
    http.patch<Team>(`/teams/${teamId}`, payload).then((r) => r.data),

  remove: (teamId: string): Promise<void> => http.delete(`/teams/${teamId}`).then(() => undefined),

  members: (teamId: string) =>
    http.get<TeamMember[]>(`/teams/${teamId}/members`).then((r) => r.data),
};
