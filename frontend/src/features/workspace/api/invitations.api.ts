import http from "@/lib/http";

export type InvitationStatus = "pendiente" | "aceptada" | "rechazada";

export interface TeamInvitation {
  id: string;
  team_id: string;
  team_name: string;
  project_id: string;
  user_id: string;
  user_name: string;
  invited_by_id: string;
  invited_by_name: string;
  status: InvitationStatus;
  created_at: string;
  responded_at: string | null;
}

export const invitationsApi = {
  // ── Gestión (líder / admin) ──
  invite: (projectId: string, teamId: string, userId: string) =>
    http
      .post<TeamInvitation>(`/projects/${projectId}/teams/${teamId}/invitations`, {
        user_id: userId,
      })
      .then((r) => r.data),

  listForTeam: (projectId: string, teamId: string) =>
    http
      .get<TeamInvitation[]>(`/projects/${projectId}/teams/${teamId}/invitations`)
      .then((r) => r.data),

  listProjectPending: (projectId: string) =>
    http
      .get<TeamInvitation[]>(`/projects/${projectId}/teams/invitations/pending`)
      .then((r) => r.data),

  // ── Usuario invitado ──
  mine: (status?: InvitationStatus) =>
    http
      .get<TeamInvitation[]>("/teams/invitations/mine", {
        params: status ? { status_filter: status } : undefined,
      })
      .then((r) => r.data),

  accept: (invitationId: string) =>
    http.post<TeamInvitation>(`/teams/invitations/${invitationId}/accept`).then((r) => r.data),

  reject: (invitationId: string) =>
    http.post<TeamInvitation>(`/teams/invitations/${invitationId}/reject`).then((r) => r.data),
};
