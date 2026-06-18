import http from "@/features/auth/api/http";
import type { DashboardPanels, DashboardSummary } from "@/features/dashboard/types";

export const dashboardApi = {
  getSummary: () => http.get<DashboardSummary>("/dashboard/summary").then((r) => r.data),

  getPanels: () => http.get<DashboardPanels>("/dashboard/panels").then((r) => r.data),
};
