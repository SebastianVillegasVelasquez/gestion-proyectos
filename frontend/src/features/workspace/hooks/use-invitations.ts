import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invitationsApi, type InvitationStatus } from "../api/invitations.api";

const keys = {
  mine: (status?: InvitationStatus) =>
    ["workspace", "invitations", "mine", status ?? "all"] as const,
  forTeam: (teamId: string) => ["workspace", "invitations", "team", teamId] as const,
  projectPending: (projectId: string) =>
    ["workspace", "invitations", "project-pending", projectId] as const,
};

/** Invalida todo lo que puede cambiar al invitar/aceptar/rechazar. */
function invalidateAll(
  qc: ReturnType<typeof useQueryClient>,
  ctx: { teamId?: string; projectId?: string },
) {
  void qc.invalidateQueries({ queryKey: ["workspace", "invitations"] });
  if (ctx.teamId) {
    void qc.invalidateQueries({ queryKey: ["workspace", "members", ctx.teamId] });
  }
  void qc.invalidateQueries({ queryKey: ["workspace", "my-teams"] });
}

export function useMyInvitations(status?: InvitationStatus, enabled = true) {
  return useQuery({
    queryKey: keys.mine(status),
    queryFn: () => invitationsApi.mine(status),
    enabled,
    staleTime: 30_000,
  });
}

export function useTeamInvitations(projectId: string, teamId: string, enabled = true) {
  return useQuery({
    queryKey: keys.forTeam(teamId),
    queryFn: () => invitationsApi.listForTeam(projectId, teamId),
    enabled: enabled && Boolean(projectId && teamId),
  });
}

export function useProjectPendingInvitations(projectId: string, enabled = true) {
  return useQuery({
    queryKey: keys.projectPending(projectId),
    queryFn: () => invitationsApi.listProjectPending(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

export function useInviteToTeam(projectId: string, teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => invitationsApi.invite(projectId, teamId, userId),
    onSuccess: () => {
      invalidateAll(qc, { teamId, projectId });
    },
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => invitationsApi.accept(invitationId),
    onSuccess: (inv) => {
      invalidateAll(qc, { teamId: inv.team_id, projectId: inv.project_id });
    },
  });
}

export function useRejectInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => invitationsApi.reject(invitationId),
    onSuccess: (inv) => {
      invalidateAll(qc, { teamId: inv.team_id, projectId: inv.project_id });
    },
  });
}
