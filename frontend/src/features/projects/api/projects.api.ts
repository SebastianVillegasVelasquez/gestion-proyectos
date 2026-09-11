import http from "@/lib/http";
import type {
  ClientAccessInfo,
  ClientScheduleConfig,
  CreateProjectNotePayload,
  CreateProjectPayload,
  Project,
  ProjectNote,
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

  // Portal del cliente: token para armar el enlace público /portal/{token} +
  // el alcance actual del cronograma que verá el cliente.
  getClientAccess: (id: string) =>
    http.get<ClientAccessInfo>(`/projects/${id}/client-access`).then((r) => r.data),

  regenerateClientAccess: (id: string) =>
    http.post<ClientAccessInfo>(`/projects/${id}/client-access/regenerate`).then((r) => r.data),

  /** Guarda hasta qué profundidad ve el cliente el cronograma Gantt. */
  saveClientScheduleConfig: (id: string, cfg: ClientScheduleConfig) =>
    http
      .patch<Project>(`/projects/${id}`, {
        client_schedule_element_depth: cfg.element_depth,
        client_schedule_include_tasks: cfg.include_tasks,
        client_schedule_include_subtasks: cfg.include_subtasks,
      })
      .then((r) => r.data),

  // Notas / recordatorios del proyecto.
  listNotes: (id: string) => http.get<ProjectNote[]>(`/projects/${id}/notes`).then((r) => r.data),

  createNote: (id: string, payload: CreateProjectNotePayload) =>
    http.post<ProjectNote>(`/projects/${id}/notes`, payload).then((r) => r.data),

  deleteNote: (id: string, noteId: string) =>
    http.delete(`/projects/${id}/notes/${noteId}`).then(() => undefined),
};
