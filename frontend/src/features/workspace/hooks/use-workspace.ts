import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/features/projects/api/tasks.api";
import type { CreateTaskPayload } from "@/features/projects/types/api.types";
import {
  workspaceApi,
  type CreateDeliverableBody,
  type NewCommentBody,
  type NewVersionBody,
} from "../api/workspace.api";

const keys = {
  myTeams: ["workspace", "my-teams"] as const,
  members: (teamId: string) => ["workspace", "members", teamId] as const,
  access: (teamId: string) => ["workspace", "access", teamId] as const,
  deliverables: (teamId: string) => ["workspace", "deliverables", teamId] as const,
  tasks: (teamId: string) => ["workspace", "tasks", teamId] as const,
};

export function useMyTeams() {
  return useQuery({ queryKey: keys.myTeams, queryFn: workspaceApi.myTeams });
}

export function useTeamMembers(teamId: string | null) {
  return useQuery({
    queryKey: keys.members(teamId ?? ""),
    queryFn: () => workspaceApi.members(teamId!),
    enabled: Boolean(teamId),
  });
}

export function useWorkspaceAccess(teamId: string | null) {
  return useQuery({
    queryKey: keys.access(teamId ?? ""),
    queryFn: () => workspaceApi.access(teamId!),
    enabled: Boolean(teamId),
  });
}

export function useDeliverables(teamId: string | null) {
  return useQuery({
    queryKey: keys.deliverables(teamId ?? ""),
    queryFn: () => workspaceApi.deliverables(teamId!),
    enabled: Boolean(teamId),
  });
}

/** Tareas reales delegadas al equipo (Fase 1), para agrupar por módulo. */
export function useTeamTasks(teamId: string | null) {
  return useQuery({
    queryKey: keys.tasks(teamId ?? ""),
    queryFn: () => workspaceApi.tasks(teamId!),
    enabled: Boolean(teamId),
  });
}

/**
 * Las mutaciones invalidan los entregables del equipo y las tareas del equipo:
 * al aprobar/rechazar (Fase 2) también cambia Task.status, así que el listado
 * de tareas del workspace debe refrescarse.
 */
function useDeliverableMutation<TVars, TData>(
  teamId: string | null,
  fn: (vars: TVars) => Promise<TData>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (teamId) {
        void qc.invalidateQueries({ queryKey: keys.deliverables(teamId) });
        void qc.invalidateQueries({ queryKey: keys.tasks(teamId) });
      }
    },
  });
}

export function useCreateDeliverable(teamId: string | null) {
  return useDeliverableMutation(teamId, (body: CreateDeliverableBody) =>
    workspaceApi.createDeliverable(teamId!, body),
  );
}

export function useAddVersion(teamId: string | null) {
  return useDeliverableMutation(teamId, (vars: { deliverableId: string; body: NewVersionBody }) =>
    workspaceApi.addVersion(teamId!, vars.deliverableId, vars.body),
  );
}

export function useAddComment(teamId: string | null) {
  return useDeliverableMutation(teamId, (vars: { deliverableId: string; body: NewCommentBody }) =>
    workspaceApi.addComment(teamId!, vars.deliverableId, vars.body),
  );
}

/**
 * Fase 3: el líder crea una subtarea de una tarea general del equipo. El
 * backend hereda el `team_id` del padre, así que aparece en el listado del
 * workspace sin más. Invalida las tareas del equipo para refrescar el árbol.
 */
export function useCreateTeamSubtask(teamId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksApi.create(payload),
    onSuccess: () => {
      if (teamId) {
        void qc.invalidateQueries({ queryKey: keys.tasks(teamId) });
      }
    },
  });
}
