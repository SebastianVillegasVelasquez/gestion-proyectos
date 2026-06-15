import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nodesApi } from "@/features/projects/api/nodes.api";
import { projectKeys } from "./query-keys";
import type { CreateNodePayload, UpdateNodePayload } from "@/features/projects/types/api.types";

export function useNodes(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.nodes(projectId ?? ""),
    queryFn: () => nodesApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreateNodes(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateNodePayload | CreateNodePayload[]) => nodesApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.nodes(projectId) }),
  });
}

export function useUpdateNode(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, payload }: { nodeId: string; payload: UpdateNodePayload }) =>
      nodesApi.update(projectId, nodeId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.nodes(projectId) }),
  });
}
