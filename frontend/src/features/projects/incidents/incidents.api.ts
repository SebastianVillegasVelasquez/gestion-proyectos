import http from "@/lib/http";
import type { CreateIncidentPayload, ProjectIncident, UpdateIncidentPayload } from "./types";

const base = (projectId: string) => `/projects/${projectId}/incidents`;

export const incidentsApi = {
  list: (projectId: string) => http.get<ProjectIncident[]>(base(projectId)).then((r) => r.data),

  create: (projectId: string, payload: CreateIncidentPayload) =>
    http.post<ProjectIncident>(base(projectId), payload).then((r) => r.data),

  update: (projectId: string, incidentId: string, payload: UpdateIncidentPayload) =>
    http.patch<ProjectIncident>(`${base(projectId)}/${incidentId}`, payload).then((r) => r.data),

  remove: (projectId: string, incidentId: string) =>
    http.delete(`${base(projectId)}/${incidentId}`).then(() => undefined),

  /** Suma los días del incidente a la fecha de fin del proyecto. */
  apply: (projectId: string, incidentId: string) =>
    http.post<ProjectIncident>(`${base(projectId)}/${incidentId}/apply`).then((r) => r.data),

  revert: (projectId: string, incidentId: string) =>
    http.post<ProjectIncident>(`${base(projectId)}/${incidentId}/revert`).then((r) => r.data),

  /** Refleja de una vez todos los atrasos pendientes (operación atómica). */
  applyPending: (projectId: string) =>
    http.post<ProjectIncident[]>(`${base(projectId)}/apply-pending`).then((r) => r.data),

  uploadAttachment: (projectId: string, incidentId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return http
      .post<ProjectIncident>(`${base(projectId)}/${incidentId}/attachments`, form, {
        timeout: 120_000,
      })
      .then((r) => r.data);
  },

  removeAttachment: (projectId: string, incidentId: string, attachmentId: string) =>
    http
      .delete<ProjectIncident>(`${base(projectId)}/${incidentId}/attachments/${attachmentId}`)
      .then((r) => r.data),

  /** La evidencia va autenticada: se pide como blob, no como `<img src>`. */
  attachmentBlob: (
    projectId: string,
    incidentId: string,
    attachmentId: string,
    mode: "view" | "download",
  ) =>
    http
      .get<Blob>(`${base(projectId)}/${incidentId}/attachments/${attachmentId}/${mode}`, {
        responseType: "blob",
        timeout: 120_000,
      })
      .then((r) => r.data),
};
