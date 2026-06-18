import { useQuery } from "@tanstack/react-query";
import { traceabilityApi } from "@/features/projects/api/traceability.api";
import { projectKeys } from "./query-keys";

/** Historial de trazabilidad (línea de tiempo + resumen) de un proyecto. */
export function useProjectTraceability(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.traceability(projectId ?? ""),
    queryFn: () => traceabilityApi.get(projectId!),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}
