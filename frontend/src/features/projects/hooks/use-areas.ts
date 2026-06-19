import { useQuery } from "@tanstack/react-query";
import { areasApi } from "@/features/projects/api/areas.api";
import { projectKeys } from "./query-keys";

/** Avance por área/equipo (agrupado por cargo) de un proyecto. */
export function useProjectAreas(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.areas(projectId ?? ""),
    queryFn: () => areasApi.get(projectId!),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}
