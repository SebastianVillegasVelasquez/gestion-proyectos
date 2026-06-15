import http from "@/features/auth/api/http";
import type {
  CreatePhasePayload,
  Phase,
  UpdatePhasePayload,
} from "@/features/projects/types/api.types";

export const phasesApi = {
  list: (projectId: string) =>
    http.get<Phase[]>(`/projects/${projectId}/phases`).then((r) => r.data),

  create: (projectId: string, payload: CreatePhasePayload) =>
    http.post<Phase>(`/projects/${projectId}/phases`, payload).then((r) => r.data),

  update: (projectId: string, phaseId: string, payload: UpdatePhasePayload) =>
    http.patch<Phase>(`/projects/${projectId}/phases/${phaseId}`, payload).then((r) => r.data),

  remove: (projectId: string, phaseId: string) =>
    http.delete(`/projects/${projectId}/phases/${phaseId}`).then(() => undefined),
};
