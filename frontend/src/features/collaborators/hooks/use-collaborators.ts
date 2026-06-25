import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { collaboratorsApi } from "../api/collaborators.api";
import type { CollaboratorSearchParams } from "../types";

// Claves de cache locales al feature (evita strings mágicos y permite
// invalidaciones consistentes sin acoplar con las claves de otros módulos).
export const collaboratorKeys = {
  all: ["collaborators"] as const,
  list: (params: CollaboratorSearchParams) =>
    [
      ...collaboratorKeys.all,
      "list",
      params.search ?? "",
      params.page ?? 1,
      params.pageSize ?? 10,
    ] as const,
  activity: (userId: string) => [...collaboratorKeys.all, "activity", userId] as const,
};

/** Tabla paginada de colaboradores (con búsqueda opcional). */
export function useCollaborators(params: CollaboratorSearchParams = {}) {
  return useQuery({
    queryKey: collaboratorKeys.list(params),
    queryFn: () => collaboratorsApi.list(params),
    // Mantiene la página previa visible mientras llega la nueva (sin parpadeo).
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Detalle de actividad de un colaborador. */
export function useCollaboratorActivity(userId: string | undefined) {
  return useQuery({
    queryKey: collaboratorKeys.activity(userId ?? ""),
    queryFn: () => collaboratorsApi.activity(userId!),
    enabled: Boolean(userId),
  });
}
