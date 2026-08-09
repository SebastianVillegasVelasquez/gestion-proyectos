import http from "@/lib/http";
import type {
  DashboardPanels,
  DashboardSummary,
  MyProjectProgress,
  RecentActivity,
} from "@/features/dashboard/types";

export const dashboardApi = {
  getSummary: () => http.get<DashboardSummary>("/dashboard/summary").then((r) => r.data),

  getPanels: () => http.get<DashboardPanels>("/dashboard/panels").then((r) => r.data),

  // Actividad reciente global (dashboard admin). Trae hasta `limit` eventos.
  getActivity: (limit = 10) =>
    http.get<RecentActivity>("/dashboard/activity", { params: { limit } }).then((r) => r.data),

  // ── Scope del usuario autenticado (rol User) ──
  getMySummary: () => http.get<DashboardSummary>("/dashboard/me/summary").then((r) => r.data),

  getMyPanels: () => http.get<DashboardPanels>("/dashboard/me/panels").then((r) => r.data),

  getMyProjectProgress: (projectId: string) =>
    http.get<MyProjectProgress>(`/dashboard/me/projects/${projectId}`).then((r) => r.data),
};
