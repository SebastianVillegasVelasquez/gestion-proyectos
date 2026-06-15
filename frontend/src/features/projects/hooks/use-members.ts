import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi, usersApi } from "@/features/projects/api/members.api";
import { projectKeys, userKeys } from "./query-keys";
import type { ProjectRole } from "@/features/projects/types/api.types";

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.members(projectId ?? ""),
    queryFn: () => membersApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useAddMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: ProjectRole }) =>
      membersApi.add({
        user_id: input.userId,
        project_id: projectId,
        project_role: input.role,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.members(projectId) }),
  });
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: usersApi.list,
    enabled,
    staleTime: 60_000,
  });
}
