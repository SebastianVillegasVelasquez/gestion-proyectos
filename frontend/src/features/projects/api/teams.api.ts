import http from "@/lib/http";
import type {
  AddTeamMemberPayload,
  CreateTeamPayload,
  PaginatedTeams,
  Team,
  TeamMember,
  TeamRole,
  TeamSearchParams,
  UpdateTeamPayload,
} from "@/features/projects/types/api.types";

// Cliente HTTP del bounded context `teams`. Los equipos viven dentro de un
// proyecto, así que todas las rutas cuelgan de /projects/{projectId}/teams.
// Solo traduce parámetros a la API; no contiene lógica de negocio (esa vive
// en el backend y en utils puras).
export const teamsApi = {
  list: (projectId: string, { search, page = 1, pageSize = 50 }: TeamSearchParams = {}) => {
    // Enviamos solo los filtros con valor para no ensuciar la URL (?search=).
    const params: Record<string, string | number> = { page, page_size: pageSize };
    if (search) {
      params.search = search;
    }
    return http.get<PaginatedTeams>(`/projects/${projectId}/teams`, { params }).then((r) => r.data);
  },

  get: (projectId: string, teamId: string) =>
    http.get<Team>(`/projects/${projectId}/teams/${teamId}`).then((r) => r.data),

  create: (projectId: string, payload: CreateTeamPayload) =>
    http.post<Team>(`/projects/${projectId}/teams`, payload).then((r) => r.data),

  update: (projectId: string, teamId: string, payload: UpdateTeamPayload) =>
    http.patch<Team>(`/projects/${projectId}/teams/${teamId}`, payload).then((r) => r.data),

  remove: (projectId: string, teamId: string): Promise<void> =>
    http.delete(`/projects/${projectId}/teams/${teamId}`).then(() => undefined),

  members: (projectId: string, teamId: string) =>
    http.get<TeamMember[]>(`/projects/${projectId}/teams/${teamId}/members`).then((r) => r.data),

  addMember: (projectId: string, teamId: string, payload: AddTeamMemberPayload) =>
    http
      .post<TeamMember>(`/projects/${projectId}/teams/${teamId}/members`, payload)
      .then((r) => r.data),

  changeMemberRole: (projectId: string, teamId: string, userId: string, teamRole: TeamRole) =>
    http
      .patch<TeamMember>(`/projects/${projectId}/teams/${teamId}/members/${userId}`, {
        team_role: teamRole,
      })
      .then((r) => r.data),

  removeMember: (projectId: string, teamId: string, userId: string): Promise<void> =>
    http.delete(`/projects/${projectId}/teams/${teamId}/members/${userId}`).then(() => undefined),
};
