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

/** Lista paginada de equipos de un proyecto (con búsqueda opcional por nombre). */
export function useTeams(projectId: string, params: TeamSearchParams = {}) {
  return useQuery({
    queryKey: teamKeys.list(projectId, params),
    queryFn: () => teamsApi.list(projectId, params),
    enabled: Boolean(projectId),
    // Mantiene los resultados previos visibles mientras llega la nueva búsqueda.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Equipos del proyecto a los que pertenece el usuario autenticado (rol User). */
export function useMyTeams(projectId: string | undefined) {
  return useQuery({
    queryKey: teamKeys.mine(projectId ?? ""),
    queryFn: () => teamsApi.mine(projectId!),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

/** Detalle de un equipo concreto. */
export function useTeam(projectId: string, teamId: string | undefined) {
  return useQuery({
    queryKey: teamKeys.detail(projectId, teamId ?? ""),
    queryFn: () => teamsApi.get(projectId, teamId!),
    enabled: Boolean(projectId) && Boolean(teamId),
  });
}

/** Integrantes de un equipo. */
export function useTeamMembers(projectId: string, teamId: string | undefined) {
  return useQuery({
    queryKey: teamKeys.members(projectId, teamId ?? ""),
    queryFn: () => teamsApi.members(projectId, teamId!),
    enabled: Boolean(projectId) && Boolean(teamId),
  });
}

/** Crea un equipo dentro del proyecto e invalida su lista. */
export function useCreateTeam(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTeamPayload) => teamsApi.create(projectId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: teamKeys.byProject(projectId) });
    },
  });
}

/** Edita un equipo (nombre/descripción) e invalida su detalle y la lista. */
export function useUpdateTeam(projectId: string, teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTeamPayload) => teamsApi.update(projectId, teamId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: teamKeys.detail(projectId, teamId) });
      void qc.invalidateQueries({ queryKey: teamKeys.byProject(projectId) });
    },
  });
}

/** Elimina (soft delete) un equipo e invalida la lista de equipos del proyecto. */
export function useDeleteTeam(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => teamsApi.remove(projectId, teamId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: teamKeys.byProject(projectId) });
    },
  });
}

/** Invalida los integrantes de un equipo y la lista (cambia el member_count). */
function invalidateTeamMembers(
  qc: ReturnType<typeof useQueryClient>,
  projectId: string,
  teamId: string,
) {
  void qc.invalidateQueries({ queryKey: teamKeys.members(projectId, teamId) });
  void qc.invalidateQueries({ queryKey: teamKeys.byProject(projectId) });
}

/** Agrega un integrante a un equipo. */
export function useAddTeamMember(projectId: string, teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddTeamMemberPayload) => teamsApi.addMember(projectId, teamId, payload),
    onSuccess: () => {
      invalidateTeamMembers(qc, projectId, teamId);
    },
  });
}

/** Cambia el rol de un integrante dentro del equipo. */
export function useChangeTeamMemberRole(projectId: string, teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; teamRole: TeamRole }) =>
      teamsApi.changeMemberRole(projectId, teamId, vars.userId, vars.teamRole),
    onSuccess: () => {
      invalidateTeamMembers(qc, projectId, teamId);
    },
  });
}

/** Quita un integrante del equipo. */
export function useRemoveTeamMember(projectId: string, teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => teamsApi.removeMember(projectId, teamId, userId),
    onSuccess: () => {
      invalidateTeamMembers(qc, projectId, teamId);
    },
  });
}
