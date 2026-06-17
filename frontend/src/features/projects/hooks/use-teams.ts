import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { teamsApi } from "@/features/projects/api/teams.api";
import type { TeamSearchParams } from "@/features/projects/types/api.types";
import { teamKeys } from "./query-keys";

/** Lista paginada de equipos de trabajo (con búsqueda opcional por nombre). */
export function useTeams(params: TeamSearchParams = {}) {
  return useQuery({
    queryKey: teamKeys.list(params),
    queryFn: () => teamsApi.list(params),
    // Mantiene los resultados previos visibles mientras llega la nueva búsqueda.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Detalle de un equipo concreto. */
export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: teamKeys.detail(teamId ?? ""),
    queryFn: () => teamsApi.get(teamId!),
    enabled: Boolean(teamId),
  });
}

/** Integrantes de un equipo. */
export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: teamKeys.members(teamId ?? ""),
    queryFn: () => teamsApi.members(teamId!),
    enabled: Boolean(teamId),
  });
}
