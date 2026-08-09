import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/features/dashboard/api/dashboard.api";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
  panels: () => [...dashboardKeys.all, "panels"] as const,
  activity: () => [...dashboardKeys.all, "activity"] as const,
  mySummary: () => [...dashboardKeys.all, "me", "summary"] as const,
  myPanels: () => [...dashboardKeys.all, "me", "panels"] as const,
  myProject: (projectId: string) => [...dashboardKeys.all, "me", "project", projectId] as const,
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

export function useRecentActivity(limit = 10) {
  return useQuery({
    queryKey: dashboardKeys.activity(),
    queryFn: () => dashboardApi.getActivity(limit),
    staleTime: 30_000,
  });
}

// ── Scope del usuario autenticado (rol User) ──
export function useMyDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.mySummary(),
    queryFn: dashboardApi.getMySummary,
    staleTime: 60_000,
  });
}

export function useMyDashboardPanels() {
  return useQuery({
    queryKey: dashboardKeys.myPanels(),
    queryFn: dashboardApi.getMyPanels,
    staleTime: 60_000,
  });
}

export function useMyProjectProgress(projectId: string) {
  return useQuery({
    queryKey: dashboardKeys.myProject(projectId),
    queryFn: () => dashboardApi.getMyProjectProgress(projectId),
    staleTime: 60_000,
  });
}
