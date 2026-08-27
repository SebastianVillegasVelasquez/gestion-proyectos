import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/features/projects/api/tasks.api";
import { projectKeys, taskKeys } from "@/features/projects/hooks/query-keys";
import type { CreateTaskPayload } from "@/features/projects/types/api.types";
import {
  workspaceApi,
  type ApiTeamNotificationSettings,
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
  notifications: (teamId: string) => ["workspace", "notifications", teamId] as const,
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
 * workspace sin más.
 *
 * Invalida DOS mundos: el del equipo y el del proyecto. La subtarea no es una
 * entidad aparte —es una Task del proyecto— y debe verse igual en el
 * cronograma, la estructura y la trazabilidad.
 */
export function useCreateTeamSubtask(teamId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksApi.create(payload),
    onSuccess: (task) => {
      if (teamId) {
        void qc.invalidateQueries({ queryKey: keys.tasks(teamId) });
      }

      // Una subtarea del equipo es una Task normal del proyecto: hereda el
      // `work_item_id` del padre, así que YA sale en el cronograma, en la
      // estructura y en la trazabilidad. Lo que faltaba era avisar a esas
      // vistas: sin invalidar sus claves, seguían mostrando la caché anterior
      // y la subtarea "no aparecía" hasta recargar la página entera.
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(task.project_id) });
      void qc.invalidateQueries({ queryKey: projectKeys.traceability(task.project_id) });
      if (task.work_item_id) {
        void qc.invalidateQueries({ queryKey: taskKeys.byWorkItem(task.work_item_id) });
      }
    },
  });
}

// ── Preferencias de aviso (por equipo y usuario) ────────────────────────────

export function useTeamNotifications(teamId: string | null) {
  return useQuery({
    queryKey: keys.notifications(teamId ?? ""),
    queryFn: () => workspaceApi.notifications(teamId!),
    enabled: Boolean(teamId),
  });
}

/**
 * Actualización optimista: un interruptor debe responder al instante. Pintamos
 * el nuevo valor en caché antes de la respuesta y, si el PUT falla, restauramos
 * el valor anterior (`context.previous`) para no dejar la UI mintiendo.
 */
export function useUpdateTeamNotifications(teamId: string | null) {
  const qc = useQueryClient();
  const key = keys.notifications(teamId ?? "");

  return useMutation({
    mutationFn: (body: ApiTeamNotificationSettings) =>
      workspaceApi.updateNotifications(teamId!, body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ApiTeamNotificationSettings>(key);
      qc.setQueryData(key, body);
      return { previous };
    },
    onError: (_err, _body, context) => {
      if (context?.previous) {
        qc.setQueryData(key, context.previous);
      }
    },
    // Siempre reconciliamos con el servidor: es él quien tiene la última palabra.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}
