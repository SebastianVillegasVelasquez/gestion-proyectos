import http from "@/features/auth/api/http";
import type { DashboardSummary } from "@/features/dashboard/types";

export const dashboardApi = {
  getSummary: () => http.get<DashboardSummary>("/dashboard/summary").then((r) => r.data),
};
