import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/features/projects/api/tasks.api";
import { taskKeys } from "./query-keys";
import type {
  CreateTaskPayload,
  TaskStatus,
  UpdateTaskPayload,
} from "@/features/projects/types/api.types";

/** Todas las tareas del proyecto (resueltas vía su WorkItem). */
export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.byProject(projectId ?? ""),
    queryFn: () => tasksApi.listByProject(projectId!),
    enabled: Boolean(projectId),
  });
}

/** Tareas que cuelgan de un nodo concreto del árbol. */
export function useWorkItemTasks(workItemId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.byWorkItem(workItemId ?? ""),
    queryFn: () => tasksApi.listByWorkItem(workItemId!),
    enabled: Boolean(workItemId),
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksApi.create(payload),
    onSuccess: (task) => {
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
      if (task.work_item_id) {
        void qc.invalidateQueries({ queryKey: taskKeys.byWorkItem(task.work_item_id) });
      }
    },
  });
}

/** Adjunta una tarea suelta (o la cambia de elemento) a un nodo de la estructura. */
export function useAttachTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, workItemId }: { taskId: string; workItemId: string }) =>
      tasksApi.attach(taskId, { work_item_id: workItemId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
      // Cualquier vista "tareas por elemento" puede haber cambiado.
      void qc.invalidateQueries({ queryKey: [...taskKeys.all, "work-item"] });
    },
  });
}

/** Quita la tarea de la estructura; vuelve a quedar suelta en el proyecto. */
export function useDetachTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.detach(taskId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
      void qc.invalidateQueries({ queryKey: [...taskKeys.all, "work-item"] });
    },
  });
}

/**
 * Edita los datos de una tarea (título, prioridad, fechas, responsable/equipo).
 * Es una acción de administración: PATCH /tasks/{id}. Para reasignar de persona a
 * equipo (o viceversa) el llamador envía el otro campo en null, ya que el backend
 * exige responsable XOR equipo.
 */
export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: UpdateTaskPayload }) =>
      tasksApi.update(taskId, payload),
    onSuccess: (task) => {
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
      if (task.work_item_id) {
        void qc.invalidateQueries({ queryKey: taskKeys.byWorkItem(task.work_item_id) });
      }
    },
  });
}

export function useChangeTaskStatus(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      status,
      reason,
    }: {
      taskId: string;
      status: TaskStatus;
      reason?: string;
    }) => tasksApi.changeStatus(taskId, status, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) }),
  });
}

export function useTaskDependencies(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.dependencies(taskId ?? ""),
    queryFn: () => tasksApi.listDependencies(taskId!),
    enabled: Boolean(taskId),
  });
}

/** Todas las dependencias FtS del proyecto, para dibujar flechas en el Gantt. */
export function useProjectTaskDependencies(projectId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.projectDependencies(projectId ?? ""),
    queryFn: () => tasksApi.listProjectDependencies(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useAddTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) =>
      tasksApi.addDependency(taskId, dependsOnId),
    onSuccess: (_data, { taskId }) =>
      qc.invalidateQueries({ queryKey: taskKeys.dependencies(taskId) }),
  });
}
