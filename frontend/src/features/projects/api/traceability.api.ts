import http from "@/features/auth/api/http";
import type { ProjectTraceability } from "@/features/projects/types/api.types";

// Cliente HTTP de la trazabilidad de un proyecto. Solo lee; la clasificación de
// eventos (tipo + retraso) la resuelve el backend.
export const traceabilityApi = {
  get: (projectId: string) =>
    http.get<ProjectTraceability>(`/projects/${projectId}/traceability`).then((r) => r.data),
};
