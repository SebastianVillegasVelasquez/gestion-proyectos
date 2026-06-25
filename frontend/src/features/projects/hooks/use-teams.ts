import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teamsApi } from "@/features/projects/api/teams.api";
import type {
  AddTeamMemberPayload,
  CreateTeamPayload,
  TeamRole,
  TeamSearchParams,
  UpdateTeamPayload,
} from "@/features/projects/types/api.types";
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

/** Crea un equipo e invalida la lista de equipos. */
export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTeamPayload) => teamsApi.create(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: teamKeys.all });
    },
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

/** Invalida los integrantes de un equipo y la lista (cambia el member_count). */
function invalidateTeamMembers(qc: ReturnType<typeof useQueryClient>, teamId: string) {
  void qc.invalidateQueries({ queryKey: teamKeys.members(teamId) });
  void qc.invalidateQueries({ queryKey: teamKeys.all });
}

/** Agrega un integrante a un equipo. */
export function useAddTeamMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddTeamMemberPayload) => teamsApi.addMember(teamId, payload),
    onSuccess: () => {
      invalidateTeamMembers(qc, teamId);
    },
  });
}

/** Cambia el rol de un integrante dentro del equipo. */
export function useChangeTeamMemberRole(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; teamRole: TeamRole }) =>
      teamsApi.changeMemberRole(teamId, vars.userId, vars.teamRole),
    onSuccess: () => {
      invalidateTeamMembers(qc, teamId);
    },
  });
}

/** Quita un integrante del equipo. */
export function useRemoveTeamMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => teamsApi.removeMember(teamId, userId),
    onSuccess: () => {
      invalidateTeamMembers(qc, teamId);
    },
  });
}
