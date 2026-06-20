import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { structureApi } from "@/features/projects/api/structure.api";
import { projectKeys } from "./query-keys";
import type {
  CloneWorkItemPayload,
  CreateTipoNodoPayload,
  CreateWorkItemPayload,
  UpdateWorkItemPayload,
} from "@/features/projects/types/api.types";

export function useWorkTree(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.tree(projectId ?? ""),
    queryFn: () => structureApi.tree(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useNodeTypes(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.nodeTypes(projectId ?? ""),
    queryFn: () => structureApi.listTypes(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreateNodeType(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTipoNodoPayload) => structureApi.createType(projectId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.nodeTypes(projectId) }),
  });
}

export function useCreateWorkItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkItemPayload) => structureApi.create(projectId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) }),
  });
}

export function useUpdateWorkItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: UpdateWorkItemPayload }) =>
      structureApi.update(itemId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) }),
  });
}

export function useCloneWorkItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: CloneWorkItemPayload }) =>
      structureApi.clone(itemId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) }),
  });
}

export function useDeleteWorkItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => structureApi.remove(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) }),
  });
}

export function useAddWorkItemDependency(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, dependsOnId }: { itemId: string; dependsOnId: string }) =>
      structureApi.addDependency(itemId, dependsOnId),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) }),
  });
}
