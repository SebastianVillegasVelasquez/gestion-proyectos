import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { analyticsApi, type AnalyticsFilters } from "../api/analytics.api";

export function useProjectAnalytics(projectId: string | undefined, filters: AnalyticsFilters) {
  return useQuery({
    queryKey: ["reports", "analytics", projectId ?? "", filters],
    queryFn: () => analyticsApi.get(projectId!, filters),
    enabled: Boolean(projectId),
    // Al cambiar un filtro, mantener los datos anteriores mientras llega la
    // nueva respuesta evita que la página parpadee a "cargando".
    placeholderData: keepPreviousData,
  });
}
