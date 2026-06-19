import http from "@/features/auth/api/http";
import type { ProjectAreas } from "@/features/projects/types/api.types";

// Cliente HTTP del avance por área (cargo) de un proyecto. Solo lee; el cálculo
// y la agrupación los resuelve el backend.
export const areasApi = {
  get: (projectId: string) =>
    http.get<ProjectAreas>(`/projects/${projectId}/areas`).then((r) => r.data),
};
