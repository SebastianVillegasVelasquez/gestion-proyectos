import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectKeys } from "../hooks/query-keys";
import { incidentsApi } from "./incidents.api";
import type { CreateIncidentPayload, ProjectIncident, UpdateIncidentPayload } from "./types";

/**
 * Bitácora de incidentes del proyecto. `enabled` permite pedirla solo a quien
 * puede verla (administración): el backend responde 403 al resto.
 */
export function useProjectIncidents(projectId: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.incidents(projectId),
    queryFn: () => incidentsApi.list(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

/** Mutaciones que solo tocan la bitácora. */
function useIncidentMutation<TVariables, TResult>(
  projectId: string,
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.incidents(projectId) }),
  });
}

/** Mutaciones que además mueven la fecha de fin del proyecto: refrescan el
 *  detalle (cronograma, información general) y el listado de proyectos. */
function useScheduleMutation<TVariables, TResult>(
  projectId: string,
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
        qc.invalidateQueries({ queryKey: projectKeys.list() }),
      ]);
    },
  });
}

export const useCreateIncident = (projectId: string) =>
  useIncidentMutation(projectId, (payload: CreateIncidentPayload) =>
    incidentsApi.create(projectId, payload),
  );

export const useUpdateIncident = (projectId: string) =>
  useIncidentMutation(
    projectId,
    ({ id, payload }: { id: string; payload: UpdateIncidentPayload }) =>
      incidentsApi.update(projectId, id, payload),
  );

export const useDeleteIncident = (projectId: string) =>
  useIncidentMutation(projectId, (id: string) => incidentsApi.remove(projectId, id));

export const useUploadIncidentAttachment = (projectId: string) =>
  useIncidentMutation(projectId, ({ id, file }: { id: string; file: File }) =>
    incidentsApi.uploadAttachment(projectId, id, file),
  );

export const useRemoveIncidentAttachment = (projectId: string) =>
  useIncidentMutation(projectId, ({ id, attachmentId }: { id: string; attachmentId: string }) =>
    incidentsApi.removeAttachment(projectId, id, attachmentId),
  );

export const useApplyIncident = (projectId: string) =>
  useScheduleMutation(projectId, (id: string) => incidentsApi.apply(projectId, id));

export const useRevertIncident = (projectId: string) =>
  useScheduleMutation(projectId, (id: string) => incidentsApi.revert(projectId, id));

export const useApplyPendingIncidents = (projectId: string) =>
  useScheduleMutation<undefined, ProjectIncident[]>(projectId, () =>
    incidentsApi.applyPending(projectId),
  );
