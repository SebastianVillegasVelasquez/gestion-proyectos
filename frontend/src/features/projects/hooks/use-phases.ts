import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { phasesApi } from "@/features/projects/api/phases.api";
import { projectKeys } from "./query-keys";
import type { CreatePhasePayload, UpdatePhasePayload } from "@/features/projects/types/api.types";

export function usePhases(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.phases(projectId ?? ""),
    queryFn: () => phasesApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreatePhase(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePhasePayload) => phasesApi.create(projectId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.phases(projectId) }),
  });
}

export function useUpdatePhase(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, payload }: { phaseId: string; payload: UpdatePhasePayload }) =>
      phasesApi.update(projectId, phaseId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.phases(projectId) }),
  });
}

export function useDeletePhase(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (phaseId: string) => phasesApi.remove(projectId, phaseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.phases(projectId) }),
  });
}
