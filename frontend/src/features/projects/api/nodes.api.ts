import http from "@/features/auth/api/http";
import type {
  CreateNodePayload,
  ProjectNode,
  UpdateNodePayload,
} from "@/features/projects/types/api.types";

export const nodesApi = {
  list: (projectId: string) =>
    http.get<ProjectNode[]>(`/projects/${projectId}/nodes`).then((r) => r.data),

  // El backend acepta un nodo o una cadena de nodos (programa>curso>módulo).
  create: (payload: CreateNodePayload | CreateNodePayload[]) =>
    http.post<ProjectNode | ProjectNode[]>("/projects/nodes", payload).then((r) => r.data),

  update: (projectId: string, nodeId: string, payload: UpdateNodePayload) =>
    http.patch<ProjectNode>(`/projects/${projectId}/nodes/${nodeId}`, payload).then((r) => r.data),
};
