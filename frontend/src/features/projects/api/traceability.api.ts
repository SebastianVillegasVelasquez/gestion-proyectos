import http from "@/lib/http";
import type { ProjectTraceability } from "@/features/projects/types/api.types";

// Cliente HTTP de la trazabilidad de un proyecto. Solo lee; la clasificación de
// eventos (tipo + retraso) la resuelve el backend.
//
// `teamId` acota la línea de tiempo a un equipo: además de filtrar, es lo que
// autoriza a un líder/supervisor de equipo que NO organiza el proyecto entero
// a consultar el historial de su equipo (el backend responde 403 sin él).
export const traceabilityApi = {
  get: (projectId: string, teamId?: string) =>
    http
      .get<ProjectTraceability>(`/projects/${projectId}/traceability`, {
        params: teamId ? { team_id: teamId } : undefined,
      })
      .then((r) => r.data),
};
