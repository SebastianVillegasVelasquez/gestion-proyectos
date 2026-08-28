import http from "@/lib/http";
import type {
  DashboardPanels,
  DashboardProjectItem,
  DashboardSummary,
  MyProjectProgress,
  RecentActivity,
} from "@/features/dashboard/types";

export const dashboardApi = {
  getSummary: () => http.get<DashboardSummary>("/dashboard/summary").then((r) => r.data),

  getPanels: () => http.get<DashboardPanels>("/dashboard/panels").then((r) => r.data),

  // Actividad reciente. Sin `projectId` es global (dashboard admin); con él se
  // acota a un proyecto (detalle de proyecto). Trae hasta `limit` eventos.
  getActivity: (limit = 10, projectId?: string) =>
    http
      .get<RecentActivity>("/dashboard/activity", {
        params: { limit, ...(projectId ? { project_id: projectId } : {}) },
      })
      .then((r) => r.data),

  // ── Scope del usuario autenticado (rol User) ──
  getMySummary: () => http.get<DashboardSummary>("/dashboard/me/summary").then((r) => r.data),

  getMyPanels: () => http.get<DashboardPanels>("/dashboard/me/panels").then((r) => r.data),

  getMyProjectProgress: (projectId: string) =>
    http.get<MyProjectProgress>(`/dashboard/me/projects/${projectId}`).then((r) => r.data),

  // Lista completa de proyectos donde el usuario es miembro ("Mis proyectos").
  getMyProjects: () =>
    http.get<DashboardProjectItem[]>("/dashboard/me/projects").then((r) => r.data),
};
