import http from "@/lib/http";
import type {
  CreateProjectPayload,
  Project,
  UpdateProjectPayload,
} from "@/features/projects/types/api.types";

export const projectsApi = {
  list: () => http.get<Project[]>("/projects/").then((r) => r.data),

  getById: (id: string) => http.get<Project>(`/projects/${id}`).then((r) => r.data),

  create: (payload: CreateProjectPayload) =>
    http.post<Project>("/projects/", payload).then((r) => r.data),

  update: (id: string, payload: UpdateProjectPayload) =>
    http.patch<Project>(`/projects/${id}`, payload).then((r) => r.data),

  remove: (id: string) => http.delete(`/projects/${id}`).then(() => undefined),
};
