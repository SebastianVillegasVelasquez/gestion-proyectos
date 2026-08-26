import http from "@/lib/http";

export interface ReportRow {
  elemento: string | null;
  tarea: string;
  responsable: string | null;
  equipo: string | null;
  estado: string;
  prioridad: string;
  inicio: string | null;
  fin: string | null;
  horas_estimadas: string | null;
  horas_dedicadas: string;
}

export interface PersonEffort {
  nombre: string;
  horas: string;
}

export interface ProjectReport {
  project_id: string;
  project_name: string;
  total_tareas: number;
  tareas_por_estado: Record<string, number>;
  horas_estimadas: string;
  horas_dedicadas: string;
  horas_por_persona: PersonEffort[];
  filas: ReportRow[];
}

export const reportsApi = {
  get: (projectId: string) =>
    http.get<ProjectReport>(`/projects/${projectId}/report`).then((r) => r.data),

  /** El CSV se pide como blob: es un archivo, no datos que la app vaya a leer. */
  downloadCsv: (projectId: string) =>
    http
      .get<Blob>(`/projects/${projectId}/report.csv`, { responseType: "blob" })
      .then((r) => ({ blob: r.data, disposition: r.headers["content-disposition"] as string })),
};
