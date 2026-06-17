import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teamsApi } from "@/features/projects/api/teams.api";
import type { TeamSearchParams, UpdateTeamPayload } from "@/features/projects/types/api.types";
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

/** Edita un equipo (nombre/descripción) e invalida su detalle y la lista. */
export function useUpdateTeam(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTeamPayload) => teamsApi.update(teamId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
      void qc.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}

/** Elimina (soft delete) un equipo e invalida la lista de equipos. */
export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => teamsApi.remove(teamId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}
