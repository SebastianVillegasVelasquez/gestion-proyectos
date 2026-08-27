import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../api/reports.api";

export const reportKeys = {
  all: ["reports"] as const,
  project: (projectId: string) => [...reportKeys.all, projectId] as const,
};

export function useProjectReport(projectId: string | undefined) {
  return useQuery({
    queryKey: reportKeys.project(projectId ?? ""),
    queryFn: () => reportsApi.get(projectId!),
    enabled: Boolean(projectId),
  });
}
