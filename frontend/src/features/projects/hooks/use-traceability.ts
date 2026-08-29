import { useQuery } from "@tanstack/react-query";
import { traceabilityApi } from "@/features/projects/api/traceability.api";
import { projectKeys } from "./query-keys";

/** Historial de trazabilidad (línea de tiempo + resumen) de un proyecto.
 *
 * `teamId` acota la consulta a un equipo: se usa en el espacio de trabajo, donde
 * un líder/supervisor de equipo ve el historial de su equipo sin organizar el
 * proyecto entero. */
export function useProjectTraceability(projectId: string | undefined, teamId?: string) {
  return useQuery({
    queryKey: projectKeys.traceability(projectId ?? "", teamId),
    queryFn: () => traceabilityApi.get(projectId!, teamId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}
