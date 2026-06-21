import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceApi, type NewCommentBody, type NewVersionBody } from "../api/workspace.api";

const keys = {
  myTeams: ["workspace", "my-teams"] as const,
  members: (teamId: string) => ["workspace", "members", teamId] as const,
  access: (teamId: string) => ["workspace", "access", teamId] as const,
  deliverables: (teamId: string) => ["workspace", "deliverables", teamId] as const,
};

export function useMyTeams() {
  return useQuery({ queryKey: keys.myTeams, queryFn: workspaceApi.myTeams });
}

export function useTeamMembers(teamId: string | null) {
  return useQuery({
    queryKey: keys.members(teamId ?? ""),
    queryFn: () => workspaceApi.members(teamId!),
    enabled: Boolean(teamId),
  });
}

export function useWorkspaceAccess(teamId: string | null) {
  return useQuery({
    queryKey: keys.access(teamId ?? ""),
    queryFn: () => workspaceApi.access(teamId!),
    enabled: Boolean(teamId),
  });
}

export function useDeliverables(teamId: string | null) {
  return useQuery({
    queryKey: keys.deliverables(teamId ?? ""),
    queryFn: () => workspaceApi.deliverables(teamId!),
    enabled: Boolean(teamId),
  });
}

/** Las mutaciones invalidan los entregables del equipo para refrescar la vista. */
function useDeliverableMutation<TVars, TData>(
  teamId: string | null,
  fn: (vars: TVars) => Promise<TData>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (teamId) {
        void qc.invalidateQueries({ queryKey: keys.deliverables(teamId) });
      }
    },
  });
}

export function useCreateDeliverable(teamId: string | null) {
  return useDeliverableMutation(teamId, (body: { task_title: string; assignee_id: string }) =>
    workspaceApi.createDeliverable(teamId!, body),
  );
}

export function useAddVersion(teamId: string | null) {
  return useDeliverableMutation(teamId, (vars: { deliverableId: string; body: NewVersionBody }) =>
    workspaceApi.addVersion(teamId!, vars.deliverableId, vars.body),
  );
}

export function useAddComment(teamId: string | null) {
  return useDeliverableMutation(teamId, (vars: { deliverableId: string; body: NewCommentBody }) =>
    workspaceApi.addComment(teamId!, vars.deliverableId, vars.body),
  );
}
