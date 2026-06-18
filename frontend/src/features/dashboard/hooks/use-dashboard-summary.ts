import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/features/dashboard/api/dashboard.api";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
  panels: () => [...dashboardKeys.all, "panels"] as const,
};

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: dashboardApi.getSummary,
    staleTime: 60_000,
  });
}

export function useDashboardPanels() {
  return useQuery({
    queryKey: dashboardKeys.panels(),
    queryFn: dashboardApi.getPanels,
    staleTime: 60_000,
  });
}
